use crate::{calculate_account_balances, Account};
use rusqlite::Connection;
use std::collections::HashMap;
use tempfile::tempdir;

#[test]
fn test_custom_rate_application() {
    let accounts = vec![Account {
        id: 1,
        name: "TestAcc".to_string(),
        balance: 0.0,
        currency: Some("EUR".to_string()),
        exchange_rate: 1.0,
    }];

    // Transaction: 100 EUR. Account: EUR. Target: USD.
    // Raw data: (acc_id, tx_curr, amount)
    let raw_data = vec![(1, "EUR".to_string(), 100.0)];

    let target = "USD";
    let rates = HashMap::new(); // No yahoo rates
    let mut custom_rates = HashMap::new();
    custom_rates.insert("EUR".to_string(), 1.1); // 1 EUR = 1.1 USD

    let updated = calculate_account_balances(accounts, raw_data, target, &rates, &custom_rates);

    // Account currency is EUR. Transaction is EUR. No conversion for balance sum inside account (100 EUR).
    assert_eq!(updated[0].balance, 100.0);

    // Exchange rate to target (USD).
    // Account is EUR. Target is USD.
    // Should use custom rate 1.1.
    assert!(
        (updated[0].exchange_rate - 1.1).abs() < 1e-6,
        "Exchange rate mismatch: expected 1.1, got {}",
        updated[0].exchange_rate
    );
}

#[test]
fn test_cross_rate_conversion() {
    // Account in GBP. Transaction in EUR. Target USD.
    // Custom rates: EUR=1.2 USD, GBP=1.5 USD.
    // Rate EUR->GBP = (EUR->USD) / (GBP->USD) = 1.2 / 1.5 = 0.8
    // Transaction amount 100 EUR -> 80 GBP.

    let accounts = vec![Account {
        id: 1,
        name: "GBP Acc".to_string(),
        balance: 0.0,
        currency: Some("GBP".to_string()),
        exchange_rate: 1.0,
    }];

    let raw_data = vec![(1, "EUR".to_string(), 100.0)];

    let target = "USD";
    let rates = HashMap::new();
    let mut custom_rates = HashMap::new();
    custom_rates.insert("EUR".to_string(), 1.2);
    custom_rates.insert("GBP".to_string(), 1.5);

    let updated = calculate_account_balances(accounts, raw_data, target, &rates, &custom_rates);

    assert_eq!(updated.len(), 1);
    // 100 * (1.2 / 1.5) = 100 * 0.8 = 80.0
    assert!(
        (updated[0].balance - 80.0).abs() < 1e-6,
        "Balance mismatch: expected 80.0, got {}",
        updated[0].balance
    );

    // Exchange rate GBP -> USD should be 1.5
    assert!(
        (updated[0].exchange_rate - 1.5).abs() < 1e-6,
        "Exchange rate mismatch: expected 1.5, got {}",
        updated[0].exchange_rate
    );
}

#[test]
fn test_direct_rate_priority() {
    // Account in GBP. Transaction in EUR.
    // Provide direct rate EURGBP=X in rates.
    // Also provide custom rates for USD pivots.
    // Should prefer direct rate.

    let accounts = vec![Account {
        id: 1,
        name: "GBP Acc".to_string(),
        balance: 0.0,
        currency: Some("GBP".to_string()),
        exchange_rate: 1.0,
    }];

    let raw_data = vec![(1, "EUR".to_string(), 100.0)];

    let target = "USD";
    let mut rates = HashMap::new();
    // Direct rate EUR -> GBP = 0.9 (different from implied 0.8)
    rates.insert("EURGBP=X".to_string(), 0.9);

    let mut custom_rates = HashMap::new();
    // Even if these exist, direct rate should win for EUR -> GBP
    custom_rates.insert("EUR".to_string(), 1.2);
    custom_rates.insert("GBP".to_string(), 1.5);

    let updated = calculate_account_balances(accounts, raw_data, target, &rates, &custom_rates);

    // 100 * 0.9 = 90.0
    assert!(
        (updated[0].balance - 90.0).abs() < 1e-6,
        "Balance mismatch (direct rate): expected 90.0, got {}",
        updated[0].balance
    );
}

#[test]
fn test_fallback_when_direct_rate_missing() {
    // Account in GBP. Transaction in EUR.
    // Direct rate missing.
    // Provide Yahoo rates for pivots (EURUSD=X, GBPUSD=X).
    // Logic should use fallback pivot logic if direct is missing.

    let accounts = vec![Account {
        id: 1,
        name: "GBP Acc".to_string(),
        balance: 0.0,
        currency: Some("GBP".to_string()),
        exchange_rate: 1.0,
    }];

    let raw_data = vec![(1, "EUR".to_string(), 100.0)];

    let target = "USD";
    let mut rates = HashMap::new();
    rates.insert("EURUSD=X".to_string(), 1.2);
    rates.insert("GBPUSD=X".to_string(), 1.5);

    let custom_rates = HashMap::new(); // Empty custom rates

    let updated = calculate_account_balances(accounts, raw_data, target, &rates, &custom_rates);

    // 100 * (1.2 / 1.5) = 80.0
    assert!(
        (updated[0].balance - 80.0).abs() < 1e-6,
        "Balance mismatch (pivot Yahoo): expected 80.0, got {}",
        updated[0].balance
    );
}

#[test]
fn test_get_custom_rates_map_returns_all_rows() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("rates.db");
    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "CREATE TABLE IF NOT EXISTS custom_exchange_rates (
            currency TEXT PRIMARY KEY,
            rate REAL NOT NULL
        )",
        [],
    )
    .unwrap();
    drop(conn);

    crate::set_custom_exchange_rate_db(&db_path, "EUR".to_string(), 1.25).unwrap();
    crate::set_custom_exchange_rate_db(&db_path, "JPY".to_string(), 0.0071).unwrap();

    let map = crate::utils::get_custom_rates_map(&db_path).unwrap();
    assert_eq!(map.len(), 2);
    assert_eq!(map.get("EUR"), Some(&1.25));
    assert_eq!(map.get("JPY"), Some(&0.0071));
}

#[test]
fn test_delete_custom_exchange_rate_db_removes_only_target_currency() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("rates.db");
    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "CREATE TABLE IF NOT EXISTS custom_exchange_rates (
            currency TEXT PRIMARY KEY,
            rate REAL NOT NULL
        )",
        [],
    )
    .unwrap();
    drop(conn);

    crate::set_custom_exchange_rate_db(&db_path, "EUR".to_string(), 1.25).unwrap();
    crate::set_custom_exchange_rate_db(&db_path, "GBP".to_string(), 1.41).unwrap();

    crate::utils::delete_custom_exchange_rate_db(&db_path, "EUR".to_string()).unwrap();

    assert_eq!(
        crate::get_custom_exchange_rate_db(&db_path, "EUR".to_string()).unwrap(),
        None
    );
    assert_eq!(
        crate::get_custom_exchange_rate_db(&db_path, "GBP".to_string()).unwrap(),
        Some(1.41)
    );
}
