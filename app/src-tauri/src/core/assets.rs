use crate::models::{Asset, AssetValuation, AssetWithLatestValue};
use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;

// ── Database helpers (no AppHandle) ─────────────────────────────────

pub fn create_asset_db(
    db_path: &PathBuf,
    name: String,
    category: String,
    currency: Option<String>,
    notes: Option<String>,
) -> Result<Asset, String> {
    crate::db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let name_trimmed = name.trim().to_string();
        if name_trimmed.is_empty() {
            return Err("Asset name cannot be empty".to_string());
        }
        conn.execute(
            "INSERT INTO assets (name, category, currency, notes) VALUES (?1, ?2, ?3, ?4)",
            params![name_trimmed, category, currency, notes],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid() as i32;
        Ok(Asset {
            id,
            name: name_trimmed,
            category,
            currency,
            notes,
        })
    })
}

pub fn get_assets_db(
    db_path: &PathBuf,
    target_currency: Option<&str>,
) -> Result<Vec<AssetWithLatestValue>, String> {
    crate::db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

        // Fetch exchange rates when a target currency is specified
        let exchange_rates: HashMap<String, f64> = if let Some(target) = target_currency {
            let mut stmt = conn
                .prepare("SELECT currency, rate FROM custom_exchange_rates")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
                })
                .map_err(|e| e.to_string())?;
            let mut map = HashMap::new();
            for (currency, rate) in rows.flatten() {
                map.insert(currency, rate);
            }
            // Ensure target currency has rate 1.0
            map.insert(target.to_string(), 1.0);
            map
        } else {
            HashMap::new()
        };

        let mut stmt = conn
            .prepare(
                "SELECT a.id, a.name, a.category, a.currency, a.notes,
                        v.value, v.date
                 FROM assets a
                 LEFT JOIN asset_valuations v ON v.asset_id = a.id
                    AND v.date = (SELECT MAX(v2.date) FROM asset_valuations v2 WHERE v2.asset_id = a.id)
                 ORDER BY a.name",
            )
            .map_err(|e| e.to_string())?;

        let assets = stmt
            .query_map([], |row| {
                let currency: Option<String> = row.get(3)?;
                Ok(AssetWithLatestValue {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    category: row.get(2)?,
                    currency: currency.clone(),
                    notes: row.get(4)?,
                    latest_value: row.get(5)?,
                    latest_date: row.get(6)?,
                    exchange_rate: {
                        if let Some(ref cur) = currency {
                            if let Some(target) = target_currency {
                                if cur == target {
                                    1.0
                                } else {
                                    // Look up rate: asset_currency → target
                                    exchange_rates.get(cur).copied().unwrap_or(1.0)
                                }
                            } else {
                                1.0
                            }
                        } else {
                            1.0
                        }
                    },
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(assets)
    })
}

pub fn update_asset_db(
    db_path: &PathBuf,
    id: i32,
    name: String,
    category: String,
    currency: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    crate::db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let name_trimmed = name.trim().to_string();
        if name_trimmed.is_empty() {
            return Err("Asset name cannot be empty".to_string());
        }
        let rows = conn
            .execute(
                "UPDATE assets SET name = ?1, category = ?2, currency = ?3, notes = ?4 WHERE id = ?5",
                params![name_trimmed, category, currency, notes, id],
            )
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Asset not found".to_string());
        }
        Ok(())
    })
}

pub fn delete_asset_db(db_path: &PathBuf, id: i32) -> Result<(), String> {
    crate::db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        // Delete valuations first (cascade may not be enforced in all SQLite builds)
        conn.execute(
            "DELETE FROM asset_valuations WHERE asset_id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        let rows = conn
            .execute("DELETE FROM assets WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Asset not found".to_string());
        }
        Ok(())
    })
}

// ── Valuations ──────────────────────────────────────────────────────

pub fn create_valuation_db(
    db_path: &PathBuf,
    asset_id: i32,
    date: String,
    value: f64,
) -> Result<AssetValuation, String> {
    crate::db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO asset_valuations (asset_id, date, value) VALUES (?1, ?2, ?3)",
            params![asset_id, date, value],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid() as i32;
        Ok(AssetValuation {
            id,
            asset_id,
            date,
            value,
        })
    })
}

pub fn get_valuations_db(db_path: &PathBuf, asset_id: i32) -> Result<Vec<AssetValuation>, String> {
    crate::db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, asset_id, date, value FROM asset_valuations WHERE asset_id = ?1 ORDER BY date DESC",
            )
            .map_err(|e| e.to_string())?;
        let valuations = stmt
            .query_map(params![asset_id], |row| {
                Ok(AssetValuation {
                    id: row.get(0)?,
                    asset_id: row.get(1)?,
                    date: row.get(2)?,
                    value: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(valuations)
    })
}

pub fn update_valuation_db(
    db_path: &PathBuf,
    id: i32,
    date: String,
    value: f64,
) -> Result<(), String> {
    crate::db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let rows = conn
            .execute(
                "UPDATE asset_valuations SET date = ?1, value = ?2 WHERE id = ?3",
                params![date, value, id],
            )
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Valuation not found".to_string());
        }
        Ok(())
    })
}

pub fn delete_valuation_db(db_path: &PathBuf, id: i32) -> Result<(), String> {
    crate::db_init::with_db_lock(db_path, || {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let rows = conn
            .execute("DELETE FROM asset_valuations WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Valuation not found".to_string());
        }
        Ok(())
    })
}

/// Returns the sum of the latest valuation for each asset, converted via exchange_rate.
pub fn get_total_assets_value_db(
    db_path: &PathBuf,
    target_currency: Option<&str>,
) -> Result<f64, String> {
    let assets = get_assets_db(db_path, target_currency)?;
    let total = assets
        .iter()
        .map(|a| a.latest_value.unwrap_or(0.0) * a.exchange_rate)
        .sum();
    Ok(total)
}

// ── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn create_asset(
    app_handle: AppHandle,
    name: String,
    category: String,
    currency: Option<String>,
    notes: Option<String>,
) -> Result<Asset, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    create_asset_db(&db_path, name, category, currency, notes)
}

#[tauri::command]
pub fn get_assets(
    app_handle: AppHandle,
    target_currency: Option<String>,
) -> Result<Vec<AssetWithLatestValue>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_assets_db(&db_path, target_currency.as_deref())
}

#[tauri::command]
pub fn update_asset(
    app_handle: AppHandle,
    id: i32,
    name: String,
    category: String,
    currency: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    update_asset_db(&db_path, id, name, category, currency, notes)
}

#[tauri::command]
pub fn delete_asset(app_handle: AppHandle, id: i32) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    delete_asset_db(&db_path, id)
}

#[tauri::command]
pub fn create_valuation(
    app_handle: AppHandle,
    asset_id: i32,
    date: String,
    value: f64,
) -> Result<AssetValuation, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    create_valuation_db(&db_path, asset_id, date, value)
}

#[tauri::command]
pub fn get_valuations(app_handle: AppHandle, asset_id: i32) -> Result<Vec<AssetValuation>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_valuations_db(&db_path, asset_id)
}

#[tauri::command]
pub fn update_valuation(
    app_handle: AppHandle,
    id: i32,
    date: String,
    value: f64,
) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    update_valuation_db(&db_path, id, date, value)
}

#[tauri::command]
pub fn delete_valuation(app_handle: AppHandle, id: i32) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    delete_valuation_db(&db_path, id)
}

#[tauri::command]
pub fn get_total_assets_value(
    app_handle: AppHandle,
    target_currency: Option<String>,
) -> Result<f64, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_total_assets_value_db(&db_path, target_currency.as_deref())
}
