use crate::db_init;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

use super::llm::{
    build_system_prompt, build_tool_definitions, clear_cancelled, default_ollama_url,
    get_conversation_messages_db, is_cancelled, ollama_api_url, save_message_db,
    validate_ollama_base_url,
};

/// Payload emitted to the frontend for each streamed token.
#[derive(Serialize, Clone)]
struct LlmTokenEvent {
    conversation_id: i64,
    token: String,
}

/// Payload emitted when tool calls start.
#[derive(Serialize, Clone)]
struct LlmToolCallEvent {
    conversation_id: i64,
    tool_name: String,
}

/// Payload emitted when the assistant message is done.
#[derive(Serialize, Clone)]
struct LlmDoneEvent {
    conversation_id: i64,
    full_content: String,
}

/// Payload emitted on error.
#[derive(Serialize, Clone)]
struct LlmErrorEvent {
    conversation_id: i64,
    error: String,
}

/// Payload emitted for each streamed thinking token.
#[derive(Serialize, Clone)]
struct LlmThinkingEvent {
    conversation_id: i64,
    token: String,
}

/// Payload emitted to report status changes (thinking, querying tools, etc.).
#[derive(Serialize, Clone)]
struct LlmStatusEvent {
    conversation_id: i64,
    status: String,
}

#[derive(Deserialize, Debug)]
struct OllamaChatChunk {
    #[serde(default)]
    message: Option<OllamaMessage>,
    #[serde(default)]
    #[allow(dead_code)]
    done: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct OllamaMessage {
    role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OllamaToolCall>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct OllamaToolCall {
    function: OllamaFunctionCall,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct OllamaFunctionCall {
    name: String,
    arguments: Value,
}

/// Streams an LLM response from the Ollama backend for the given conversation.
#[tauri::command]
pub async fn llm_chat(
    app_handle: AppHandle,
    conversation_id: i64,
    user_message: String,
    think: Option<bool>,
) -> Result<(), String> {
    let settings = db_init::read_settings(&app_handle)?;
    let base_url =
        validate_ollama_base_url(&settings.ollama_url.unwrap_or_else(default_ollama_url))?
            .to_string();
    let model = settings
        .ollama_model
        .filter(|m| !m.is_empty())
        .ok_or_else(|| "No Ollama model configured. Please set one in Settings.".to_string())?;

    let db_path = db_init::get_db_path(&app_handle)?;

    clear_cancelled(conversation_id);

    save_message_db(
        &db_path,
        conversation_id,
        "user",
        Some(&user_message),
        None,
        None,
        None,
    )?;

    let history = get_conversation_messages_db(&db_path, conversation_id)?;

    let system_prompt = build_system_prompt(&db_path);
    let tools = build_tool_definitions();

    let mut messages: Vec<Value> = vec![json!({
        "role": "system",
        "content": system_prompt,
    })];

    for msg in &history {
        let mut m = json!({ "role": msg.role });
        if let Some(ref content) = msg.content {
            m["content"] = json!(content);
        }
        if let Some(ref tc) = msg.tool_calls {
            if let Ok(parsed) = serde_json::from_str::<Value>(tc) {
                m["tool_calls"] = parsed;
            }
        }
        if let Some(ref tcid) = msg.tool_call_id {
            m["tool_call_id"] = json!(tcid);
        }
        messages.push(m);
    }

    let result = run_chat_loop(
        &app_handle,
        &base_url,
        &model,
        &db_path,
        conversation_id,
        &mut messages,
        &tools,
        think.unwrap_or(false),
    )
    .await;

    if let Err(ref e) = result {
        let _ = app_handle.emit(
            "llm-error",
            LlmErrorEvent {
                conversation_id,
                error: e.clone(),
            },
        );
    }

    result
}

#[allow(clippy::too_many_arguments)]
async fn run_chat_loop(
    app_handle: &AppHandle,
    base_url: &str,
    model: &str,
    db_path: &PathBuf,
    conversation_id: i64,
    messages: &mut Vec<Value>,
    tools: &[Value],
    think: bool,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = ollama_api_url(base_url, "/api/chat")?;

    for round in 0..10 {
        if is_cancelled(conversation_id) {
            clear_cancelled(conversation_id);
            let _ = app_handle.emit(
                "llm-done",
                LlmDoneEvent {
                    conversation_id,
                    full_content: String::new(),
                },
            );
            return Ok(());
        }

        let _ = app_handle.emit(
            "llm-status",
            LlmStatusEvent {
                conversation_id,
                status: if round == 0 {
                    "thinking".to_string()
                } else {
                    "thinking_tools".to_string()
                },
            },
        );

        let body = json!({
            "model": model,
            "messages": messages,
            "tools": tools,
            "stream": true,
            "think": think,
        });

        let resp = client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to Ollama: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama returned {status}: {text}"));
        }

        let mut full_content = String::new();
        let mut full_thinking = String::new();
        let mut tool_calls: Vec<OllamaToolCall> = Vec::new();
        let mut buffer = String::new();

        let mut first_token = true;

        let mut stream = resp;
        while let Some(chunk) = stream.chunk().await.map_err(|e| e.to_string())? {
            if is_cancelled(conversation_id) {
                clear_cancelled(conversation_id);
                if !full_content.is_empty() || !full_thinking.is_empty() {
                    let _ = save_message_db(
                        db_path,
                        conversation_id,
                        "assistant",
                        if full_content.is_empty() {
                            None
                        } else {
                            Some(&full_content)
                        },
                        None,
                        None,
                        if full_thinking.is_empty() {
                            None
                        } else {
                            Some(&full_thinking)
                        },
                    );
                }
                let _ = app_handle.emit(
                    "llm-done",
                    LlmDoneEvent {
                        conversation_id,
                        full_content,
                    },
                );
                return Ok(());
            }

            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() {
                    continue;
                }

                if let Ok(chunk_data) = serde_json::from_str::<OllamaChatChunk>(&line) {
                    if let Some(ref msg) = chunk_data.message {
                        if let Some(ref thinking) = msg.thinking {
                            if !thinking.is_empty() {
                                full_thinking.push_str(thinking);
                                let _ = app_handle.emit(
                                    "llm-thinking",
                                    LlmThinkingEvent {
                                        conversation_id,
                                        token: thinking.clone(),
                                    },
                                );
                            }
                        }

                        if let Some(ref content) = msg.content {
                            if !content.is_empty() {
                                if first_token {
                                    first_token = false;
                                    let _ = app_handle.emit(
                                        "llm-status",
                                        LlmStatusEvent {
                                            conversation_id,
                                            status: "generating".to_string(),
                                        },
                                    );
                                }
                                full_content.push_str(content);
                                let _ = app_handle.emit(
                                    "llm-token",
                                    LlmTokenEvent {
                                        conversation_id,
                                        token: content.clone(),
                                    },
                                );
                            }
                        }

                        if let Some(ref tcs) = msg.tool_calls {
                            tool_calls.extend(tcs.clone());
                        }
                    }
                }
            }
        }

        if !tool_calls.is_empty() {
            let _ = app_handle.emit(
                "llm-status",
                LlmStatusEvent {
                    conversation_id,
                    status: "querying_tools".to_string(),
                },
            );
            let tc_json = serde_json::to_string(&tool_calls).unwrap_or_default();
            save_message_db(
                db_path,
                conversation_id,
                "assistant",
                if full_content.is_empty() {
                    None
                } else {
                    Some(&full_content)
                },
                Some(&tc_json),
                None,
                if full_thinking.is_empty() {
                    None
                } else {
                    Some(&full_thinking)
                },
            )?;

            let mut assistant_msg = json!({ "role": "assistant" });
            if !full_content.is_empty() {
                assistant_msg["content"] = json!(full_content);
            }
            assistant_msg["tool_calls"] =
                serde_json::to_value(&tool_calls).map_err(|e| e.to_string())?;
            messages.push(assistant_msg);

            for tc in &tool_calls {
                let tool_name = &tc.function.name;
                let _ = app_handle.emit(
                    "llm-tool-call",
                    LlmToolCallEvent {
                        conversation_id,
                        tool_name: tool_name.clone(),
                    },
                );

                let result = match super::llm_tools::execute_tool(
                    &client,
                    db_path,
                    tool_name,
                    &tc.function.arguments,
                )
                .await
                {
                    Ok(val) => serde_json::to_string(&val).unwrap_or_default(),
                    Err(e) => format!("Error executing {tool_name}: {e}"),
                };

                save_message_db(
                    db_path,
                    conversation_id,
                    "tool",
                    Some(&result),
                    None,
                    Some(tool_name),
                    None,
                )?;

                messages.push(json!({
                    "role": "tool",
                    "content": result,
                }));
            }

            full_content = String::new();
            full_thinking = String::new();
            tool_calls = Vec::new();
            continue;
        }

        if !full_content.is_empty() || !full_thinking.is_empty() {
            save_message_db(
                db_path,
                conversation_id,
                "assistant",
                if full_content.is_empty() {
                    None
                } else {
                    Some(&full_content)
                },
                None,
                None,
                if full_thinking.is_empty() {
                    None
                } else {
                    Some(&full_thinking)
                },
            )?;
        }

        let _ = app_handle.emit(
            "llm-done",
            LlmDoneEvent {
                conversation_id,
                full_content,
            },
        );

        return Ok(());
    }

    Err("Too many tool call rounds — aborting to prevent infinite loop.".to_string())
}
