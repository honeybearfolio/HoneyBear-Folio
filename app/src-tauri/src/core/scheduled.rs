use crate::models::{ScheduledOccurrence, ScheduledTransaction};
use chrono::{Datelike, Duration, NaiveDate, Weekday};
use rusqlite::{params, Connection};
use std::path::PathBuf;
use tauri::AppHandle;

// ---------------------------------------------------------------------------
// Recurrence engine
// ---------------------------------------------------------------------------

/// Convert our 0=Sun..6=Sat integer to chrono::Weekday
fn to_chrono_weekday(d: u32) -> Option<Weekday> {
    match d {
        0 => Some(Weekday::Sun),
        1 => Some(Weekday::Mon),
        2 => Some(Weekday::Tue),
        3 => Some(Weekday::Wed),
        4 => Some(Weekday::Thu),
        5 => Some(Weekday::Fri),
        6 => Some(Weekday::Sat),
        _ => None,
    }
}

/// Convert chrono::Weekday to our 0=Sun..6=Sat integer
fn from_chrono_weekday(w: Weekday) -> u32 {
    match w {
        Weekday::Sun => 0,
        Weekday::Mon => 1,
        Weekday::Tue => 2,
        Weekday::Wed => 3,
        Weekday::Thu => 4,
        Weekday::Fri => 5,
        Weekday::Sat => 6,
    }
}

/// Find the Nth occurrence (1-based) of a given weekday in a month.
/// ordinal == -1 means "last occurrence".
fn nth_weekday_of_month(year: i32, month: u32, weekday: Weekday, ordinal: i32) -> Option<NaiveDate> {
    if ordinal == -1 {
        // Last occurrence: start from last day and go backwards
        let last_day = last_day_of_month(year, month)?;
        let mut d = last_day;
        while d.weekday() != weekday {
            d = d.pred_opt()?;
        }
        Some(d)
    } else if ordinal >= 1 && ordinal <= 5 {
        // Find first occurrence of `weekday` in the month, then add (ordinal-1) weeks
        let first = NaiveDate::from_ymd_opt(year, month, 1)?;
        let mut d = first;
        while d.weekday() != weekday {
            d = d.succ_opt()?;
        }
        d = d + Duration::weeks((ordinal - 1) as i64);
        // Verify still in the same month
        if d.month() == month {
            Some(d)
        } else {
            None
        }
    } else {
        None
    }
}

fn last_day_of_month(year: i32, month: u32) -> Option<NaiveDate> {
    if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)?.pred_opt()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)?.pred_opt()
    }
}

/// Compute all occurrence dates for a scheduled transaction within [from, to] (inclusive).
pub fn compute_occurrences(
    schedule: &ScheduledTransaction,
    from: NaiveDate,
    to: NaiveDate,
) -> Vec<NaiveDate> {
    match schedule.recurrence_type.as_str() {
        "every_n" => compute_every_n(schedule, from, to),
        "day_of_week" => compute_day_of_week(schedule, from, to),
        "ordinal_weekday" => compute_ordinal_weekday(schedule, from, to),
        _ => vec![],
    }
}

fn compute_every_n(
    schedule: &ScheduledTransaction,
    from: NaiveDate,
    to: NaiveDate,
) -> Vec<NaiveDate> {
    let interval = schedule.interval_value.unwrap_or(1).max(1);
    let unit = schedule.interval_unit.as_deref().unwrap_or("month");

    let start = match NaiveDate::parse_from_str(&schedule.start_date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    let end_date = schedule
        .end_date
        .as_ref()
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let mut results = Vec::new();
    let mut cursor = start;
    let mut count = 0;

    while cursor <= to {
        if cursor >= from {
            // Check end conditions
            if let Some(ed) = end_date {
                if cursor > ed {
                    break;
                }
            }
            if let Some(max) = schedule.max_occurrences {
                if count >= max {
                    break;
                }
            }
            results.push(cursor);
        }
        count += 1;

        // Advance cursor
        cursor = match unit {
            "day" => cursor + Duration::days(interval as i64),
            "week" => cursor + Duration::weeks(interval as i64),
            "month" => add_months(cursor, interval),
            "year" => add_months(cursor, interval * 12),
            _ => cursor + Duration::days(interval as i64),
        };
    }

    results
}

fn compute_day_of_week(
    schedule: &ScheduledTransaction,
    from: NaiveDate,
    to: NaiveDate,
) -> Vec<NaiveDate> {
    let days = match &schedule.days_of_week {
        Some(d) if !d.is_empty() => d.clone(),
        _ => return vec![],
    };

    let start = match NaiveDate::parse_from_str(&schedule.start_date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    let end_date = schedule
        .end_date
        .as_ref()
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let weekdays: Vec<Weekday> = days.iter().filter_map(|&d| to_chrono_weekday(d)).collect();

    let effective_from = from.max(start);
    let effective_to = match end_date {
        Some(ed) => to.min(ed),
        None => to,
    };

    let mut results = Vec::new();
    let mut cursor = effective_from;

    while cursor <= effective_to {
        if weekdays.contains(&cursor.weekday()) {
            if let Some(max) = schedule.max_occurrences {
                // Count total occurrences from start_date
                let total_before = count_weekday_occurrences(start, cursor, &weekdays);
                if total_before > max as usize {
                    break;
                }
            }
            results.push(cursor);
        }
        cursor = match cursor.succ_opt() {
            Some(d) => d,
            None => break,
        };
    }

    results
}

fn count_weekday_occurrences(from: NaiveDate, to: NaiveDate, weekdays: &[Weekday]) -> usize {
    let mut count = 0;
    let mut d = from;
    while d <= to {
        if weekdays.contains(&d.weekday()) {
            count += 1;
        }
        d = match d.succ_opt() {
            Some(next) => next,
            None => break,
        };
    }
    count
}

fn compute_ordinal_weekday(
    schedule: &ScheduledTransaction,
    from: NaiveDate,
    to: NaiveDate,
) -> Vec<NaiveDate> {
    let ordinal = match schedule.ordinal {
        Some(o) => o,
        None => return vec![],
    };
    let weekday_num = match schedule.weekday {
        Some(w) => w,
        None => return vec![],
    };
    let weekday = match to_chrono_weekday(weekday_num) {
        Some(w) => w,
        None => return vec![],
    };

    let start = match NaiveDate::parse_from_str(&schedule.start_date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    let end_date = schedule
        .end_date
        .as_ref()
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let mut results = Vec::new();
    // Iterate month by month from start through to
    let mut year = start.year();
    let mut month = start.month();
    let mut occ_count = 0;

    loop {
        let first_of_month = match NaiveDate::from_ymd_opt(year, month, 1) {
            Some(d) => d,
            None => break,
        };
        if first_of_month > to {
            break;
        }

        if let Some(date) = nth_weekday_of_month(year, month, weekday, ordinal) {
            if date >= start && date >= from && date <= to {
                if let Some(ed) = end_date {
                    if date > ed {
                        break;
                    }
                }
                if let Some(max) = schedule.max_occurrences {
                    if occ_count >= max {
                        break;
                    }
                }
                results.push(date);
            }
            if date >= start {
                occ_count += 1;
            }
        }

        // Advance month
        if month == 12 {
            year += 1;
            month = 1;
        } else {
            month += 1;
        }
    }

    results
}

/// Add `months` to a date, clamping to the last day of the target month
/// (e.g. Jan 31 + 1 month → Feb 28/29).
fn add_months(date: NaiveDate, months: i32) -> NaiveDate {
    let total_months = date.year() * 12 + date.month() as i32 - 1 + months;
    let target_year = total_months / 12;
    let target_month = (total_months % 12 + 1) as u32;
    let target_day = date.day();

    // Clamp day to the last valid day of the target month
    let max_day = last_day_of_month(target_year, target_month)
        .map(|d| d.day())
        .unwrap_or(28);

    NaiveDate::from_ymd_opt(target_year, target_month, target_day.min(max_day))
        .unwrap_or(date)
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

fn row_to_scheduled(row: &rusqlite::Row<'_>) -> rusqlite::Result<ScheduledTransaction> {
    let days_of_week_json: Option<String> = row.get(7)?;
    let days_of_week: Option<Vec<u32>> =
        days_of_week_json.and_then(|s| serde_json::from_str(&s).ok());

    let enabled_int: i32 = row.get(15)?;

    Ok(ScheduledTransaction {
        id: row.get(0)?,
        account_id: row.get(1)?,
        payee: row.get(2)?,
        amount: row.get(3)?,
        category: row.get(4)?,
        notes: row.get(5)?,
        currency: row.get(6)?,
        recurrence_type: row.get(16)?,
        interval_value: row.get(8)?,
        interval_unit: row.get(9)?,
        days_of_week,
        ordinal: row.get(10)?,
        weekday: row.get(11)?,
        start_date: row.get(12)?,
        end_date: row.get(13)?,
        max_occurrences: row.get(14)?,
        occurrences_count: row.get(17)?,
        last_applied_date: row.get(18)?,
        enabled: enabled_int != 0,
    })
}

const SELECT_COLUMNS: &str =
    "id, account_id, payee, amount, category, notes, currency, \
     days_of_week, interval_value, interval_unit, ordinal, weekday, \
     start_date, end_date, max_occurrences, enabled, recurrence_type, \
     occurrences_count, last_applied_date";

pub fn get_scheduled_transactions_db(
    db_path: &PathBuf,
) -> Result<Vec<ScheduledTransaction>, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let sql = format!("SELECT {} FROM scheduled_transactions ORDER BY id ASC", SELECT_COLUMNS);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| row_to_scheduled(row))
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for item in iter {
        results.push(item.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateScheduledTransactionArgs {
    pub account_id: i32,
    pub payee: String,
    pub amount: f64,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub currency: Option<String>,
    pub recurrence_type: String,
    pub interval_value: Option<i32>,
    pub interval_unit: Option<String>,
    pub days_of_week: Option<Vec<u32>>,
    pub ordinal: Option<i32>,
    pub weekday: Option<u32>,
    pub start_date: String,
    pub end_date: Option<String>,
    pub max_occurrences: Option<i32>,
}

pub fn create_scheduled_transaction_db(
    db_path: &PathBuf,
    args: CreateScheduledTransactionArgs,
) -> Result<i32, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let days_json = args
        .days_of_week
        .as_ref()
        .map(|d| serde_json::to_string(d).unwrap_or_else(|_| "[]".to_string()));

    conn.execute(
        "INSERT INTO scheduled_transactions \
         (account_id, payee, amount, category, notes, currency, \
          recurrence_type, interval_value, interval_unit, days_of_week, \
          ordinal, weekday, start_date, end_date, max_occurrences) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            args.account_id,
            args.payee,
            args.amount,
            args.category,
            args.notes,
            args.currency,
            args.recurrence_type,
            args.interval_value,
            args.interval_unit,
            days_json,
            args.ordinal,
            args.weekday,
            args.start_date,
            args.end_date,
            args.max_occurrences,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid() as i32)
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpdateScheduledTransactionArgs {
    pub id: i32,
    pub account_id: i32,
    pub payee: String,
    pub amount: f64,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub currency: Option<String>,
    pub recurrence_type: String,
    pub interval_value: Option<i32>,
    pub interval_unit: Option<String>,
    pub days_of_week: Option<Vec<u32>>,
    pub ordinal: Option<i32>,
    pub weekday: Option<u32>,
    pub start_date: String,
    pub end_date: Option<String>,
    pub max_occurrences: Option<i32>,
    pub enabled: bool,
}

pub fn update_scheduled_transaction_db(
    db_path: &PathBuf,
    args: UpdateScheduledTransactionArgs,
) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let days_json = args
        .days_of_week
        .as_ref()
        .map(|d| serde_json::to_string(d).unwrap_or_else(|_| "[]".to_string()));

    let enabled_int: i32 = if args.enabled { 1 } else { 0 };

    conn.execute(
        "UPDATE scheduled_transactions SET \
         account_id = ?1, payee = ?2, amount = ?3, category = ?4, \
         notes = ?5, currency = ?6, recurrence_type = ?7, \
         interval_value = ?8, interval_unit = ?9, days_of_week = ?10, \
         ordinal = ?11, weekday = ?12, start_date = ?13, \
         end_date = ?14, max_occurrences = ?15, enabled = ?16 \
         WHERE id = ?17",
        params![
            args.account_id,
            args.payee,
            args.amount,
            args.category,
            args.notes,
            args.currency,
            args.recurrence_type,
            args.interval_value,
            args.interval_unit,
            days_json,
            args.ordinal,
            args.weekday,
            args.start_date,
            args.end_date,
            args.max_occurrences,
            enabled_int,
            args.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn delete_scheduled_transaction_db(db_path: &PathBuf, id: i32) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM scheduled_transactions WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Compute pending occurrences (missed + upcoming 5 days) for an optional account_id.
/// If account_id is None, returns occurrences across all accounts.
pub fn get_pending_occurrences_db(
    db_path: &PathBuf,
    account_id: Option<i32>,
    today_str: &str,
) -> Result<Vec<ScheduledOccurrence>, String> {
    let today = NaiveDate::parse_from_str(today_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date: {}", e))?;
    let lookahead = today + Duration::days(5);

    let schedules = get_scheduled_transactions_db(db_path)?;

    // Also fetch account names for display
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let mut name_stmt = conn
        .prepare("SELECT id, name FROM accounts")
        .map_err(|e| e.to_string())?;
    let account_names: std::collections::HashMap<i32, String> = name_stmt
        .query_map([], |row| {
            Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut occurrences = Vec::new();

    for sched in &schedules {
        if !sched.enabled {
            continue;
        }
        if let Some(aid) = account_id {
            if sched.account_id != aid {
                continue;
            }
        }

        // The range for scanning: from the day after last_applied_date (or start_date) through lookahead
        let range_start = sched
            .last_applied_date
            .as_ref()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .map(|d| d + Duration::days(1))
            .unwrap_or_else(|| {
                NaiveDate::parse_from_str(&sched.start_date, "%Y-%m-%d")
                    .unwrap_or(today)
            });

        let dates = compute_occurrences(sched, range_start, lookahead);

        for date in dates {
            let status = if date < today {
                "missed"
            } else {
                "upcoming"
            };
            occurrences.push(ScheduledOccurrence {
                scheduled_tx_id: sched.id,
                date: date.format("%Y-%m-%d").to_string(),
                status: status.to_string(),
                account_id: sched.account_id,
                payee: sched.payee.clone(),
                amount: sched.amount,
                category: sched.category.clone(),
                notes: sched.notes.clone(),
                currency: sched.currency.clone(),
                account_name: account_names.get(&sched.account_id).cloned(),
            });
        }
    }

    // Sort: missed first (oldest first), then upcoming (soonest first)
    occurrences.sort_by(|a, b| {
        let a_missed = a.status == "missed";
        let b_missed = b.status == "missed";
        match (a_missed, b_missed) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.date.cmp(&b.date),
        }
    });

    Ok(occurrences)
}

/// Apply a scheduled occurrence: create a real transaction with the given date,
/// then update the schedule's tracking fields.
pub fn apply_scheduled_occurrence_db(
    db_path: &PathBuf,
    scheduled_tx_id: i32,
    apply_date: &str,
) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // Fetch the scheduled transaction
    let sql = format!(
        "SELECT {} FROM scheduled_transactions WHERE id = ?1",
        SELECT_COLUMNS
    );
    let sched: ScheduledTransaction = conn
        .query_row(&sql, params![scheduled_tx_id], |row| row_to_scheduled(row))
        .map_err(|e| e.to_string())?;

    // Create the real transaction using the same logic as create_transaction_db
    let create_args = crate::transactions::CreateTransactionArgs {
        account_id: sched.account_id,
        date: apply_date.to_string(),
        payee: sched.payee.clone(),
        notes: sched.notes.clone(),
        category: sched.category.clone(),
        amount: sched.amount,
        ticker: None,
        shares: None,
        price_per_share: None,
        fee: None,
        currency: sched.currency.clone(),
    };
    crate::transactions::create_transaction_db(db_path, create_args)?;

    // Update tracking: increment occurrences_count and set last_applied_date
    conn.execute(
        "UPDATE scheduled_transactions SET occurrences_count = occurrences_count + 1, last_applied_date = ?1 WHERE id = ?2",
        params![apply_date, scheduled_tx_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Skip a scheduled occurrence: advance last_applied_date without creating a transaction.
pub fn skip_scheduled_occurrence_db(
    db_path: &PathBuf,
    scheduled_tx_id: i32,
    skip_date: &str,
) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE scheduled_transactions SET last_applied_date = ?1 WHERE id = ?2",
        params![skip_date, scheduled_tx_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_scheduled_transactions(
    app_handle: AppHandle,
) -> Result<Vec<ScheduledTransaction>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_scheduled_transactions_db(&db_path)
}

#[tauri::command]
pub fn create_scheduled_transaction(
    app_handle: AppHandle,
    args: CreateScheduledTransactionArgs,
) -> Result<i32, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    create_scheduled_transaction_db(&db_path, args)
}

#[tauri::command]
pub fn update_scheduled_transaction(
    app_handle: AppHandle,
    args: UpdateScheduledTransactionArgs,
) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    update_scheduled_transaction_db(&db_path, args)
}

#[tauri::command]
pub fn delete_scheduled_transaction(app_handle: AppHandle, id: i32) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    delete_scheduled_transaction_db(&db_path, id)
}

#[tauri::command]
pub fn get_pending_occurrences(
    app_handle: AppHandle,
    account_id: Option<i32>,
) -> Result<Vec<ScheduledOccurrence>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    get_pending_occurrences_db(&db_path, account_id, &today)
}

#[tauri::command]
pub fn apply_scheduled_occurrence(
    app_handle: AppHandle,
    scheduled_tx_id: i32,
    apply_date: String,
) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    apply_scheduled_occurrence_db(&db_path, scheduled_tx_id, &apply_date)
}

#[tauri::command]
pub fn skip_scheduled_occurrence(
    app_handle: AppHandle,
    scheduled_tx_id: i32,
    skip_date: String,
) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    skip_scheduled_occurrence_db(&db_path, scheduled_tx_id, &skip_date)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_schedule(
        recurrence_type: &str,
        start_date: &str,
        interval_value: Option<i32>,
        interval_unit: Option<&str>,
        days_of_week: Option<Vec<u32>>,
        ordinal: Option<i32>,
        weekday: Option<u32>,
    ) -> ScheduledTransaction {
        ScheduledTransaction {
            id: 1,
            account_id: 1,
            payee: "Test".to_string(),
            amount: 100.0,
            category: None,
            notes: None,
            currency: None,
            recurrence_type: recurrence_type.to_string(),
            interval_value,
            interval_unit: interval_unit.map(String::from),
            days_of_week,
            ordinal,
            weekday,
            start_date: start_date.to_string(),
            end_date: None,
            max_occurrences: None,
            occurrences_count: 0,
            last_applied_date: None,
            enabled: true,
        }
    }

    #[test]
    fn test_every_n_days() {
        let sched = make_schedule("every_n", "2026-01-01", Some(3), Some("day"), None, None, None);
        let from = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 1, 10).unwrap();
        let dates = compute_occurrences(&sched, from, to);
        assert_eq!(
            dates,
            vec![
                NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2026, 1, 4).unwrap(),
                NaiveDate::from_ymd_opt(2026, 1, 7).unwrap(),
                NaiveDate::from_ymd_opt(2026, 1, 10).unwrap(),
            ]
        );
    }

    #[test]
    fn test_every_n_weeks() {
        let sched = make_schedule("every_n", "2026-01-05", Some(2), Some("week"), None, None, None);
        let from = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 2, 28).unwrap();
        let dates = compute_occurrences(&sched, from, to);
        assert_eq!(
            dates,
            vec![
                NaiveDate::from_ymd_opt(2026, 1, 5).unwrap(),
                NaiveDate::from_ymd_opt(2026, 1, 19).unwrap(),
                NaiveDate::from_ymd_opt(2026, 2, 2).unwrap(),
                NaiveDate::from_ymd_opt(2026, 2, 16).unwrap(),
            ]
        );
    }

    #[test]
    fn test_every_n_months() {
        let sched = make_schedule("every_n", "2026-01-31", Some(1), Some("month"), None, None, None);
        let from = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 4, 30).unwrap();
        let dates = compute_occurrences(&sched, from, to);
        // Jan 31, Feb 28 (clamped), Mar 31, Apr 30 (clamped)
        assert_eq!(
            dates,
            vec![
                NaiveDate::from_ymd_opt(2026, 1, 31).unwrap(),
                NaiveDate::from_ymd_opt(2026, 2, 28).unwrap(),
                NaiveDate::from_ymd_opt(2026, 3, 28).unwrap(),
                NaiveDate::from_ymd_opt(2026, 4, 28).unwrap(),
            ]
        );
    }

    #[test]
    fn test_day_of_week() {
        // Every Monday and Wednesday
        let sched = make_schedule("day_of_week", "2026-02-01", None, None, Some(vec![1, 3]), None, None);
        let from = NaiveDate::from_ymd_opt(2026, 2, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 2, 10).unwrap();
        let dates = compute_occurrences(&sched, from, to);
        // Feb 1 = Sun, Feb 2 = Mon, Feb 4 = Wed, Feb 9 = Mon
        assert_eq!(
            dates,
            vec![
                NaiveDate::from_ymd_opt(2026, 2, 2).unwrap(),  // Mon
                NaiveDate::from_ymd_opt(2026, 2, 4).unwrap(),  // Wed
                NaiveDate::from_ymd_opt(2026, 2, 9).unwrap(),  // Mon
            ]
        );
    }

    #[test]
    fn test_ordinal_weekday_second_tuesday() {
        // 2nd Tuesday of every month
        let sched = make_schedule("ordinal_weekday", "2026-01-01", None, None, None, Some(2), Some(2));
        let from = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 3, 31).unwrap();
        let dates = compute_occurrences(&sched, from, to);
        assert_eq!(
            dates,
            vec![
                NaiveDate::from_ymd_opt(2026, 1, 13).unwrap(),
                NaiveDate::from_ymd_opt(2026, 2, 10).unwrap(),
                NaiveDate::from_ymd_opt(2026, 3, 10).unwrap(),
            ]
        );
    }

    #[test]
    fn test_ordinal_weekday_last_friday() {
        // Last Friday of every month
        let sched = make_schedule("ordinal_weekday", "2026-01-01", None, None, None, Some(-1), Some(5));
        let from = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 3, 31).unwrap();
        let dates = compute_occurrences(&sched, from, to);
        assert_eq!(
            dates,
            vec![
                NaiveDate::from_ymd_opt(2026, 1, 30).unwrap(),
                NaiveDate::from_ymd_opt(2026, 2, 27).unwrap(),
                NaiveDate::from_ymd_opt(2026, 3, 27).unwrap(),
            ]
        );
    }

    #[test]
    fn test_max_occurrences() {
        let mut sched = make_schedule("every_n", "2026-01-01", Some(1), Some("day"), None, None, None);
        sched.max_occurrences = Some(3);
        let from = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 1, 31).unwrap();
        let dates = compute_occurrences(&sched, from, to);
        assert_eq!(dates.len(), 3);
    }

    #[test]
    fn test_end_date() {
        let mut sched = make_schedule("every_n", "2026-01-01", Some(1), Some("week"), None, None, None);
        sched.end_date = Some("2026-01-20".to_string());
        let from = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 2, 28).unwrap();
        let dates = compute_occurrences(&sched, from, to);
        assert_eq!(
            dates,
            vec![
                NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2026, 1, 8).unwrap(),
                NaiveDate::from_ymd_opt(2026, 1, 15).unwrap(),
            ]
        );
    }

    #[test]
    fn test_add_months_clamping() {
        // Jan 31 + 1 month → Feb 28 (2026 is not a leap year)
        let d = NaiveDate::from_ymd_opt(2026, 1, 31).unwrap();
        assert_eq!(add_months(d, 1), NaiveDate::from_ymd_opt(2026, 2, 28).unwrap());

        // Mar 31 + 1 month → Apr 30
        let d2 = NaiveDate::from_ymd_opt(2026, 3, 31).unwrap();
        assert_eq!(add_months(d2, 1), NaiveDate::from_ymd_opt(2026, 4, 30).unwrap());
    }

    #[test]
    fn test_nth_weekday_of_month() {
        // 1st Monday of Jan 2026: Jan 5
        assert_eq!(
            nth_weekday_of_month(2026, 1, Weekday::Mon, 1),
            Some(NaiveDate::from_ymd_opt(2026, 1, 5).unwrap())
        );
        // Last Sunday of Jan 2026: Jan 25
        assert_eq!(
            nth_weekday_of_month(2026, 1, Weekday::Sun, -1),
            Some(NaiveDate::from_ymd_opt(2026, 1, 25).unwrap())
        );
    }
}
