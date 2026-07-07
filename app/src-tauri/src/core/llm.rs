use crate::db_init;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;

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

// ── Settings Commands ───────────────────────────────────────────────

pub(crate) fn default_ollama_url() -> String {
    "http://localhost:11434".to_string()
}

pub(crate) fn validate_ollama_base_url(base_url: &str) -> Result<reqwest::Url, String> {
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

pub(crate) fn ollama_api_url(base_url: &str, endpoint: &str) -> Result<String, String> {
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

/// Fetches the list of available models from an Ollama server base URL.
pub(crate) async fn fetch_ollama_models(base_url: &str) -> Result<Vec<OllamaModel>, String> {
    let url = ollama_api_url(base_url, "/api/tags")?;

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {e}"))?;

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid response from Ollama: {e}"))?;

    Ok(parse_ollama_models(&body))
}

pub(crate) fn parse_ollama_models(body: &Value) -> Vec<OllamaModel> {
    body["models"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|m| OllamaModel {
            name: m["name"].as_str().unwrap_or("").to_string(),
            size: m["size"].as_u64(),
            modified_at: m["modified_at"].as_str().map(String::from),
        })
        .collect()
}

/// Returns whether the Ollama server at `base_url` responds successfully.
pub(crate) async fn ping_ollama(base_url: &str) -> bool {
    let Ok(url) = ollama_api_url(base_url, "/api/tags") else {
        return false;
    };

    match reqwest::get(&url).await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

/// Fetches the list of available models from the configured Ollama server.
#[tauri::command]
pub async fn list_ollama_models(app_handle: AppHandle) -> Result<Vec<OllamaModel>, String> {
    let settings = db_init::read_settings(&app_handle)?;
    let base_url = settings.ollama_url.unwrap_or_else(default_ollama_url);
    fetch_ollama_models(&base_url).await
}

/// Validates that the Ollama server is reachable at the configured URL.
#[tauri::command]
pub async fn check_ollama_connection(app_handle: AppHandle) -> Result<bool, String> {
    let settings = db_init::read_settings(&app_handle)?;
    let base_url = settings.ollama_url.unwrap_or_else(default_ollama_url);
    Ok(ping_ollama(&base_url).await)
}

// ── Conversation CRUD ───────────────────────────────────────────────

/// Retrieves all chat conversations.
#[tauri::command]
pub fn get_conversations(app_handle: AppHandle) -> Result<Vec<Conversation>, String> {
    let db_path = db_init::get_db_path(&app_handle)?;
    get_conversations_db(&db_path)
}

/// Queries all conversations from the database, ordered by most recent first.
pub fn get_conversations_db(db_path: &Path) -> Result<Vec<Conversation>, String> {
    crate::db_locked!(db_path, {
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
pub fn create_conversation_db(db_path: &Path, title: String) -> Result<Conversation, String> {
    crate::db_locked!(db_path, {
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
    delete_conversation_db(&db_path, conversation_id)
}

/// Deletes a conversation and all its associated messages from the database.
pub fn delete_conversation_db(db_path: &Path, conversation_id: i64) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
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
    rename_conversation_db(&db_path, conversation_id, title)
}

/// Updates the title of an existing conversation in the database.
pub fn rename_conversation_db(
    db_path: &Path,
    conversation_id: i64,
    title: String,
) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
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
    db_path: &Path,
    conversation_id: i64,
) -> Result<Vec<ChatMessage>, String> {
    crate::db_locked!(db_path, {
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

pub(crate) fn save_message_db(
    db_path: &Path,
    conversation_id: i64,
    role: &str,
    content: Option<&str>,
    tool_calls: Option<&str>,
    tool_call_id: Option<&str>,
    thinking: Option<&str>,
) -> Result<i64, String> {
    crate::db_locked!(db_path, {
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
    delete_all_conversations_db(&db_path)
}

/// Deletes all conversations and their messages from the database.
pub fn delete_all_conversations_db(db_path: &Path) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute("PRAGMA foreign_keys = ON", [])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM chat_conversations", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ── Tool Definitions ────────────────────────────────────────────────

pub(crate) fn build_tool_definitions() -> Vec<Value> {
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

pub(crate) fn build_system_prompt(db_path: &PathBuf) -> String {
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
                        .map_or_else(|| "no valuation".to_string(), |v| format!("{v:.2}"));
                    let date_str = a.latest_date.as_deref().unwrap_or("unknown");
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

/// Marks a conversation's LLM chat stream as cancelled.
#[tauri::command]
pub async fn cancel_llm_chat(conversation_id: i64) -> Result<(), String> {
    CANCELLED
        .lock()
        .map_err(|e| e.to_string())?
        .insert(conversation_id);
    Ok(())
}

pub(crate) fn is_cancelled(conversation_id: i64) -> bool {
    CANCELLED
        .lock()
        .is_ok_and(|set| set.contains(&conversation_id))
}

pub(crate) fn clear_cancelled(conversation_id: i64) {
    if let Ok(mut set) = CANCELLED.lock() {
        set.remove(&conversation_id);
    }
}

#[cfg(test)]
pub(crate) fn save_message_db_for_test(
    db_path: &Path,
    conversation_id: i64,
    role: &str,
    content: Option<&str>,
    tool_calls: Option<&str>,
    tool_call_id: Option<&str>,
    thinking: Option<&str>,
) -> Result<i64, String> {
    save_message_db(
        db_path,
        conversation_id,
        role,
        content,
        tool_calls,
        tool_call_id,
        thinking,
    )
}

#[cfg(test)]
pub(crate) fn build_system_prompt_for_test(db_path: &PathBuf) -> String {
    build_system_prompt(db_path)
}

#[cfg(test)]
pub(crate) fn build_tool_definitions_for_test() -> Vec<Value> {
    build_tool_definitions()
}

#[cfg(test)]
pub(crate) fn is_cancelled_for_test(conversation_id: i64) -> bool {
    is_cancelled(conversation_id)
}

#[cfg(test)]
pub(crate) fn clear_cancelled_for_test(conversation_id: i64) {
    clear_cancelled(conversation_id);
}

#[cfg(test)]
pub(crate) async fn cancel_llm_chat_for_test(conversation_id: i64) -> Result<(), String> {
    cancel_llm_chat(conversation_id).await
}

#[cfg(test)]
mod tests {
    use super::{
        fetch_ollama_models, ollama_api_url, parse_ollama_models, ping_ollama,
        validate_ollama_base_url,
    };
    use serde_json::json;

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

    #[test]
    fn parse_ollama_models_handles_empty_and_populated_payloads() {
        assert!(parse_ollama_models(&json!({})).is_empty());
        let models = parse_ollama_models(&json!({
            "models": [
                {"name": "llama3", "size": 100, "modified_at": "2024-01-01"},
                {"size": 50}
            ]
        }));
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].name, "llama3");
        assert_eq!(models[0].size, Some(100));
        assert_eq!(models[1].name, "");
    }

    #[tokio::test]
    async fn fetch_ollama_models_uses_mock_server() {
        let server = httpmock::MockServer::start();
        server.mock(|when, then| {
            when.method(httpmock::Method::GET).path("/api/tags");
            then.status(200)
                .body(r#"{"models":[{"name":"gemma","size":200,"modified_at":"2024-06-01"}]}"#);
        });

        let models = fetch_ollama_models(&server.base_url()).await.unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].name, "gemma");
    }

    #[tokio::test]
    async fn ping_ollama_reports_reachability() {
        let server = httpmock::MockServer::start();
        server.mock(|when, then| {
            when.method(httpmock::Method::GET).path("/api/tags");
            then.status(200);
        });
        assert!(ping_ollama(&server.base_url()).await);

        let down = httpmock::MockServer::start();
        down.mock(|when, then| {
            when.method(httpmock::Method::GET).path("/api/tags");
            then.status(503);
        });
        assert!(!ping_ollama(&down.base_url()).await);
        assert!(!ping_ollama("not-a-valid-url").await);
    }
}
