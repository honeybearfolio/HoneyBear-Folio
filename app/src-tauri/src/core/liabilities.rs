use crate::models::{Liability, LiabilityValuation, LiabilityWithLatestValue};
use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;

// ── Database helpers (no AppHandle) ─────────────────────────────────

pub fn create_liability_db(
    db_path: &PathBuf,
    name: String,
    category: String,
    currency: Option<String>,
    notes: Option<String>,
) -> Result<Liability, String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let name_trimmed = name.trim().to_string();
        if name_trimmed.is_empty() {
            return Err("Liability name cannot be empty".to_string());
        }
        conn.execute(
            "INSERT INTO liabilities (name, category, currency, notes) VALUES (?1, ?2, ?3, ?4)",
            params![name_trimmed, category, currency, notes],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid() as i32;
        Ok(Liability {
            id,
            name: name_trimmed,
            category,
            currency,
            notes,
        })
    })
}

pub fn get_liabilities_db(
    db_path: &PathBuf,
    target_currency: Option<&str>,
) -> Result<Vec<LiabilityWithLatestValue>, String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

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
            map.insert(target.to_string(), 1.0);
            map
        } else {
            HashMap::new()
        };

        let mut stmt = conn
            .prepare(
                "SELECT l.id, l.name, l.category, l.currency, l.notes,
                        v.value, v.date
                 FROM liabilities l
                 LEFT JOIN liability_valuations v ON v.liability_id = l.id
                    AND v.date = (SELECT MAX(v2.date) FROM liability_valuations v2 WHERE v2.liability_id = l.id)
                 ORDER BY l.name",
            )
            .map_err(|e| e.to_string())?;

        let liabilities = stmt
            .query_map([], |row| {
                let currency: Option<String> = row.get(3)?;
                Ok(LiabilityWithLatestValue {
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

        Ok(liabilities)
    })
}

pub fn update_liability_db(
    db_path: &PathBuf,
    id: i32,
    name: String,
    category: String,
    currency: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let name_trimmed = name.trim().to_string();
        if name_trimmed.is_empty() {
            return Err("Liability name cannot be empty".to_string());
        }
        let rows = conn
            .execute(
                "UPDATE liabilities SET name = ?1, category = ?2, currency = ?3, notes = ?4 WHERE id = ?5",
                params![name_trimmed, category, currency, notes, id],
            )
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Liability not found".to_string());
        }
        Ok(())
    })
}

pub fn delete_liability_db(db_path: &PathBuf, id: i32) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM liability_valuations WHERE liability_id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        let rows = conn
            .execute("DELETE FROM liabilities WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Liability not found".to_string());
        }
        Ok(())
    })
}

// ── Valuations ──────────────────────────────────────────────────────

pub fn create_liability_valuation_db(
    db_path: &PathBuf,
    liability_id: i32,
    date: String,
    value: f64,
) -> Result<LiabilityValuation, String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO liability_valuations (liability_id, date, value) VALUES (?1, ?2, ?3)",
            params![liability_id, date, value],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid() as i32;
        Ok(LiabilityValuation {
            id,
            liability_id,
            date,
            value,
        })
    })
}

pub fn get_liability_valuations_db(
    db_path: &PathBuf,
    liability_id: i32,
) -> Result<Vec<LiabilityValuation>, String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, liability_id, date, value FROM liability_valuations WHERE liability_id = ?1 ORDER BY date DESC",
            )
            .map_err(|e| e.to_string())?;
        let valuations = stmt
            .query_map(params![liability_id], |row| {
                Ok(LiabilityValuation {
                    id: row.get(0)?,
                    liability_id: row.get(1)?,
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

pub fn update_liability_valuation_db(
    db_path: &PathBuf,
    id: i32,
    date: String,
    value: f64,
) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let rows = conn
            .execute(
                "UPDATE liability_valuations SET date = ?1, value = ?2 WHERE id = ?3",
                params![date, value, id],
            )
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Valuation not found".to_string());
        }
        Ok(())
    })
}

pub fn delete_liability_valuation_db(db_path: &PathBuf, id: i32) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let rows = conn
            .execute(
                "DELETE FROM liability_valuations WHERE id = ?1",
                params![id],
            )
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Valuation not found".to_string());
        }
        Ok(())
    })
}

/// Returns the sum of the latest valuation for each liability, converted via `exchange_rate`.
pub fn get_total_liabilities_value_db(
    db_path: &PathBuf,
    target_currency: Option<&str>,
) -> Result<f64, String> {
    let liabilities = get_liabilities_db(db_path, target_currency)?;
    let total = liabilities
        .iter()
        .map(|l| l.latest_value.unwrap_or(0.0) * l.exchange_rate)
        .sum();
    Ok(total)
}

// ── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn create_liability(
    app_handle: AppHandle,
    name: String,
    category: String,
    currency: Option<String>,
    notes: Option<String>,
) -> Result<Liability, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    create_liability_db(&db_path, name, category, currency, notes)
}

#[tauri::command]
pub fn get_liabilities(
    app_handle: AppHandle,
    target_currency: Option<String>,
) -> Result<Vec<LiabilityWithLatestValue>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_liabilities_db(&db_path, target_currency.as_deref())
}

#[tauri::command]
pub fn update_liability(
    app_handle: AppHandle,
    id: i32,
    name: String,
    category: String,
    currency: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    update_liability_db(&db_path, id, name, category, currency, notes)
}

#[tauri::command]
pub fn delete_liability(app_handle: AppHandle, id: i32) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    delete_liability_db(&db_path, id)
}

#[tauri::command]
pub fn create_liability_valuation(
    app_handle: AppHandle,
    liability_id: i32,
    date: String,
    value: f64,
) -> Result<LiabilityValuation, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    create_liability_valuation_db(&db_path, liability_id, date, value)
}

#[tauri::command]
pub fn get_liability_valuations(
    app_handle: AppHandle,
    liability_id: i32,
) -> Result<Vec<LiabilityValuation>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_liability_valuations_db(&db_path, liability_id)
}

#[tauri::command]
pub fn update_liability_valuation(
    app_handle: AppHandle,
    id: i32,
    date: String,
    value: f64,
) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    update_liability_valuation_db(&db_path, id, date, value)
}

#[tauri::command]
pub fn delete_liability_valuation(app_handle: AppHandle, id: i32) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    delete_liability_valuation_db(&db_path, id)
}

#[tauri::command]
pub fn get_total_liabilities_value(
    app_handle: AppHandle,
    target_currency: Option<String>,
) -> Result<f64, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_total_liabilities_value_db(&db_path, target_currency.as_deref())
}
