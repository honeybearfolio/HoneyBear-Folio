use super::common::setup_db;

#[test]
fn test_create_account_rejects_empty_name() {
    let (_dir, db_path) = setup_db();
    let err = crate::create_account_db(&db_path, "   ".to_string(), 0.0, None, None).unwrap_err();
    assert!(err.contains("empty"));
}

#[test]
fn test_create_account_rejects_duplicate_name() {
    let (_dir, db_path) = setup_db();
    crate::create_account_db(&db_path, "Savings".to_string(), 0.0, None, None).unwrap();
    let err =
        crate::create_account_db(&db_path, "savings".to_string(), 0.0, None, None).unwrap_err();
    assert!(err.contains("already exists"));
}

#[test]
fn test_rename_account_rejects_duplicate() {
    let (_dir, db_path) = setup_db();
    let a = crate::create_account_db(&db_path, "A".to_string(), 0.0, None, None).unwrap();
    crate::create_account_db(&db_path, "B".to_string(), 0.0, None, None).unwrap();
    let err = crate::rename_account_db(&db_path, a.id, "b".to_string()).unwrap_err();
    assert!(err.contains("already exists"));
}

#[test]
fn test_get_accounts_summary_with_multiple_currencies() {
    let (_dir, db_path) = setup_db();
    let eur = crate::create_account_db(
        &db_path,
        "Euro".to_string(),
        0.0,
        Some("EUR".to_string()),
        None,
    )
    .unwrap();

    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: eur.id,
            date: "2024-02-01".to_string(),
            payee: "Deposit".to_string(),
            notes: None,
            category: Some("Income".to_string()),
            amount: 500.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: Some("EUR".to_string()),
        },
    )
    .unwrap();

    let summary = crate::core::accounts::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(summary.raw_data.len(), 1);
    assert_eq!(summary.raw_data[0].1, "EUR");
}

#[test]
fn test_update_account_name_and_currency() {
    let (_dir, db_path) = setup_db();
    let account = crate::create_account_db(
        &db_path,
        "Savings".to_string(),
        100.0,
        Some("USD".to_string()),
        None,
    )
    .unwrap();

    let updated = crate::core::accounts::update_account_db(
        &db_path,
        account.id,
        "  Emergency Fund  ".to_string(),
        Some("EUR".to_string()),
    )
    .unwrap();

    assert_eq!(updated.name, "Emergency Fund");
    assert_eq!(updated.currency, Some("EUR".to_string()));
    assert_eq!(updated.balance, 100.0);
}

#[test]
fn test_update_account_rejects_empty_name() {
    let (_dir, db_path) = setup_db();
    let account = crate::create_account_db(&db_path, "Test".to_string(), 0.0, None, None).unwrap();
    let err =
        crate::core::accounts::update_account_db(&db_path, account.id, "   ".to_string(), None)
            .unwrap_err();
    assert!(err.contains("empty"));
}

#[test]
fn test_update_account_rejects_duplicate_name() {
    let (_dir, db_path) = setup_db();
    let a = crate::create_account_db(&db_path, "Alpha".to_string(), 0.0, None, None).unwrap();
    crate::create_account_db(&db_path, "Beta".to_string(), 0.0, None, None).unwrap();
    let err = crate::core::accounts::update_account_db(&db_path, a.id, "beta".to_string(), None)
        .unwrap_err();
    assert!(err.contains("already exists"));
}

#[test]
fn test_get_accounts_db_returns_all() {
    let (_dir, db_path) = setup_db();
    crate::create_account_db(&db_path, "One".to_string(), 1.0, None, None).unwrap();
    crate::create_account_db(&db_path, "Two".to_string(), 2.0, None, None).unwrap();

    let accounts = crate::core::accounts::get_accounts_db(&db_path).unwrap();
    assert_eq!(accounts.len(), 2);
}

#[test]
fn test_create_account_with_custom_initial_transaction() {
    let (_dir, db_path) = setup_db();
    let details = crate::core::accounts::InitialTransactionDetails {
        payee: "Opening".to_string(),
        notes: "From bank".to_string(),
        category: "Transfer".to_string(),
    };
    let account = crate::create_account_db(
        &db_path,
        "Checking".to_string(),
        500.0,
        Some("USD".to_string()),
        Some(details),
    )
    .unwrap();
    assert_eq!(account.balance, 500.0);

    let txs = crate::get_transactions_db(&db_path, account.id).unwrap();
    assert_eq!(txs.len(), 1);
    assert_eq!(txs[0].payee, "Opening");
    assert_eq!(txs[0].category.as_deref(), Some("Transfer"));
}

fn currency_amount(
    summary: &crate::models::AccountsSummary,
    account_id: i32,
    currency: &str,
) -> f64 {
    summary
        .raw_data
        .iter()
        .filter(|(id, code, _)| *id == account_id && code == currency)
        .map(|(_, _, amount)| *amount)
        .sum()
}

#[test]
fn test_summary_reads_currency_totals_updated_with_the_ledger() {
    let (_dir, db_path) = setup_db();
    let account = crate::create_account_db(
        &db_path,
        "Multi".to_string(),
        100.0,
        Some("USD".to_string()),
        None,
    )
    .unwrap();

    let opened = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&opened, account.id, "USD"), 100.0);

    let usd = crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: account.id,
            date: "2024-03-01".to_string(),
            payee: "Pay".to_string(),
            notes: None,
            category: Some("Income".to_string()),
            amount: 40.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: Some("USD".to_string()),
        },
    )
    .unwrap();
    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: account.id,
            date: "2024-03-02".to_string(),
            payee: "Shop".to_string(),
            notes: None,
            category: Some("Food".to_string()),
            amount: 25.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: Some("EUR".to_string()),
        },
    )
    .unwrap();

    let mixed = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&mixed, account.id, "USD"), 140.0);
    assert_eq!(currency_amount(&mixed, account.id, "EUR"), 25.0);

    crate::update_transaction_db(
        &db_path,
        crate::UpdateTransactionArgs {
            id: usd.id,
            account_id: account.id,
            date: "2024-03-01".to_string(),
            payee: "Pay".to_string(),
            notes: None,
            category: Some("Income".to_string()),
            amount: 10.0,
            currency: Some("EUR".to_string()),
        },
    )
    .unwrap();

    let moved = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&moved, account.id, "USD"), 100.0);
    assert_eq!(currency_amount(&moved, account.id, "EUR"), 35.0);

    // A ledger row written outside the app is invisible until reconcile.
    let conn = rusqlite::Connection::open(&db_path).unwrap();
    conn.execute(
        "INSERT INTO transactions (account_id, date, payee, amount, currency) VALUES (?1, '2024-03-03', 'Gift', 7.0, 'CAD')",
        rusqlite::params![account.id],
    )
    .unwrap();
    drop(conn);

    let before = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&before, account.id, "CAD"), 0.0);

    crate::reconcile_account_balances_db(&db_path).unwrap();
    let after = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&after, account.id, "USD"), 100.0);
    assert_eq!(currency_amount(&after, account.id, "EUR"), 35.0);
    assert_eq!(currency_amount(&after, account.id, "CAD"), 7.0);

    crate::delete_transaction_db(&db_path, usd.id).unwrap();
    let deleted = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&deleted, account.id, "EUR"), 25.0);
    assert_eq!(currency_amount(&deleted, account.id, "CAD"), 7.0);
}

#[test]
fn test_transfer_counterpart_uses_the_null_currency_bucket() {
    let (_dir, db_path) = setup_db();
    let source = crate::create_account_db(
        &db_path,
        "Source".to_string(),
        0.0,
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let target = crate::create_account_db(
        &db_path,
        "Target".to_string(),
        0.0,
        Some("EUR".to_string()),
        None,
    )
    .unwrap();

    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: source.id,
            date: "2024-04-01".to_string(),
            payee: target.name.clone(),
            notes: None,
            category: None,
            amount: -20.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: Some("EUR".to_string()),
        },
    )
    .unwrap();

    let as_gbp = crate::get_accounts_summary_db(&db_path, "GBP").unwrap();
    assert_eq!(currency_amount(&as_gbp, source.id, "EUR"), -20.0);
    assert_eq!(currency_amount(&as_gbp, target.id, "GBP"), 20.0);
    assert_eq!(currency_amount(&as_gbp, target.id, "USD"), 0.0);
}

#[test]
fn test_investment_writes_update_currency_total() {
    let (_dir, db_path) = setup_db();
    let account = crate::create_account_db(
        &db_path,
        "Broker".to_string(),
        0.0,
        Some("USD".to_string()),
        None,
    )
    .unwrap();

    let tx = crate::create_investment_transaction_db(
        &db_path,
        crate::CreateInvestmentTransactionArgs {
            account_id: account.id,
            date: "2024-05-01".to_string(),
            ticker: "AAPL".to_string(),
            shares: 2.0,
            price_per_share: 10.0,
            fee: 1.0,
            is_buy: true,
            currency: Some("USD".to_string()),
            payee: None,
            notes: None,
            category: None,
        },
    )
    .unwrap();

    let bought = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&bought, account.id, "USD"), -21.0);

    crate::update_investment_transaction_db(
        &db_path,
        crate::UpdateInvestmentTransactionArgs {
            id: tx.id,
            account_id: account.id,
            date: "2024-05-01".to_string(),
            ticker: "AAPL".to_string(),
            shares: 1.0,
            price_per_share: 10.0,
            fee: 1.0,
            is_buy: true,
            notes: None,
            currency: Some("EUR".to_string()),
        },
    )
    .unwrap();

    let moved = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&moved, account.id, "USD"), 0.0);
    assert_eq!(currency_amount(&moved, account.id, "EUR"), -11.0);

    crate::delete_transaction_db(&db_path, tx.id).unwrap();
    let deleted = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(currency_amount(&deleted, account.id, "EUR"), 0.0);
}
