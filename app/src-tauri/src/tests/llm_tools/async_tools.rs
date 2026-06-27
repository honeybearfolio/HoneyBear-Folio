use crate::core::llm_tools::{execute_tool, tool_get_portfolio_holdings};
use crate::create_account_db;
use crate::tests::common::setup_db;
use crate::CreateTransactionArgs;
use rusqlite::Connection;
use serde_json::json;

#[tokio::test]
async fn test_tool_get_portfolio_holdings_uses_cached_quotes() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Broker".to_string(), 10000.0, None, None).unwrap();

    crate::create_transaction_db(
        &db_path,
        CreateTransactionArgs {
            account_id: account.id,
            date: "2024-01-01".to_string(),
            payee: "Buy".to_string(),
            notes: None,
            category: Some("Invest".to_string()),
            amount: -1500.0,
            ticker: Some("AAPL".to_string()),
            shares: Some(10.0),
            price_per_share: Some(150.0),
            fee: Some(0.0),
            currency: Some("USD".to_string()),
        },
    )
    .unwrap();

    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "INSERT INTO stock_prices (ticker, price, last_updated) VALUES ('AAPL', 200.0, datetime('now'))",
        [],
    )
    .unwrap();

    let client = reqwest::Client::builder().build().unwrap();
    let result = tool_get_portfolio_holdings(&client, &db_path, &json!({}))
        .await
        .unwrap();
    assert_eq!(result["holdings"].as_array().unwrap().len(), 1);
    assert_eq!(result["totals"]["total_value"].as_f64().unwrap(), 2000.0);
}

#[tokio::test]
async fn test_execute_tool_get_net_worth() {
    let (_dir, db_path) = setup_db();
    create_account_db(&db_path, "Cash".to_string(), 5000.0, None, None).unwrap();

    let client = reqwest::Client::builder().build().unwrap();
    let snapshot = execute_tool(&client, &db_path, "get_net_worth", &json!({}))
        .await
        .unwrap();
    assert_eq!(snapshot["target_currency"], "USD");
    assert!(snapshot["total_net_worth"].as_f64().unwrap() >= 5000.0);
}

#[tokio::test]
async fn test_execute_tool_get_portfolio_and_assets() {
    let (_dir, db_path) = setup_db();
    let client = reqwest::Client::builder().build().unwrap();

    let assets = execute_tool(&client, &db_path, "get_assets", &json!({}))
        .await
        .unwrap();
    assert!(assets.as_array().unwrap().is_empty());

    let total = execute_tool(&client, &db_path, "get_total_assets_value", &json!({}))
        .await
        .unwrap();
    assert_eq!(total["total_value"].as_f64().unwrap(), 0.0);

    let holdings = execute_tool(&client, &db_path, "get_portfolio_holdings", &json!({}))
        .await
        .unwrap();
    assert!(holdings["holdings"].as_array().unwrap().is_empty());
}
