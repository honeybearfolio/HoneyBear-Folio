use crate::core::assets::{create_asset_db, create_valuation_db};
use crate::core::llm_tools::{
    compute_net_worth_snapshot_with_quotes, parse_target_currency, tool_get_asset_valuations,
    tool_get_assets, tool_get_total_assets_value,
};
use crate::models::YahooQuote;
use crate::tests::common::setup_db;
use rusqlite::Connection;
use serde_json::json;

#[test]
fn test_tool_get_assets_empty() {
    let (_dir, db_path) = setup_db();
    let result = tool_get_assets(&db_path, &json!({})).unwrap();
    assert!(result.as_array().unwrap().is_empty());
}

#[test]
fn test_tool_get_assets_with_valuation() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "House".to_string(),
        "real_estate".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let assets = tool_get_assets(&db_path, &json!({ "target_currency": "USD" })).unwrap();
    let arr = assets.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["name"], "House");
    assert_eq!(arr[0]["category"], "real_estate");
}

#[test]
fn test_tool_get_asset_valuations() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "Car".to_string(),
        "vehicle".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let assets = tool_get_assets(&db_path, &json!({})).unwrap();
    let asset_id = assets[0]["id"].as_i64().unwrap() as i32;

    create_valuation_db(&db_path, asset_id, "2024-01-01".to_string(), 25000.0).unwrap();
    create_valuation_db(&db_path, asset_id, "2024-06-01".to_string(), 22000.0).unwrap();

    let valuations =
        tool_get_asset_valuations(&db_path, &json!({ "asset_id": asset_id })).unwrap();
    let arr = valuations.as_array().unwrap();
    assert_eq!(arr.len(), 2);
}

#[test]
fn test_tool_get_asset_valuations_requires_id() {
    let (_dir, db_path) = setup_db();
    let err = tool_get_asset_valuations(&db_path, &json!({})).unwrap_err();
    assert!(err.contains("asset_id"));
}

#[test]
fn test_tool_get_total_assets_value() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "Ring".to_string(),
        "jewelry".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let assets = tool_get_assets(&db_path, &json!({})).unwrap();
    let asset_id = assets[0]["id"].as_i64().unwrap() as i32;
    create_valuation_db(&db_path, asset_id, "2024-01-01".to_string(), 5000.0).unwrap();

    let result = tool_get_total_assets_value(&db_path, &json!({})).unwrap();
    assert_eq!(result["target_currency"], "USD");
    assert_eq!(result["total_value"].as_f64().unwrap(), 5000.0);
}

#[test]
fn test_parse_target_currency_defaults_to_usd() {
    assert_eq!(parse_target_currency(&json!({})), "USD");
    assert_eq!(
        parse_target_currency(&json!({ "target_currency": "EUR" })),
        "EUR"
    );
}

#[test]
fn test_compute_net_worth_snapshot_with_quotes() {
    let (_dir, db_path) = setup_db();
    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "INSERT INTO accounts (name, balance, currency) VALUES ('Brokerage', 1000.0, 'USD')",
        [],
    )
    .unwrap();
    let account_id: i32 = conn.last_insert_rowid() as i32;
    conn.execute(
        "INSERT INTO transactions (account_id, date, payee, amount)
         VALUES (?1, '2023-12-01', 'Deposit', 2500.0)",
        rusqlite::params![account_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO transactions (account_id, date, payee, amount, ticker, shares, price_per_share)
         VALUES (?1, '2024-01-01', 'Buy AAPL', -1500.0, 'AAPL', 10.0, 150.0)",
        rusqlite::params![account_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO stock_prices (ticker, price, last_updated) VALUES ('AAPL', 200.0, datetime('now'))",
        [],
    )
    .unwrap();
    create_asset_db(
        &db_path,
        "House".to_string(),
        "real_estate".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let assets = tool_get_assets(&db_path, &json!({})).unwrap();
    let asset_id = assets[0]["id"].as_i64().unwrap() as i32;
    create_valuation_db(&db_path, asset_id, "2024-01-01".to_string(), 300000.0).unwrap();

    let quotes = vec![YahooQuote {
        symbol: "AAPL".to_string(),
        price: 200.0,
        change_percent: 0.0,
        currency: Some("USD".to_string()),
        quote_type: None,
    }];

    let snapshot =
        compute_net_worth_snapshot_with_quotes(&db_path, "USD", &quotes).unwrap();

    assert_eq!(snapshot["target_currency"], "USD");
    assert_eq!(snapshot["tracked_assets_total"].as_f64().unwrap(), 300000.0);
    // Account balance 1000 + 10 shares * $200 market value = 3000
    let accounts_total = snapshot["accounts_and_investments_total"]
        .as_f64()
        .unwrap();
    assert!((accounts_total - 3000.0).abs() < 0.01);
    assert!((snapshot["total_net_worth"].as_f64().unwrap() - 303000.0).abs() < 0.01);
}
