use std::collections::HashMap;
use std::path::Path;

use rusqlite::params;

fn open_existing(path: &str) -> Result<crate::db_init::PooledConnection, String> {
    let path = Path::new(path);
    if !path.is_file() {
        return Err("Portfolio database does not exist".to_string());
    }
    crate::db_init::open_db(path)
}

#[tauri::command]
pub fn get_portfolio_preferences(path: String) -> Result<HashMap<String, String>, String> {
    let conn = open_existing(&path)?;
    let mut statement = conn
        .prepare("SELECT key, value FROM portfolio_preferences")
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<HashMap<_, _>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_portfolio_preference(path: String, key: String, value: String) -> Result<(), String> {
    let conn = open_existing(&path)?;
    conn.execute(
        "INSERT INTO portfolio_preferences (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
