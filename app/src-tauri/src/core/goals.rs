use crate::models::{Goal, GoalLink};
use chrono::NaiveDate;
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use tauri::AppHandle;

const GOAL_COLORS: [&str; 6] = ["brand", "emerald", "sky", "amber", "rose", "violet"];

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalLinkInput {
    pub source_type: String,
    pub account_id: Option<i32>,
    pub ticker: Option<String>,
    pub allocation_percent: f64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalWrite {
    pub name: String,
    pub target_amount: f64,
    pub currency: Option<String>,
    pub target_date: Option<String>,
    pub monthly_contribution: Option<f64>,
    pub notes: Option<String>,
    pub color: Option<String>,
    pub links: Vec<GoalLinkInput>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGoalArgs {
    pub id: i32,
    pub archived: bool,
    #[serde(flatten)]
    pub goal: GoalWrite,
}

struct CleanGoal {
    name: String,
    target_amount: f64,
    currency: Option<String>,
    target_date: Option<String>,
    monthly_contribution: Option<f64>,
    notes: Option<String>,
    color: String,
    links: Vec<CleanLink>,
}

struct CleanLink {
    source_type: String,
    account_id: Option<i32>,
    ticker: Option<String>,
    allocation_percent: f64,
}

fn blank_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn normalize_color(color: Option<String>) -> String {
    blank_to_none(color)
        .filter(|value| GOAL_COLORS.contains(&value.as_str()))
        .unwrap_or_else(|| "brand".to_string())
}

fn normalize_date(date: Option<String>) -> Result<Option<String>, String> {
    let Some(raw) = blank_to_none(date) else {
        return Ok(None);
    };
    NaiveDate::parse_from_str(&raw, "%Y-%m-%d")
        .map(|_| Some(raw))
        .map_err(|_| "Target date must be YYYY-MM-DD".to_string())
}

fn normalize_goal(input: &GoalWrite) -> Result<CleanGoal, String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Goal name cannot be empty".to_string());
    }
    if input.target_amount <= 0.0 {
        return Err("Goal target must be greater than zero".to_string());
    }
    if let Some(monthly) = input.monthly_contribution {
        if monthly <= 0.0 {
            return Err("Monthly contribution must be greater than zero".to_string());
        }
    }

    Ok(CleanGoal {
        name,
        target_amount: input.target_amount,
        currency: blank_to_none(input.currency.clone()),
        target_date: normalize_date(input.target_date.clone())?,
        monthly_contribution: input.monthly_contribution,
        notes: blank_to_none(input.notes.clone()),
        color: normalize_color(input.color.clone()),
        links: normalize_links(&input.links)?,
    })
}

fn normalize_links(links: &[GoalLinkInput]) -> Result<Vec<CleanLink>, String> {
    let mut seen = HashSet::new();
    let mut clean = Vec::with_capacity(links.len());

    for link in links {
        let source_type = link.source_type.trim().to_string();
        let allocation = link.allocation_percent;
        if !(1.0..=100.0).contains(&allocation) {
            return Err("Allocation must be between 1 and 100".to_string());
        }

        let (account_id, ticker, key) = match source_type.as_str() {
            "account" => {
                let account_id = link
                    .account_id
                    .ok_or_else(|| "Account link requires an account".to_string())?;
                (Some(account_id), None, format!("account:{account_id}"))
            }
            "holding" => {
                let ticker = blank_to_none(link.ticker.clone())
                    .ok_or_else(|| "Investment link requires a ticker".to_string())?;
                let key = match link.account_id {
                    Some(account_id) => {
                        format!("holding:{account_id}:{}", ticker.to_lowercase())
                    }
                    None => format!("holding:*:{}", ticker.to_lowercase()),
                };
                (link.account_id, Some(ticker), key)
            }
            _ => return Err("Unknown goal link type".to_string()),
        };

        if !seen.insert(key) {
            return Err("Duplicate goal link".to_string());
        }

        clean.push(CleanLink {
            source_type,
            account_id,
            ticker,
            allocation_percent: allocation,
        });
    }

    Ok(clean)
}

fn insert_links(conn: &Connection, goal_id: i32, links: &[CleanLink]) -> Result<(), String> {
    for link in links {
        conn.execute(
            "INSERT INTO goal_links (goal_id, source_type, account_id, ticker, allocation_percent)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                goal_id,
                link.source_type,
                link.account_id,
                link.ticker,
                link.allocation_percent
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn load_exchange_rates(
    conn: &Connection,
    target_currency: Option<&str>,
) -> Result<HashMap<String, f64>, String> {
    let Some(target) = target_currency else {
        return Ok(HashMap::new());
    };
    let mut stmt = conn
        .prepare("SELECT currency, rate FROM custom_exchange_rates")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut rates = HashMap::new();
    for (currency, rate) in rows.flatten() {
        rates.insert(currency, rate);
    }
    rates.insert(target.to_string(), 1.0);
    Ok(rates)
}

fn exchange_rate_for(
    currency: Option<&str>,
    target_currency: Option<&str>,
    rates: &HashMap<String, f64>,
) -> f64 {
    let Some(target) = target_currency else {
        return 1.0;
    };
    let Some(currency) = currency else {
        return 1.0;
    };
    if currency == target {
        1.0
    } else {
        rates.get(currency).copied().unwrap_or(1.0)
    }
}

pub fn get_goals_db(db_path: &PathBuf, target_currency: Option<&str>) -> Result<Vec<Goal>, String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let rates = load_exchange_rates(&conn, target_currency)?;

        let mut goal_stmt = conn
            .prepare(
                "SELECT id, name, target_amount, currency, target_date, monthly_contribution,
                        notes, color, created_at, archived
                 FROM goals
                 ORDER BY archived ASC, name COLLATE NOCASE ASC",
            )
            .map_err(|e| e.to_string())?;
        let mut goals = goal_stmt
            .query_map([], |row| {
                let currency: Option<String> = row.get(3)?;
                let archived: i32 = row.get(9)?;
                Ok(Goal {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    target_amount: row.get(2)?,
                    currency: currency.clone(),
                    target_date: row.get(4)?,
                    monthly_contribution: row.get(5)?,
                    notes: row.get(6)?,
                    color: row.get(7)?,
                    created_at: row.get(8)?,
                    archived: archived != 0,
                    exchange_rate: exchange_rate_for(currency.as_deref(), target_currency, &rates),
                    links: Vec::new(),
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        let mut link_stmt = conn
            .prepare(
                "SELECT id, goal_id, source_type, account_id, ticker, allocation_percent
                 FROM goal_links
                 ORDER BY id ASC",
            )
            .map_err(|e| e.to_string())?;
        let links = link_stmt
            .query_map([], |row| {
                Ok(GoalLink {
                    id: row.get(0)?,
                    goal_id: row.get(1)?,
                    source_type: row.get(2)?,
                    account_id: row.get(3)?,
                    ticker: row.get(4)?,
                    allocation_percent: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for link in links {
            if let Some(goal) = goals.iter_mut().find(|goal| goal.id == link.goal_id) {
                goal.links.push(link);
            }
        }

        Ok(goals)
    })
}

pub fn create_goal_db(db_path: &PathBuf, input: &GoalWrite) -> Result<i32, String> {
    let clean = normalize_goal(input)?;
    crate::db_locked!(db_path, {
        let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO goals (
                name, target_amount, currency, target_date, monthly_contribution,
                notes, color, created_at, archived
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, date('now'), 0)",
            params![
                clean.name,
                clean.target_amount,
                clean.currency,
                clean.target_date,
                clean.monthly_contribution,
                clean.notes,
                clean.color
            ],
        )
        .map_err(|e| e.to_string())?;
        let id = i32::try_from(tx.last_insert_rowid()).map_err(|e| e.to_string())?;
        insert_links(&tx, id, &clean.links)?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(id)
    })
}

pub fn update_goal_db(db_path: &PathBuf, input: &UpdateGoalArgs) -> Result<(), String> {
    let clean = normalize_goal(&input.goal)?;
    let archived: i32 = i32::from(input.archived);
    crate::db_locked!(db_path, {
        let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        let rows = tx
            .execute(
                "UPDATE goals
                 SET name = ?1, target_amount = ?2, currency = ?3, target_date = ?4,
                     monthly_contribution = ?5, notes = ?6, color = ?7, archived = ?8
                 WHERE id = ?9",
                params![
                    clean.name,
                    clean.target_amount,
                    clean.currency,
                    clean.target_date,
                    clean.monthly_contribution,
                    clean.notes,
                    clean.color,
                    archived,
                    input.id
                ],
            )
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Goal not found".to_string());
        }
        tx.execute(
            "DELETE FROM goal_links WHERE goal_id = ?1",
            params![input.id],
        )
        .map_err(|e| e.to_string())?;
        insert_links(&tx, input.id, &clean.links)?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    })
}

pub fn delete_goal_db(db_path: &PathBuf, id: i32) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM goal_links WHERE goal_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        let rows = conn
            .execute("DELETE FROM goals WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        if rows == 0 {
            return Err("Goal not found".to_string());
        }
        Ok(())
    })
}

#[tauri::command]
pub fn get_goals(
    app_handle: AppHandle,
    target_currency: Option<String>,
) -> Result<Vec<Goal>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_goals_db(&db_path, target_currency.as_deref())
}

#[tauri::command]
pub fn create_goal(app_handle: AppHandle, args: GoalWrite) -> Result<i32, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    create_goal_db(&db_path, &args)
}

#[tauri::command]
pub fn update_goal(app_handle: AppHandle, args: UpdateGoalArgs) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    update_goal_db(&db_path, &args)
}

#[tauri::command]
pub fn delete_goal(app_handle: AppHandle, id: i32) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    delete_goal_db(&db_path, id)
}
