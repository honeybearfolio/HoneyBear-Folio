use crate::core::assets::{create_asset_db, create_valuation_db};
use crate::core::liabilities::{create_liability_db, create_liability_valuation_db};
use crate::core::llm_tools::{
    compute_net_worth_snapshot_with_quotes, parse_target_currency, tool_get_asset_valuations,
    tool_get_assets, tool_get_liabilities, tool_get_liability_valuations,
    tool_get_total_assets_value, tool_get_total_liabilities_value,
};
use crate::models::YahooQuote;
use crate::tests::common::setup_db;
use rusqlite::Connection;
use serde_json::json;

#[test]
fn test_tool_get_assets_empty() {
    let (_dir, db_path) = setup_db();
    let result = tool_get_assets(&db_path, &json!({})).unwrap();
    assert_eq!(
        result.as_array().unwrap().as_slice(),
        &[] as &[serde_json::Value]
    );
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

    let valuations = tool_get_asset_valuations(&db_path, &json!({ "asset_id": asset_id })).unwrap();
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
fn test_tool_get_liabilities_empty() {
    let (_dir, db_path) = setup_db();
    let result = tool_get_liabilities(&db_path, &json!({})).unwrap();
    assert_eq!(
        result.as_array().unwrap().as_slice(),
        &[] as &[serde_json::Value]
    );
}

#[test]
fn test_tool_get_liabilities_with_valuation() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Mortgage".to_string(),
        "mortgage".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let liabilities = tool_get_liabilities(&db_path, &json!({ "target_currency": "USD" })).unwrap();
    let arr = liabilities.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["name"], "Mortgage");
    assert_eq!(arr[0]["category"], "mortgage");
}

#[test]
fn test_tool_get_liability_valuations() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Car Loan".to_string(),
        "auto_loan".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let liabilities = tool_get_liabilities(&db_path, &json!({})).unwrap();
    let liability_id = liabilities[0]["id"].as_i64().unwrap() as i32;

    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 20000.0)
        .unwrap();
    create_liability_valuation_db(&db_path, liability_id, "2024-06-01".to_string(), 18000.0)
        .unwrap();

    let valuations =
        tool_get_liability_valuations(&db_path, &json!({ "liability_id": liability_id })).unwrap();
    let arr = valuations.as_array().unwrap();
    assert_eq!(arr.len(), 2);
}

#[test]
fn test_tool_get_liability_valuations_requires_id() {
    let (_dir, db_path) = setup_db();
    let err = tool_get_liability_valuations(&db_path, &json!({})).unwrap_err();
    assert!(err.contains("liability_id"));
}

#[test]
fn test_tool_get_total_liabilities_value() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Credit Card".to_string(),
        "credit_card".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let liabilities = tool_get_liabilities(&db_path, &json!({})).unwrap();
    let liability_id = liabilities[0]["id"].as_i64().unwrap() as i32;
    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 3000.0)
        .unwrap();

    let result = tool_get_total_liabilities_value(&db_path, &json!({})).unwrap();
    assert_eq!(result["target_currency"], "USD");
    assert_eq!(result["total_value"].as_f64().unwrap(), 3000.0);
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
    create_liability_db(
        &db_path,
        "Mortgage".to_string(),
        "mortgage".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let liabilities = tool_get_liabilities(&db_path, &json!({})).unwrap();
    let liability_id = liabilities[0]["id"].as_i64().unwrap() as i32;
    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 50000.0)
        .unwrap();

    let quotes = vec![YahooQuote {
        symbol: "AAPL".to_string(),
        price: 200.0,
        change_percent: 0.0,
        currency: Some("USD".to_string()),
        quote_type: None,
    }];

    let snapshot = compute_net_worth_snapshot_with_quotes(&db_path, "USD", &quotes).unwrap();

    assert_eq!(snapshot["target_currency"], "USD");
    assert_eq!(snapshot["tracked_assets_total"].as_f64().unwrap(), 300000.0);
    assert_eq!(
        snapshot["tracked_liabilities_total"].as_f64().unwrap(),
        50000.0
    );
    // Account balance 1000 + 10 shares * $200 market value = 3000
    let accounts_total = snapshot["accounts_and_investments_total"].as_f64().unwrap();
    assert!((accounts_total - 3000.0).abs() < 0.01);
    assert!((snapshot["total_net_worth"].as_f64().unwrap() - 253000.0).abs() < 0.01);
}

#[test]
fn test_get_cached_quotes_db() {
    let (_dir, db_path) = setup_db();
    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "INSERT INTO stock_prices (ticker, price, last_updated) VALUES ('AAPL', 180.0, datetime('now'))",
        [],
    )
    .unwrap();

    let quotes = crate::core::llm_tools::get_cached_quotes_db(
        &db_path,
        &["AAPL".to_string(), "MSFT".to_string()],
    )
    .unwrap();
    assert_eq!(quotes.len(), 1);
    assert_eq!(quotes[0].symbol, "AAPL");
    assert_eq!(quotes[0].price, 180.0);

    let empty = crate::core::llm_tools::get_cached_quotes_db(&db_path, &[]).unwrap();
    assert!(empty.is_empty());
}

#[test]
fn test_get_exchange_rates_db() {
    let (_dir, db_path) = setup_db();
    crate::set_custom_exchange_rate_db(&db_path, "EUR".to_string(), 1.1).unwrap();
    let rates = crate::core::llm_tools::get_exchange_rates_db(&db_path).unwrap();
    assert_eq!(rates.len(), 1);
    assert_eq!(rates[0]["currency"], "EUR");
}

#[tokio::test]
async fn test_execute_tool_get_accounts_and_transactions() {
    let (_dir, db_path) = setup_db();
    let client = reqwest::Client::new();

    crate::create_account_db(&db_path, "Main".to_string(), 500.0, None, None).unwrap();
    let accounts = crate::get_accounts_db(&db_path).unwrap();
    let account_id = accounts[0].id;

    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id,
            date: "2024-01-15".to_string(),
            payee: "Grocery".to_string(),
            notes: None,
            category: Some("Food".to_string()),
            amount: -45.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();

    let tool_accounts =
        crate::core::llm_tools::execute_tool(&client, &db_path, "get_accounts", &json!({}))
            .await
            .unwrap();
    assert_eq!(tool_accounts.as_array().unwrap().len(), 1);

    let tool_txs = crate::core::llm_tools::execute_tool(
        &client,
        &db_path,
        "get_transactions",
        &json!({
            "account_id": account_id,
            "category": "Food",
            "payee": "gro",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "limit": 10
        }),
    )
    .await
    .unwrap();
    assert_eq!(tool_txs.as_array().unwrap().len(), 1);

    let cats =
        crate::core::llm_tools::execute_tool(&client, &db_path, "get_categories", &json!({}))
            .await
            .unwrap();
    assert!(cats.as_array().unwrap().contains(&json!("Food")));

    let payees = crate::core::llm_tools::execute_tool(&client, &db_path, "get_payees", &json!({}))
        .await
        .unwrap();
    assert!(payees.as_array().unwrap().contains(&json!("Grocery")));
}

#[tokio::test]
async fn test_chat_transaction_filters_preserve_order_and_unicode() {
    let (_dir, db_path) = setup_db();
    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "INSERT INTO accounts (name, balance, archived) VALUES ('Active', 0, 0)",
        [],
    )
    .unwrap();
    let account = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO accounts (name, balance, archived) VALUES ('Archived', 0, 1)",
        [],
    )
    .unwrap();
    let archived = conn.last_insert_rowid();
    for (id, date, payee, category) in [
        (account, "2024-01-01", "CAFÉ 100%_shop", Some("ÉPICERIE")),
        (account, "2024-02-01", "CAFÉ 100%_shop", Some("ÉPICERIE")),
        (account, "2024-02-01", "CAFÉ 100%_shop", Some("ÉPICERIE")),
        (account, "2024-03-01", "Other", None),
        (archived, "2024-04-01", "CAFÉ 100%_shop", Some("ÉPICERIE")),
    ] {
        conn.execute(
            "INSERT INTO transactions (account_id, date, payee, category, amount) VALUES (?1, ?2, ?3, ?4, 0)",
            rusqlite::params![id, date, payee, category],
        ).unwrap();
    }
    let client = reqwest::Client::new();
    let query = |args| {
        let client = &client;
        let db_path = &db_path;
        async move {
            crate::core::llm_tools::execute_tool(client, db_path, "get_transactions", &args)
                .await
                .unwrap()
        }
    };
    let result = query(json!({
        "account_id": account, "category": "épicerie", "payee": "café 100%_",
        "start_date": "2024-01-01", "end_date": "2024-02-01", "limit": 1
    }))
    .await;
    assert_eq!(result.as_array().unwrap().len(), 1);
    assert_eq!(result[0]["id"], 3);
    assert_eq!(query(json!({"limit": 0})).await, json!([]));
    assert_eq!(query(json!({"category": ""})).await, json!([]));
    assert_eq!(query(json!({"account_id": i64::MAX})).await, json!([]));
    assert_eq!(
        query(json!({"payee": ""})).await.as_array().unwrap().len(),
        4
    );

    conn.execute(
        "INSERT INTO transactions (account_id, date, payee, category, amount)
         VALUES (?1, '2024-01-15', 'CAFÉ 100%_shop', 'ÉPICERIE', 'invalid')",
        [account],
    )
    .unwrap();
    assert_eq!(
        query(json!({"category": "épicerie", "limit": 1})).await[0]["id"],
        3
    );
    assert_eq!(query(json!({"category": "unmatched"})).await, json!([]));
}

#[test]
fn test_grouped_portfolio_matches_chronological_cost_basis() {
    use crate::core::calculations::build_holdings_from_transactions_logic;
    use crate::core::transactions::{get_all_transactions_db, get_portfolio_holdings_db};

    let (_dir, db_path) = setup_db();
    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "INSERT INTO accounts (name, balance, archived) VALUES ('One', 0, 0), ('Two', 0, 0), ('Old', 0, 1)",
        [],
    )
    .unwrap();
    for (account, date, ticker, shares, price, fee) in [
        (1, "2023-01-01", "CLOSED", Some(2.0), Some(5.0), Some(0.0)),
        (1, "2023-01-02", "CLOSED", Some(-2.0), None, None),
        (1, "2024-01-01", "AAPL", Some(10.0), Some(10.0), Some(2.0)),
        (2, "2024-01-02", "AAPL", Some(4.0), Some(20.0), Some(1.0)),
        (1, "2024-01-02", "AAPL", Some(-3.0), None, None),
        (2, "2024-01-03", "AAPL", Some(2.0), Some(30.0), None),
        (1, "2024-01-03", "EMPTY", None, None, None),
        (3, "2020-01-01", "AAPL", Some(50.0), Some(1.0), None),
    ] {
        conn.execute(
            "INSERT INTO transactions (account_id, date, payee, amount, ticker, shares, price_per_share, fee)
             VALUES (?1, ?2, 'Trade', 0, ?3, ?4, ?5, ?6)",
            rusqlite::params![account, date, ticker, shares, price, fee],
        ).unwrap();
    }
    let expected =
        build_holdings_from_transactions_logic(&get_all_transactions_db(&db_path).unwrap());
    let actual = get_portfolio_holdings_db(&db_path).unwrap();
    assert_eq!(actual.first_trade_date, expected.first_trade_date);
    assert_eq!(actual.current_holdings.len(), 1);
    assert_eq!(
        actual.current_holdings[0].ticker,
        expected.current_holdings[0].ticker
    );
    assert!(
        (actual.current_holdings[0].shares - expected.current_holdings[0].shares).abs() < 1e-10
    );
    assert!(
        (actual.current_holdings[0].cost_basis - expected.current_holdings[0].cost_basis).abs()
            < 1e-10
    );

    let quotes = vec![YahooQuote {
        symbol: "aapl".into(),
        price: 25.0,
        change_percent: 0.0,
        currency: None,
        quote_type: None,
    }];
    let expected = crate::calculations::compute_net_worth_market_values_logic(
        &get_all_transactions_db(&db_path).unwrap(),
        &quotes,
    );
    let actual = crate::calculations::compute_account_holdings_market_values_logic(
        &crate::transactions::get_account_holdings_db(&db_path).unwrap(),
        &quotes,
    );
    assert_eq!(actual, expected);
}

#[tokio::test]
async fn test_execute_tool_unknown_name_errors() {
    let (_dir, db_path) = setup_db();
    let client = reqwest::Client::new();
    let err =
        crate::core::llm_tools::execute_tool(&client, &db_path, "nonexistent_tool", &json!({}))
            .await
            .unwrap_err();
    assert!(err.contains("Unknown tool"));
}

#[tokio::test]
async fn test_execute_tool_get_exchange_rates() {
    let (_dir, db_path) = setup_db();
    crate::set_custom_exchange_rate_db(&db_path, "GBP".to_string(), 1.27).unwrap();

    let client = reqwest::Client::new();
    let rates =
        crate::core::llm_tools::execute_tool(&client, &db_path, "get_exchange_rates", &json!({}))
            .await
            .unwrap();
    let arr = rates.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["currency"], "GBP");
}

#[tokio::test]
async fn test_execute_tool_get_rules_and_scheduled() {
    let (_dir, db_path) = setup_db();
    let client = reqwest::Client::new();

    let rules = crate::core::llm_tools::execute_tool(&client, &db_path, "get_rules", &json!({}))
        .await
        .unwrap();
    assert_eq!(
        rules.as_array().unwrap().as_slice(),
        &[] as &[serde_json::Value]
    );

    let sched = crate::core::llm_tools::execute_tool(
        &client,
        &db_path,
        "get_scheduled_transactions",
        &json!({}),
    )
    .await
    .unwrap();
    assert_eq!(
        sched.as_array().unwrap().as_slice(),
        &[] as &[serde_json::Value]
    );
}

mod async_tools;
