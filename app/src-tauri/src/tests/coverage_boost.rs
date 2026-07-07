use crate::core::assets::{create_asset_db, create_valuation_db};
use crate::core::llm::build_system_prompt_for_test;
use crate::core::llm::{
    create_conversation_db, delete_all_conversations_db, get_conversation_messages_db,
    save_message_db_for_test,
};
use crate::tests::common::setup_db;
use crate::{calculate_account_balances, Account, CreateTransactionArgs};
use rusqlite::Connection;
use serde_json::json;
use std::collections::HashMap;

#[test]
fn test_build_system_prompt_includes_asset_valuation_details() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "Painting".to_string(),
        "art".to_string(),
        Some("EUR".to_string()),
        None,
    )
    .unwrap();
    let asset_id = crate::get_assets_db(&db_path, None).unwrap()[0].id;
    create_valuation_db(&db_path, asset_id, "2024-06-01".to_string(), 12000.0).unwrap();

    let prompt = build_system_prompt_for_test(&db_path);
    assert!(prompt.contains("Painting"));
    assert!(prompt.contains("12000.00"));
    assert!(prompt.contains("2024-06-01"));
}

#[test]
fn test_conversation_messages_with_tool_calls() {
    let (_dir, db_path) = setup_db();
    let conv = create_conversation_db(&db_path, "Tools".to_string()).unwrap();

    save_message_db_for_test(
        &db_path,
        conv.id,
        "assistant",
        None,
        Some(r#"[{"name":"get_accounts"}]"#),
        Some("call-1"),
        None,
    )
    .unwrap();

    let messages = get_conversation_messages_db(&db_path, conv.id).unwrap();
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].tool_call_id.as_deref(), Some("call-1"));
    assert!(messages[0].tool_calls.is_some());

    delete_all_conversations_db(&db_path).unwrap();
    assert!(get_conversation_messages_db(&db_path, conv.id).unwrap().is_empty());
}

#[test]
fn test_create_account_zero_balance_skips_opening_transaction() {
    let (_dir, db_path) = setup_db();
    let account =
        crate::create_account_db(&db_path, "Empty".to_string(), 0.0, Some("USD".to_string()), None)
            .unwrap();
    let txs = crate::get_transactions_db(&db_path, account.id).unwrap();
    assert!(txs.is_empty());
}

#[test]
fn test_get_accounts_summary_uses_target_for_null_transaction_currency() {
    let (_dir, db_path) = setup_db();
    let account = crate::create_account_db(
        &db_path,
        "Cash".to_string(),
        0.0,
        Some("USD".to_string()),
        None,
    )
    .unwrap();

    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "INSERT INTO transactions (account_id, date, payee, amount) VALUES (?1, '2024-01-01', 'Gift', 50.0)",
        rusqlite::params![account.id],
    )
    .unwrap();

    let summary = crate::get_accounts_summary_db(&db_path, "EUR").unwrap();
    assert_eq!(summary.raw_data.len(), 1);
    assert_eq!(summary.raw_data[0].1, "EUR");
}

#[test]
fn test_calculate_account_balances_uses_yahoo_rate_for_non_custom_currency() {
    let accounts = vec![Account {
        id: 1,
        name: "EUR".to_string(),
        balance: 0.0,
        currency: Some("EUR".to_string()),
        exchange_rate: 1.0,
    }];
    let raw_data = vec![(1, "USD".to_string(), 100.0)];
    let mut rates = HashMap::new();
    rates.insert("EURUSD=X".to_string(), 1.08);
    let updated = calculate_account_balances(accounts, raw_data, "USD", &rates, &HashMap::new());
    // 100 USD converted into the EUR account via USD/EUR pivot (1 / 1.08)
    assert!((updated[0].balance - (100.0 / 1.08)).abs() < 1e-6);
    assert!((updated[0].exchange_rate - 1.08).abs() < 1e-6);
}

#[test]
fn test_calculate_account_balances_skips_zero_direct_rate() {
    let accounts = vec![Account {
        id: 1,
        name: "EUR".to_string(),
        balance: 0.0,
        currency: Some("EUR".to_string()),
        exchange_rate: 1.0,
    }];
    let raw_data = vec![(1, "GBP".to_string(), 100.0)];
    let mut rates = HashMap::new();
    rates.insert("GBPEUR=X".to_string(), 0.0);
    rates.insert("GBPUSD=X".to_string(), 1.25);
    rates.insert("EURUSD=X".to_string(), 1.1);
    let updated = calculate_account_balances(accounts, raw_data, "USD", &rates, &HashMap::new());
    assert!(updated[0].balance > 0.0);
}

#[tokio::test]
async fn test_execute_tool_transaction_filters_and_limit() {
    let (_dir, db_path) = setup_db();
    let account = crate::create_account_db(&db_path, "Main".to_string(), 0.0, None, None).unwrap();

    for (payee, amount, date) in [
        ("Alpha", -10.0, "2024-01-05"),
        ("Beta", -20.0, "2024-02-05"),
        ("Gamma", -30.0, "2024-03-05"),
    ] {
        crate::create_transaction_db(
            &db_path,
            CreateTransactionArgs {
                account_id: account.id,
                date: date.to_string(),
                payee: payee.to_string(),
                notes: None,
                category: Some("Food".to_string()),
                amount,
                ticker: None,
                shares: None,
                price_per_share: None,
                fee: None,
                currency: None,
            },
        )
        .unwrap();
    }

    let client = reqwest::Client::new();
    let filtered = crate::core::llm_tools::execute_tool(
        &client,
        &db_path,
        "get_transactions",
        &json!({
            "start_date": "2024-02-01",
            "end_date": "2024-12-31",
            "limit": 1
        }),
    )
    .await
    .unwrap();
    let arr = filtered.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["payee"], "Gamma");
}
