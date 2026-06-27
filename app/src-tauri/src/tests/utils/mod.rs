use crate::utils::get_system_theme;
use crate::{calculate_account_balances, Account, create_account_db, get_custom_exchange_rate_db,
    set_custom_exchange_rate_db};
use crate::core::utils::{delete_custom_exchange_rate_db, get_all_exchange_rates_db,
    get_custom_rates_map};
use std::collections::HashMap;
use tempfile::tempdir;

#[test]
fn test_get_system_theme_returns_dark_or_light() {
    let theme = get_system_theme().unwrap();
    assert!(theme == "dark" || theme == "light");
}

#[test]
fn test_same_currency_rate_is_one() {
    let accounts = vec![Account {
        id: 1,
        name: "USD".to_string(),
        balance: 0.0,
        currency: Some("USD".to_string()),
        exchange_rate: 1.0,
    }];
    let raw_data = vec![(1, "USD".to_string(), 500.0)];
    let updated = calculate_account_balances(
        accounts,
        raw_data,
        "USD",
        &HashMap::new(),
        &HashMap::new(),
    );
    assert_eq!(updated[0].balance, 500.0);
    assert_eq!(updated[0].exchange_rate, 1.0);
}

#[test]
fn test_account_without_currency_uses_target() {
    let accounts = vec![Account {
        id: 1,
        name: "NoCurr".to_string(),
        balance: 0.0,
        currency: None,
        exchange_rate: 1.0,
    }];
    let raw_data = vec![(1, "EUR".to_string(), 100.0)];
    let mut rates = HashMap::new();
    rates.insert("EURUSD=X".to_string(), 1.1);
    let updated = calculate_account_balances(
        accounts,
        raw_data,
        "USD",
        &rates,
        &HashMap::new(),
    );
    assert!((updated[0].balance - 110.0).abs() < 1e-6);
    assert_eq!(updated[0].exchange_rate, 1.0);
}

#[test]
fn test_zero_dst_rate_fallback() {
    let accounts = vec![Account {
        id: 1,
        name: "GBP".to_string(),
        balance: 0.0,
        currency: Some("GBP".to_string()),
        exchange_rate: 1.0,
    }];
    let raw_data = vec![(1, "EUR".to_string(), 100.0)];
    let mut custom_rates = HashMap::new();
    custom_rates.insert("EUR".to_string(), 1.2);
    custom_rates.insert("GBP".to_string(), 0.0);
    let updated = calculate_account_balances(
        accounts,
        raw_data,
        "USD",
        &HashMap::new(),
        &custom_rates,
    );
    // r_dst == 0.0 triggers fallback rate of 1.0 inside compute_rate
    assert!((updated[0].balance - 100.0).abs() < 1e-6);
}

#[test]
fn test_get_all_exchange_rates_db_merges_custom_and_account_currencies() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("rates.db");
    crate::init_db_at_path(&db_path).unwrap();

    create_account_db(
        &db_path,
        "Euro".to_string(),
        0.0,
        Some("EUR".to_string()),
        None,
    )
    .unwrap();
    create_account_db(
        &db_path,
        "Pound".to_string(),
        0.0,
        Some("GBP".to_string()),
        None,
    )
    .unwrap();
    set_custom_exchange_rate_db(&db_path, "EUR".to_string(), 1.08).unwrap();

    let entries = get_all_exchange_rates_db(&db_path, Some("JPY".to_string())).unwrap();
    let eur = entries.iter().find(|e| e.currency == "EUR").unwrap();
    assert!(eur.is_custom);
    assert_eq!(eur.rate, 1.08);

    let gbp = entries.iter().find(|e| e.currency == "GBP").unwrap();
    assert!(!gbp.is_custom);
    assert_eq!(gbp.rate, 0.0);

    let jpy = entries.iter().find(|e| e.currency == "JPY").unwrap();
    assert!(!jpy.is_custom);
}

#[test]
fn test_get_custom_rates_map_empty_db() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("empty.db");
    crate::init_db_at_path(&db_path).unwrap();
    let map = get_custom_rates_map(&db_path).unwrap();
    assert!(map.is_empty());
}

#[test]
fn test_delete_custom_exchange_rate_db() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("del.db");
    crate::init_db_at_path(&db_path).unwrap();
    set_custom_exchange_rate_db(&db_path, "CHF".to_string(), 1.15).unwrap();
    delete_custom_exchange_rate_db(&db_path, "CHF".to_string()).unwrap();
    assert_eq!(
        get_custom_exchange_rate_db(&db_path, "CHF".to_string()).unwrap(),
        None
    );
}
