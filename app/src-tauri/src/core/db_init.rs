use rusqlite::Connection;
use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, OnceLock};
use tauri::{AppHandle, Manager};

use crate::models::AppSettings;

static DB_PATH_LOCKS: OnceLock<Mutex<HashMap<PathBuf, &'static Mutex<()>>>> = OnceLock::new();

thread_local! {
    static DB_LOCK_DEPTH: RefCell<HashMap<PathBuf, usize>> = RefCell::new(HashMap::new());
}

pub struct DbLockGuard {
    key: PathBuf,
    _guard: Option<MutexGuard<'static, ()>>,
}

impl Drop for DbLockGuard {
    fn drop(&mut self) {
        let key = self.key.clone();
        DB_LOCK_DEPTH.with(|depths| {
            let mut depths = depths.borrow_mut();
            if let Some(depth) = depths.get_mut(&key) {
                if *depth > 1 {
                    *depth -= 1;
                } else {
                    depths.remove(&key);
                }
            }
        });
    }
}

pub fn acquire_db_lock(db_path: &Path) -> Result<DbLockGuard, String> {
    let key = db_path.to_path_buf();

    let is_reentrant = DB_LOCK_DEPTH.with(|depths| {
        let mut depths = depths.borrow_mut();
        if let Some(depth) = depths.get_mut(&key) {
            *depth += 1;
            true
        } else {
            depths.insert(key.clone(), 1);
            false
        }
    });

    if is_reentrant {
        return Ok(DbLockGuard { key, _guard: None });
    }

    let lock_ref: &'static Mutex<()> = {
        let locks = DB_PATH_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
        let mut map = locks
            .lock()
            .map_err(|_| "Failed to lock database lock map".to_string())?;
        map.entry(key.clone())
            .or_insert_with(|| Box::leak(Box::new(Mutex::new(()))))
    };

    let guard = lock_ref
        .lock()
        .map_err(|_| "Failed to lock database path mutex".to_string())?;

    Ok(DbLockGuard {
        key,
        _guard: Some(guard),
    })
}

/// Acquires a per-path reentrant lock before executing `operation`.
///
/// The lock is per database path, so operations on different databases can run concurrently.
/// Re-entrant calls on the same thread skip the mutex and only decrement the depth on drop.
pub fn with_db_lock<T, F>(db_path: &Path, operation: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String>,
{
    let _lock = acquire_db_lock(db_path)?;
    operation()
}

/// Acquires a per-path database lock and evaluates `body` while the lock is held.
///
/// Prefer this over [`with_db_lock`] when the body needs outer variables: CodeQL's
/// `rust/unused-variable` query does not track implicit closure captures.
#[macro_export]
macro_rules! db_locked {
    ($db_path:expr, $body:expr) => {{
        let _db_guard = $crate::db_init::acquire_db_lock($db_path)?;
        $body
    }};
}

/// Returns the path to `settings.json` in the app data directory, creating the directory if needed.
pub fn settings_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    Ok(app_dir.join("settings.json"))
}

/// Loads application settings from `settings.json`, returning defaults if the file does not exist.
pub fn read_settings(app_handle: &AppHandle) -> Result<AppSettings, String> {
    let settings_path = settings_file_path(app_handle)?;
    if settings_path.exists() {
        let contents = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let s: AppSettings = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        Ok(s)
    } else {
        Ok(AppSettings::default())
    }
}

/// Persists the given `AppSettings` to `settings.json`.
pub fn write_settings(app_handle: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let settings_path = settings_file_path(app_handle)?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

/// Returns the database file path, using the custom path from settings if set, otherwise the default.
pub fn get_db_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    // If the user has configured an override, use it
    if let Ok(settings) = read_settings(app_handle) {
        if let Some(ref p) = settings.db_path {
            let pb = PathBuf::from(p);
            // Ensure parent dir exists
            if let Some(parent) = pb.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
            }
            return Ok(pb);
        }
    }

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    Ok(app_dir.join("honeybear.db"))
}

/// Creates all database tables and indexes, and runs schema migrations for new columns.
pub fn init_db(app_handle: &AppHandle) -> Result<(), String> {
    let db_path = get_db_path(app_handle)?;
    let db_ref = db_path.as_path();
    crate::db_locked!(db_ref, {
        let conn = Connection::open(db_ref).map_err(|e| e.to_string())?;

        // SQLite performance pragmas
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA cache_size = -64000;
             PRAGMA temp_store = MEMORY;
             PRAGMA foreign_keys = ON;",
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            balance REAL NOT NULL,
            kind TEXT DEFAULT 'cash'
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY,
            account_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            payee TEXT NOT NULL,
            notes TEXT,
            category TEXT,
            amount REAL NOT NULL,
            ticker TEXT,
            shares REAL,
            price_per_share REAL,
            fee REAL,
            FOREIGN KEY(account_id) REFERENCES accounts(id)
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        // Migrate transactions: check all needed columns in a single PRAGMA call
        {
            let mut stmt = conn
                .prepare("PRAGMA table_info(transactions)")
                .map_err(|e| e.to_string())?;
            let col_iter = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(|e| e.to_string())?;
            let cols: std::collections::HashSet<String> = col_iter.flatten().collect();

            if !cols.contains("linked_tx_id") {
                match conn.execute(
                    "ALTER TABLE transactions ADD COLUMN linked_tx_id INTEGER",
                    [],
                ) {
                    Ok(_) => {}
                    Err(e) => {
                        let s = e.to_string();
                        if !s.contains("duplicate column name") && !s.contains("already exists") {
                            return Err(s);
                        }
                    }
                }
            }
            if !cols.contains("currency") {
                match conn.execute("ALTER TABLE transactions ADD COLUMN currency TEXT", []) {
                    Ok(_) => {}
                    Err(e) => {
                        let s = e.to_string();
                        if !s.contains("duplicate column name") && !s.contains("already exists") {
                            return Err(s);
                        }
                    }
                }
            }
        }

        // Migrate accounts: check currency column
        {
            let mut stmt = conn
                .prepare("PRAGMA table_info(accounts)")
                .map_err(|e| e.to_string())?;
            let col_iter = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(|e| e.to_string())?;
            let cols: std::collections::HashSet<String> = col_iter.flatten().collect();

            if !cols.contains("currency") {
                match conn.execute("ALTER TABLE accounts ADD COLUMN currency TEXT", []) {
                    Ok(_) => {}
                    Err(e) => {
                        let s = e.to_string();
                        if !s.contains("duplicate column name") && !s.contains("already exists") {
                            return Err(s);
                        }
                    }
                }
            }
        }

        conn.execute(
            "CREATE TABLE IF NOT EXISTS stock_prices (
            ticker TEXT PRIMARY KEY,
            price REAL NOT NULL,
            last_updated TEXT NOT NULL
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS daily_stock_prices (
            ticker TEXT NOT NULL,
            date TEXT NOT NULL,
            price REAL NOT NULL,
            PRIMARY KEY (ticker, date)
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS rules (
            id INTEGER PRIMARY KEY,
            priority INTEGER NOT NULL DEFAULT 0,
            match_field TEXT NOT NULL,
            match_pattern TEXT NOT NULL,
            action_field TEXT NOT NULL,
            action_value TEXT NOT NULL,
            logic TEXT NOT NULL DEFAULT 'and',
            conditions TEXT NOT NULL DEFAULT '[]',
            actions TEXT NOT NULL DEFAULT '[]'
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        // Migration: Add new columns to existing rules table if they don't exist
        let _ = conn.execute(
            "ALTER TABLE rules ADD COLUMN logic TEXT NOT NULL DEFAULT 'and'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE rules ADD COLUMN conditions TEXT NOT NULL DEFAULT '[]'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE rules ADD COLUMN actions TEXT NOT NULL DEFAULT '[]'",
            [],
        );

        conn.execute(
            "CREATE TABLE IF NOT EXISTS custom_exchange_rates (
            currency TEXT PRIMARY KEY,
            rate REAL NOT NULL
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS scheduled_transactions (
            id INTEGER PRIMARY KEY,
            account_id INTEGER NOT NULL,
            payee TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            notes TEXT,
            currency TEXT,
            recurrence_type TEXT NOT NULL DEFAULT 'every_n',
            interval_value INTEGER,
            interval_unit TEXT,
            days_of_week TEXT,
            ordinal INTEGER,
            weekday INTEGER,
            start_date TEXT NOT NULL,
            end_date TEXT,
            max_occurrences INTEGER,
            occurrences_count INTEGER NOT NULL DEFAULT 0,
            last_applied_date TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            transaction_type TEXT NOT NULL DEFAULT 'regular',
            ticker TEXT,
            shares REAL,
            price_per_share REAL,
            fee REAL,
            is_buy INTEGER,
            FOREIGN KEY(account_id) REFERENCES accounts(id)
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS chat_conversations (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT,
            tool_calls TEXT,
            tool_call_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        // Migration: Add investment columns to existing scheduled_transactions table
        let _ = conn.execute(
        "ALTER TABLE scheduled_transactions ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'regular'",
        [],
    );
        let _ = conn.execute(
            "ALTER TABLE scheduled_transactions ADD COLUMN ticker TEXT",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE scheduled_transactions ADD COLUMN shares REAL",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE scheduled_transactions ADD COLUMN price_per_share REAL",
            [],
        );
        let _ = conn.execute("ALTER TABLE scheduled_transactions ADD COLUMN fee REAL", []);
        let _ = conn.execute(
            "ALTER TABLE scheduled_transactions ADD COLUMN is_buy INTEGER",
            [],
        );

        // Migration: Add thinking column to chat_messages
        let _ = conn.execute("ALTER TABLE chat_messages ADD COLUMN thinking TEXT", []);

        // Asset tracking tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'other',
            currency TEXT,
            notes TEXT
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS asset_valuations (
            id INTEGER PRIMARY KEY,
            asset_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            value REAL NOT NULL,
            FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
        )",
            [],
        )
        .map_err(|e| e.to_string())?;

        // Performance indexes
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
             CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
             CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
             CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
             CREATE INDEX IF NOT EXISTS idx_scheduled_transactions_account_id ON scheduled_transactions(account_id);
             CREATE INDEX IF NOT EXISTS idx_asset_valuations_asset_id ON asset_valuations(asset_id);
             CREATE INDEX IF NOT EXISTS idx_asset_valuations_date ON asset_valuations(date);",
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })
}

/// Tauri command: sets a custom database path in settings and initializes the database there.
#[tauri::command]
pub fn set_db_path(app_handle: AppHandle, path: String) -> Result<(), String> {
    let mut settings = read_settings(&app_handle)?;
    settings.db_path = Some(path.clone());

    // Also track in recent_dbs
    crate::session::upsert_recent_public(&mut settings, &path, None);

    write_settings(&app_handle, &settings)?;

    // Ensure any parent dir exists and initialize DB at new path
    let pb = PathBuf::from(path);
    if let Some(parent) = pb.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    init_db(&app_handle)?;
    Ok(())
}

/// Tauri command: clears the custom database path so the default location is used.
#[tauri::command]
pub fn reset_db_path(app_handle: AppHandle) -> Result<(), String> {
    let mut settings = read_settings(&app_handle)?;
    settings.db_path = None;
    write_settings(&app_handle, &settings)?;

    // Ensure default DB exists
    init_db(&app_handle)?;
    Ok(())
}

/// Tauri command: returns the current database file path as a string.
#[tauri::command]
pub fn get_db_path_command(app_handle: AppHandle) -> Result<String, String> {
    let pb = get_db_path(&app_handle)?;
    Ok(pb.to_string_lossy().to_string())
}
