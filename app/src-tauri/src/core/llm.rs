use crate::db_init;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

// Global set of conversation IDs that should be cancelled.
static CANCELLED: std::sync::LazyLock<Mutex<HashSet<i64>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashSet::new()));

// ── Models ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LlmSettings {
    pub ollama_url: String,
    pub ollama_model: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Conversation {
    pub id: i64,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMessage {
    pub id: i64,
    pub conversation_id: i64,
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<String>,
    pub tool_call_id: Option<String>,
    pub created_at: String,
    pub thinking: Option<String>,
}

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

// ── Settings Commands ───────────────────────────────────────────────

fn default_ollama_url() -> String {
    "http://localhost:11434".to_string()
}

fn validate_ollama_base_url(base_url: &str) -> Result<reqwest::Url, String> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return Err("Ollama URL cannot be empty.".to_string());
    }

    let parsed = reqwest::Url::parse(trimmed).map_err(|_| {
        "Invalid Ollama URL. Please provide a valid absolute URL (for example: http://localhost:11434)."
            .to_string()
    })?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(
            "Invalid Ollama URL scheme. Only http:// or https:// URLs are allowed.".to_string(),
        );
    }

    if parsed.host_str().is_none() {
        return Err("Invalid Ollama URL host.".to_string());
    }

    if !matches!(parsed.path(), "" | "/")
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(
            "Invalid Ollama URL. Provide only the server base URL (for example: http://localhost:11434)."
                .to_string(),
        );
    }

    Ok(parsed)
}

fn ollama_api_url(base_url: &str, endpoint: &str) -> Result<String, String> {
    let mut parsed = validate_ollama_base_url(base_url)?;
    parsed.set_path(endpoint);
    Ok(parsed.to_string())
}

/// Retrieves the current Ollama URL and model settings.
#[tauri::command]
pub fn get_llm_settings(app_handle: AppHandle) -> Result<LlmSettings, String> {
    let settings = db_init::read_settings(&app_handle)?;
    Ok(LlmSettings {
        ollama_url: settings.ollama_url.unwrap_or_else(default_ollama_url),
        ollama_model: settings.ollama_model.unwrap_or_default(),
    })
}

/// Sets and validates the Ollama server URL and model configuration.
#[tauri::command]
pub fn set_llm_settings(
    app_handle: AppHandle,
    ollama_url: String,
    ollama_model: String,
) -> Result<(), String> {
    let normalized_ollama_url = validate_ollama_base_url(&ollama_url)?.to_string();
    let mut settings = db_init::read_settings(&app_handle)?;
    settings.ollama_url = Some(normalized_ollama_url);
    settings.ollama_model = Some(ollama_model);
    db_init::write_settings(&app_handle, &settings)?;
    Ok(())
}

/// Fetches the list of available models from the configured Ollama server.
#[tauri::command]
pub async fn list_ollama_models(app_handle: AppHandle) -> Result<Vec<OllamaModel>, String> {
    let settings = db_init::read_settings(&app_handle)?;
    let base_url = settings.ollama_url.unwrap_or_else(default_ollama_url);
    let url = ollama_api_url(&base_url, "/api/tags")?;

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {e}"))?;

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid response from Ollama: {e}"))?;

    let models = body["models"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|m| OllamaModel {
            name: m["name"].as_str().unwrap_or("").to_string(),
            size: m["size"].as_u64(),
            modified_at: m["modified_at"].as_str().map(String::from),
        })
        .collect();

    Ok(models)
}

/// Validates that the Ollama server is reachable at the configured URL.
#[tauri::command]
pub async fn check_ollama_connection(app_handle: AppHandle) -> Result<bool, String> {
    let settings = db_init::read_settings(&app_handle)?;
    let base_url = settings.ollama_url.unwrap_or_else(default_ollama_url);
    let url = match ollama_api_url(&base_url, "/api/tags") {
        Ok(url) => url,
        Err(_) => return Ok(false),
    };

    match reqwest::get(&url).await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

// ── Conversation CRUD ───────────────────────────────────────────────

/// Retrieves all chat conversations.
#[tauri::command]
pub fn get_conversations(app_handle: AppHandle) -> Result<Vec<Conversation>, String> {
    let db_path = db_init::get_db_path(&app_handle)?;
    get_conversations_db(&db_path)
}

/// Queries all conversations from the database, ordered by most recent first.
pub fn get_conversations_db(db_path: &PathBuf) -> Result<Vec<Conversation>, String> {
    db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, created_at, updated_at FROM chat_conversations ORDER BY updated_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
}

/// Creates a new chat conversation with the given title.
#[tauri::command]
pub fn create_conversation(app_handle: AppHandle, title: String) -> Result<Conversation, String> {
    let db_path = db_init::get_db_path(&app_handle)?;
    create_conversation_db(&db_path, title)
}

/// Inserts a new conversation into the database and returns it.
pub fn create_conversation_db(db_path: &PathBuf, title: String) -> Result<Conversation, String> {
    db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO chat_conversations (title, created_at, updated_at) VALUES (?1, ?2, ?3)",
            params![title, now, now],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid();
        Ok(Conversation {
            id,
            title,
            created_at: now.clone(),
            updated_at: now,
        })
    })
}

/// Deletes a conversation and all its associated messages.
#[tauri::command]
pub fn delete_conversation(app_handle: AppHandle, conversation_id: i64) -> Result<(), String> {
    let db_path = db_init::get_db_path(&app_handle)?;
    let db_ref = db_path.as_path();
    db_init::with_db_lock(db_ref, move || {
        let conn = Connection::open(db_ref).map_err(|e| e.to_string())?;
        conn.execute("PRAGMA foreign_keys = ON", [])
            .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM chat_conversations WHERE id = ?1",
            params![conversation_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

/// Updates the title of an existing conversation.
#[tauri::command]
pub fn rename_conversation(
    app_handle: AppHandle,
    conversation_id: i64,
    title: String,
) -> Result<(), String> {
    let db_path = db_init::get_db_path(&app_handle)?;
    let db_ref = db_path.as_path();
    db_init::with_db_lock(db_ref, move || {
        let conn = Connection::open(db_ref).map_err(|e| e.to_string())?;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE chat_conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, conversation_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

/// Fetches all messages for a given conversation.
#[tauri::command]
pub fn get_conversation_messages(
    app_handle: AppHandle,
    conversation_id: i64,
) -> Result<Vec<ChatMessage>, String> {
    let db_path = db_init::get_db_path(&app_handle)?;
    get_conversation_messages_db(&db_path, conversation_id)
}

/// Queries all messages for a conversation from the database, ordered chronologically.
pub fn get_conversation_messages_db(
    db_path: &PathBuf,
    conversation_id: i64,
) -> Result<Vec<ChatMessage>, String> {
    db_init::with_db_lock(db_path, move || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, conversation_id, role, content, tool_calls, tool_call_id, created_at, thinking
                 FROM chat_messages WHERE conversation_id = ?1 ORDER BY id ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![conversation_id], |row| {
                Ok(ChatMessage {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    tool_calls: row.get(4)?,
                    tool_call_id: row.get(5)?,
                    created_at: row.get(6)?,
                    thinking: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
}

fn save_message_db(
    db_path: &PathBuf,
    conversation_id: i64,
    role: &str,
    content: Option<&str>,
    tool_calls: Option<&str>,
    tool_call_id: Option<&str>,
    thinking: Option<&str>,
) -> Result<i64, String> {
    db_init::with_db_lock(db_path, move || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO chat_messages (conversation_id, role, content, tool_calls, tool_call_id, thinking, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![conversation_id, role, content, tool_calls, tool_call_id, thinking, now],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid();
        // Touch conversation updated_at
        conn.execute(
            "UPDATE chat_conversations SET updated_at = ?1 WHERE id = ?2",
            params![now, conversation_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(id)
    })
}

/// Deletes all conversations and their messages from the database.
#[tauri::command]
pub fn delete_all_conversations(app_handle: AppHandle) -> Result<(), String> {
    let db_path = db_init::get_db_path(&app_handle)?;
    db_init::with_db_lock(&db_path, || {
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute("PRAGMA foreign_keys = ON", [])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM chat_conversations", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ── Tool Definitions ────────────────────────────────────────────────

fn build_tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "get_accounts",
                "description": "List all financial accounts with their names, balances, and currencies.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_transactions",
                "description": "Get financial transactions. Can filter by account_id, category, payee, and date range (start_date / end_date in YYYY-MM-DD format). Returns id, account_id, date, payee, notes, category, amount, ticker, shares, price_per_share, fee, currency.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "account_id": {
                            "type": "integer",
                            "description": "Filter by account ID"
                        },
                        "category": {
                            "type": "string",
                            "description": "Filter by category (exact match)"
                        },
                        "payee": {
                            "type": "string",
                            "description": "Filter by payee (case-insensitive contains)"
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Filter transactions on or after this date (YYYY-MM-DD)"
                        },
                        "end_date": {
                            "type": "string",
                            "description": "Filter transactions on or before this date (YYYY-MM-DD)"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Max number of transactions to return (default 100)"
                        }
                    },
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_categories",
                "description": "List all distinct transaction categories used in the database.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_payees",
                "description": "List all distinct payee names used in transactions.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_scheduled_transactions",
                "description": "List all scheduled/recurring transactions with their recurrence rules.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_rules",
                "description": "List all auto-fill rules for automatic transaction categorization.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_exchange_rates",
                "description": "List all custom exchange rates configured by the user.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_assets",
                "description": "List tracked physical assets (real estate, vehicles, jewelry, art, collectibles) with their latest valuation. Categories: real_estate, vehicle, jewelry, art, collectible, other. Returns id, name, category, currency, notes, latest_value, latest_date.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target_currency": {
                            "type": "string",
                            "description": "Currency for converted values (default USD)"
                        }
                    },
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_asset_valuations",
                "description": "Get the full valuation history for a tracked asset. Returns dated value records.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "asset_id": {
                            "type": "integer",
                            "description": "The asset ID"
                        }
                    },
                    "required": ["asset_id"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_total_assets_value",
                "description": "Get the total value of all tracked physical assets (sum of latest valuations per asset).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target_currency": {
                            "type": "string",
                            "description": "Currency for the total (default USD)"
                        }
                    },
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_portfolio_holdings",
                "description": "Get investment holdings aggregated from transactions, with current prices, values, and ROI. Uses live stock quotes when available; falls back to cached prices.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target_currency": {
                            "type": "string",
                            "description": "Reference currency for context (default USD)"
                        }
                    },
                    "required": []
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_net_worth",
                "description": "Get a net worth snapshot: per-account balances and investment market values, plus tracked physical assets total. Uses live stock quotes when available; falls back to cached prices.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target_currency": {
                            "type": "string",
                            "description": "Currency for all totals (default USD)"
                        }
                    },
                    "required": []
                }
            }
        }),
    ]
}

// ── Tool Execution ──────────────────────────────────────────────────
// Implemented in llm_tools.rs

// ── System Prompt ───────────────────────────────────────────────────

fn build_system_prompt(db_path: &PathBuf) -> String {
    let mut context_parts = vec![
        "You are a helpful financial assistant for HoneyBear Folio, a personal finance app.".to_string(),
        "You can query the user's financial data using the available tools.".to_string(),
        "Always use tools to look up data rather than making assumptions about the user's finances.".to_string(),
        "Present financial data clearly with amounts and currencies.".to_string(),
        "You can only read data — you cannot modify accounts, transactions, or settings.".to_string(),
        "When presenting monetary amounts, format them nicely and include the currency.".to_string(),
        "If the user asks about something you cannot determine from the available tools, let them know.".to_string(),
        "Use get_net_worth for total wealth; use get_assets / get_asset_valuations for physical assets; use get_portfolio_holdings for investments.".to_string(),
    ];

    // Add account context so the LLM knows what accounts exist
    if let Ok(accounts) = crate::accounts::get_accounts_db(db_path) {
        if !accounts.is_empty() {
            let account_list: Vec<String> = accounts
                .iter()
                .map(|a| {
                    format!(
                        "- {} (ID: {}, currency: {})",
                        a.name,
                        a.id,
                        a.currency.as_deref().unwrap_or("USD")
                    )
                })
                .collect();
            context_parts.push(format!(
                "\nThe user has the following accounts:\n{}",
                account_list.join("\n")
            ));
        }
    }

    if let Ok(assets) = crate::assets::get_assets_db(db_path, None) {
        if !assets.is_empty() {
            let asset_list: Vec<String> = assets
                .iter()
                .map(|a| {
                    let value_str = a
                        .latest_value
                        .map(|v| format!("{v:.2}"))
                        .unwrap_or_else(|| "no valuation".to_string());
                    let date_str = a
                        .latest_date
                        .as_deref()
                        .unwrap_or("unknown");
                    format!(
                        "- {} (ID: {}, category: {}, latest value: {} {}, as of {})",
                        a.name,
                        a.id,
                        a.category,
                        value_str,
                        a.currency.as_deref().unwrap_or("USD"),
                        date_str
                    )
                })
                .collect();
            context_parts.push(format!(
                "\nThe user has the following tracked assets:\n{}",
                asset_list.join("\n")
            ));
        }
    }

    context_parts.join("\n")
}

// ── Ollama Streaming Chat ───────────────────────────────────────────

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

/// Marks a conversation's LLM chat stream as cancelled.
#[tauri::command]
pub async fn cancel_llm_chat(conversation_id: i64) -> Result<(), String> {
    CANCELLED
        .lock()
        .map_err(|e| e.to_string())?
        .insert(conversation_id);
    Ok(())
}

fn is_cancelled(conversation_id: i64) -> bool {
    CANCELLED
        .lock()
        .map(|set| set.contains(&conversation_id))
        .unwrap_or(false)
}

fn clear_cancelled(conversation_id: i64) {
    if let Ok(mut set) = CANCELLED.lock() {
        set.remove(&conversation_id);
    }
}

/// Streams an LLM response from the Ollama backend for the given conversation.
#[tauri::command]
pub async fn llm_chat(
    app_handle: AppHandle,
    conversation_id: i64,
    user_message: String,
    #[allow(unused_variables)] think: Option<bool>,
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

    // Clear any stale cancellation flag for this conversation
    clear_cancelled(conversation_id);

    // Save user message
    save_message_db(
        &db_path,
        conversation_id,
        "user",
        Some(&user_message),
        None,
        None,
        None,
    )?;

    // Load conversation history
    let history = get_conversation_messages_db(&db_path, conversation_id)?;

    // Build messages array for Ollama
    let system_prompt = build_system_prompt(&db_path);
    let tools = build_tool_definitions();

    let mut messages: Vec<Value> = vec![json!({
        "role": "system",
        "content": system_prompt,
    })];

    // Add conversation history (skip tool/system messages for simplicity in history replay,
    // but include user and assistant messages with content)
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

    // Run the chat loop (may loop if tool calls happen)
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

    // Allow up to 10 rounds of tool calls to prevent infinite loops
    for round in 0..10 {
        // Check cancellation before starting a round
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

        // Emit status: thinking when starting a new round
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

        // Stream the response
        let mut full_content = String::new();
        let mut full_thinking = String::new();
        let mut tool_calls: Vec<OllamaToolCall> = Vec::new();
        let mut buffer = String::new();

        let mut first_token = true;

        let mut stream = resp;
        while let Some(chunk) = stream.chunk().await.map_err(|e| e.to_string())? {
            // Check cancellation between chunks
            if is_cancelled(conversation_id) {
                clear_cancelled(conversation_id);
                // Save whatever content we have so far
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

            // Process complete lines from buffer
            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() {
                    continue;
                }

                if let Ok(chunk_data) = serde_json::from_str::<OllamaChatChunk>(&line) {
                    if let Some(ref msg) = chunk_data.message {
                        // Accumulate thinking tokens
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

                        // Accumulate content tokens
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

                        // Accumulate tool calls
                        if let Some(ref tcs) = msg.tool_calls {
                            tool_calls.extend(tcs.clone());
                        }
                    }
                }
            }
        }

        // If there are tool calls, execute them and continue the loop
        if !tool_calls.is_empty() {
            let _ = app_handle.emit(
                "llm-status",
                LlmStatusEvent {
                    conversation_id,
                    status: "querying_tools".to_string(),
                },
            );
            // Save assistant message with tool calls
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

            // Add assistant message with tool calls to messages
            let mut assistant_msg = json!({ "role": "assistant" });
            if !full_content.is_empty() {
                assistant_msg["content"] = json!(full_content);
            }
            assistant_msg["tool_calls"] =
                serde_json::to_value(&tool_calls).map_err(|e| e.to_string())?;
            messages.push(assistant_msg);

            // Execute each tool call and add results
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

                // Save tool result message
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

            // Reset for next iteration
            full_content = String::new();
            full_thinking = String::new();
            tool_calls = Vec::new();
            continue;
        }

        // No tool calls — save the final assistant message and emit done
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

#[cfg(test)]
mod tests {
    use super::{ollama_api_url, validate_ollama_base_url};

    #[test]
    fn validate_ollama_base_url_accepts_http_and_https_hosts() {
        assert!(validate_ollama_base_url("http://localhost:11434").is_ok());
        assert!(validate_ollama_base_url("https://example.com").is_ok());
    }

    #[test]
    fn validate_ollama_base_url_rejects_invalid_scheme_or_missing_host() {
        assert!(validate_ollama_base_url("ftp://localhost:11434").is_err());
        let missing_host_err = validate_ollama_base_url("http:///api/tags").unwrap_err();
        assert!(missing_host_err.contains("host"));
        assert!(validate_ollama_base_url("localhost:11434").is_err());
    }

    #[test]
    fn validate_ollama_base_url_rejects_non_base_urls() {
        assert!(validate_ollama_base_url("http://localhost:11434/api/tags").is_err());
        assert!(validate_ollama_base_url("http://localhost:11434?x=1").is_err());
        assert!(validate_ollama_base_url("http://user:pass@localhost:11434").is_err());
    }

    #[test]
    fn ollama_api_url_builds_expected_endpoint_url() {
        let url = ollama_api_url("http://localhost:11434", "/api/tags").unwrap();
        assert_eq!(url, "http://localhost:11434/api/tags");
    }
}
