use crate::models::ScheduledTransaction;
use crate::core::scheduled::compute_occurrences;
use chrono::NaiveDate;

fn create_base_schedule() -> ScheduledTransaction {
    ScheduledTransaction {
        id: 1,
        account_id: 1,
        payee: "Test Payee".to_string(),
        amount: 100.0,
        category: Some("Test Category".to_string()),
        notes: None,
        currency: Some("USD".to_string()),
        recurrence_type: "every_n".to_string(),
        interval_value: Some(1),
        interval_unit: Some("month".to_string()),
        days_of_week: None,
        ordinal: None,
        weekday: None,
        start_date: "2023-01-01".to_string(),
        end_date: None,
        max_occurrences: None,
        occurrences_count: 0,
        last_applied_date: None,
        enabled: true,
    }
}

#[test]
fn test_every_n_months() {
    let mut schedule = create_base_schedule();
    schedule.recurrence_type = "every_n".to_string();
    schedule.interval_value = Some(1);
    schedule.interval_unit = Some("month".to_string());
    schedule.start_date = "2023-01-01".to_string();

    let from = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
    let to = NaiveDate::from_ymd_opt(2023, 4, 1).unwrap();

    let dates = compute_occurrences(&schedule, from, to);
    assert_eq!(dates.len(), 4);
    assert_eq!(dates[0], NaiveDate::from_ymd_opt(2023, 1, 1).unwrap());
    assert_eq!(dates[1], NaiveDate::from_ymd_opt(2023, 2, 1).unwrap());
    assert_eq!(dates[2], NaiveDate::from_ymd_opt(2023, 3, 1).unwrap());
    assert_eq!(dates[3], NaiveDate::from_ymd_opt(2023, 4, 1).unwrap());
}

#[test]
fn test_every_n_days() {
    let mut schedule = create_base_schedule();
    schedule.recurrence_type = "every_n".to_string();
    schedule.interval_value = Some(10);
    schedule.interval_unit = Some("day".to_string());
    schedule.start_date = "2023-01-01".to_string();

    let from = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
    let to = NaiveDate::from_ymd_opt(2023, 1, 31).unwrap();

    let dates = compute_occurrences(&schedule, from, to);
    // 2023-01-01, 2023-01-11, 2023-01-21, 2023-01-31
    assert_eq!(dates.len(), 4);
    assert_eq!(dates[0], NaiveDate::from_ymd_opt(2023, 1, 1).unwrap());
    assert_eq!(dates[1], NaiveDate::from_ymd_opt(2023, 1, 11).unwrap());
    assert_eq!(dates[2], NaiveDate::from_ymd_opt(2023, 1, 21).unwrap());
    assert_eq!(dates[3], NaiveDate::from_ymd_opt(2023, 1, 31).unwrap());
}

#[test]
fn test_day_of_week() {
    let mut schedule = create_base_schedule();
    schedule.recurrence_type = "day_of_week".to_string();
    // Monday (1) and Wednesday (3)
    schedule.days_of_week = Some(vec![1, 3]);
    schedule.start_date = "2023-01-01".to_string(); // Sunday

    let from = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
    let to = NaiveDate::from_ymd_opt(2023, 1, 7).unwrap(); // 1 week

    let dates = compute_occurrences(&schedule, from, to);
    // Jan 1: Sun (no)
    // Jan 2: Mon (yes)
    // Jan 3: Tue (no)
    // Jan 4: Wed (yes)
    // Jan 5: Thu (no)
    // Jan 6: Fri (no)
    // Jan 7: Sat (no)

    assert_eq!(dates.len(), 2);
    assert_eq!(dates[0], NaiveDate::from_ymd_opt(2023, 1, 2).unwrap());
    assert_eq!(dates[1], NaiveDate::from_ymd_opt(2023, 1, 4).unwrap());
}

#[test]
fn test_ordinal_weekday() {
    let mut schedule = create_base_schedule();
    schedule.recurrence_type = "ordinal_weekday".to_string();
    schedule.ordinal = Some(2); // 2nd
    schedule.weekday = Some(5); // Friday
    schedule.start_date = "2023-01-01".to_string();

    let from = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
    let to = NaiveDate::from_ymd_opt(2023, 3, 31).unwrap();

    let dates = compute_occurrences(&schedule, from, to);
    // Jan 2023: 1st Fri is Jan 6, 2nd Fri is Jan 13
    // Feb 2023: 1st Fri is Feb 3, 2nd Fri is Feb 10
    // Mar 2023: 1st Fri is Mar 3, 2nd Fri is Mar 10

    assert_eq!(dates.len(), 3);
    assert_eq!(dates[0], NaiveDate::from_ymd_opt(2023, 1, 13).unwrap());
    assert_eq!(dates[1], NaiveDate::from_ymd_opt(2023, 2, 10).unwrap());
    assert_eq!(dates[2], NaiveDate::from_ymd_opt(2023, 3, 10).unwrap());
}

#[test]
fn test_max_occurrences_limit() {
    let mut schedule = create_base_schedule();
    schedule.recurrence_type = "every_n".to_string();
    schedule.interval_value = Some(1);
    schedule.interval_unit = Some("month".to_string());
    schedule.start_date = "2023-01-01".to_string();
    schedule.max_occurrences = Some(3); // Only 3 total allowed
    // Suppose 1 already happened
    schedule.occurrences_count = 1;

    let from = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
    let to = NaiveDate::from_ymd_opt(2023, 6, 1).unwrap();

    // Occurrences logic handles `occurrences_count`. 
    // It should skip the ones already counted? 
    // Wait, `compute_occurrences` logic needs to be checked.
    // Reading code of `compute_occurrences` showed it reads `max_occurrences` but it *doesn't* seem to subtract `occurrences_count` automatically unless logic inside does it.
    // Let's re-read the implementation to be sure.
    // Based on `app/src-tauri/src/core/scheduled.rs`:
    // It iterates and checks: `if let Some(max) = schedule.max_occurrences { if count >= max { break; } }`
    // where `count` is local counter starting at 0? Or is it `schedule.occurrences_count`?
    // I need to verify that.
}
