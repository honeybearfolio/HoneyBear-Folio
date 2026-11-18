use super::common::setup_db;

#[test]
fn test_create_transaction() {
    let (_dir, db_path) = setup_db();
    let account =
        crate::create_account_db(&db_path, "Test Account".to_string(), 100.0, None, None).unwrap();

    let tx = crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: account.id,
            date: "2023-01-01".to_string(),
            payee: "Payee".to_string(),
            notes: Some("Notes".to_string()),
            category: Some("Category".to_string()),
            amount: -50.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();

    assert_eq!(tx.amount, -50.0);

    let accounts = crate::get_accounts_db(&db_path).unwrap();
    assert_eq!(accounts[0].balance, 50.0); // 100 - 50
}

#[test]
fn test_create_transaction_with_currency_sets_transaction_currency() {
    let (_dir, db_path) = setup_db();
    let account = crate::create_account_db(
        &db_path,
        "CurTxAcct".to_string(),
        100.0,
        Some("GBP".to_string()),
        None,
    )
    .unwrap();

    let tx = crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: account.id,
            date: "2023-01-10".to_string(),
            payee: "Payee".to_string(),
            notes: Some("Notes".to_string()),
            category: Some("Category".to_string()),
            amount: -20.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: Some("GBP".to_string()),
        },
    )
    .unwrap();

    assert_eq!(tx.currency.as_deref(), Some("GBP"));

    let txs = crate::get_transactions_db(&db_path, account.id).unwrap();
    assert!(txs.iter().any(|t| t.currency.as_deref() == Some("GBP")));
}

#[test]
fn test_get_all_transactions() {
    let (_dir, db_path) = setup_db();
    let acc1 = crate::create_account_db(&db_path, "A1".to_string(), 100.0, None, None).unwrap();
    let acc2 = crate::create_account_db(&db_path, "A2".to_string(), 100.0, None, None).unwrap();

    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: acc1.id,
            date: "2023-01-01".to_string(),
            payee: "P1".to_string(),
            notes: None,
            category: None,
            amount: -10.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: acc2.id,
            date: "2023-01-02".to_string(),
            payee: "P2".to_string(),
            notes: None,
            category: None,
            amount: -20.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();

    let all = crate::get_all_transactions_db(&db_path).unwrap();
    // Both accounts had opening balance txs plus the two created txs => total 4
    assert_eq!(all.len(), 4);
    // There should be at least one transaction with date 2023-01-02
    assert!(all.iter().any(|t| t.date == "2023-01-02"));
}

fn add_dated(db_path: &std::path::PathBuf, account_id: i32, date: &str) {
    crate::create_transaction_db(
        db_path,
        crate::CreateTransactionArgs {
            account_id,
            date: date.to_string(),
            payee: "P".to_string(),
            notes: None,
            category: None,
            amount: -1.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
}

#[test]
fn test_transaction_date_bounds_span_active_accounts() {
    let (_dir, db_path) = setup_db();
    let empty = crate::get_transaction_date_bounds_db(&db_path).unwrap();
    assert_eq!(empty.min_date, None);
    assert_eq!(empty.max_date, None);

    let active = crate::create_account_db(&db_path, "Active".to_string(), 0.0, None, None).unwrap();
    let archived =
        crate::create_account_db(&db_path, "Archived".to_string(), 0.0, None, None).unwrap();

    add_dated(&db_path, active.id, "2021-02-02");
    add_dated(&db_path, active.id, "2020-05-01");
    add_dated(&db_path, archived.id, "2019-01-01");
    add_dated(&db_path, archived.id, "2024-12-31");

    let open = crate::get_transaction_date_bounds_db(&db_path).unwrap();
    assert_eq!(open.min_date.as_deref(), Some("2019-01-01"));
    assert_eq!(open.max_date.as_deref(), Some("2024-12-31"));

    crate::set_account_archived_db(&db_path, archived.id, true).unwrap();
    let active_only = crate::get_transaction_date_bounds_db(&db_path).unwrap();
    assert_eq!(active_only.min_date.as_deref(), Some("2020-05-01"));
    assert_eq!(active_only.max_date.as_deref(), Some("2021-02-02"));
}

fn trade(db_path: &std::path::PathBuf, account_id: i32, ticker: &str, shares: f64, is_buy: bool) {
    crate::create_investment_transaction_db(
        db_path,
        crate::CreateInvestmentTransactionArgs {
            account_id,
            date: "2023-01-03".to_string(),
            ticker: ticker.to_string(),
            shares,
            price_per_share: 10.0,
            fee: 0.0,
            is_buy,
            currency: None,
            payee: None,
            notes: None,
            category: None,
        },
    )
    .unwrap();
}

#[test]
fn test_get_account_holdings_sums_shares_by_account_and_ticker() {
    let (_dir, db_path) = setup_db();
    let active =
        crate::create_account_db(&db_path, "Brokerage".to_string(), 10_000.0, None, None).unwrap();
    let old = crate::create_account_db(&db_path, "Old Brokerage".to_string(), 10_000.0, None, None)
        .unwrap();

    trade(&db_path, active.id, "AAPL", 10.0, true);
    trade(&db_path, active.id, "AAPL", 3.0, false);
    trade(&db_path, active.id, "GOOG", 2.0, true);
    trade(&db_path, old.id, "MSFT", 4.0, true);
    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: active.id,
            date: "2023-01-04".to_string(),
            payee: "Groceries".to_string(),
            notes: None,
            category: Some("Food".to_string()),
            amount: -25.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    crate::set_account_archived_db(&db_path, old.id, true).unwrap();

    let holdings = crate::get_account_holdings_db(&db_path).unwrap();
    let active_holdings = holdings.get(&active.id.to_string()).unwrap();
    assert_eq!(active_holdings.get("AAPL"), Some(&7.0));
    assert_eq!(active_holdings.get("GOOG"), Some(&2.0));
    assert_eq!(active_holdings.len(), 2);
    assert!(!holdings.contains_key(&old.id.to_string()));
}
#[test]
fn test_create_transaction_transfer_details() {
    let (_dir, db_path) = setup_db();
    let acc1 = crate::create_account_db(&db_path, "A1".to_string(), 100.0, None, None).unwrap();
    let acc2 = crate::create_account_db(&db_path, "A2".to_string(), 0.0, None, None).unwrap();

    let tx = crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: acc1.id,
            date: "2023-01-05".to_string(),
            payee: acc2.name.clone(),
            notes: None,
            category: None,
            amount: -50.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    assert_eq!(tx.category.as_deref(), Some("Transfer"));

    // counterpart exists in acc2
    let txs2 = crate::get_transactions_db(&db_path, acc2.id).unwrap();
    assert_eq!(txs2.len(), 1);
    assert_eq!(txs2[0].amount, 50.0);
    assert_eq!(txs2[0].payee, acc1.name);
}

#[test]
fn test_get_transactions_ordering() {
    let (_dir, db_path) = setup_db();
    let acc = crate::create_account_db(&db_path, "Ord".to_string(), 0.0, None, None).unwrap();
    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: acc.id,
            date: "2023-01-01".to_string(),
            payee: "P1".to_string(),
            notes: None,
            category: None,
            amount: -10.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: acc.id,
            date: "2023-02-01".to_string(),
            payee: "P2".to_string(),
            notes: None,
            category: None,
            amount: -20.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    let txs = crate::get_transactions_db(&db_path, acc.id).unwrap();
    assert!(txs.len() >= 2);
    assert_eq!(txs[0].date, "2023-02-01");
    assert_eq!(txs[1].date, "2023-01-01");
}

#[test]
fn test_create_transaction_with_nonexistent_account_errors_due_to_foreign_key() {
    let (_dir, db_path) = setup_db();
    // creating a transaction with a non-existent account id should fail due to FK constraint
    let res = crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: -999,
            date: "2023-01-01".to_string(),
            payee: "Someone".to_string(),
            notes: None,
            category: Some("Food".to_string()),
            amount: -10.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    );
    assert!(res.is_err());

    // ensure no accounts were created with that id
    let accounts = crate::get_accounts_db(&db_path).unwrap();
    assert!(accounts.iter().all(|a| a.id != -999));
}

#[test]
fn test_create_transaction_preserves_nontransfer_category() {
    let (_dir, db_path) = setup_db();
    let acc = crate::create_account_db(&db_path, "A".to_string(), 100.0, None, None).unwrap();
    let tx = crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: acc.id,
            date: "2023-01-02".to_string(),
            payee: "NonAccountPayee".to_string(),
            notes: None,
            category: Some("Entertainment".to_string()),
            amount: -15.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    assert_eq!(tx.category.as_deref(), Some("Entertainment"));
}

#[test]
fn test_create_transaction_with_ticker_shares_price_fee() {
    let (_dir, db_path) = setup_db();
    let acc = crate::create_account_db(&db_path, "Invest".to_string(), 1000.0, None, None).unwrap();

    let tx = crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: acc.id,
            date: "2023-01-03".to_string(),
            payee: "Broker".to_string(),
            notes: Some("Bought shares".to_string()),
            category: Some("Investment".to_string()),
            amount: -1505.0,
            ticker: Some("AAPL".to_string()),
            shares: Some(10.0),
            price_per_share: Some(150.0),
            fee: Some(5.0),
            currency: None,
        },
    )
    .unwrap();

    // Returned transaction has the investment fields set
    assert_eq!(tx.ticker.as_deref(), Some("AAPL"));
    assert_eq!(tx.shares, Some(10.0));
    assert_eq!(tx.price_per_share, Some(150.0));
    assert_eq!(tx.fee, Some(5.0));

    // Persisted row should match
    let txs = crate::get_transactions_db(&db_path, acc.id).unwrap();
    let found = txs.iter().find(|t| t.id == tx.id).unwrap();
    assert_eq!(found.ticker, tx.ticker);
    assert_eq!(found.shares, tx.shares);
    assert_eq!(found.price_per_share, tx.price_per_share);
    assert_eq!(found.fee, tx.fee);

    // Account balance updated accordingly
    let account = crate::get_accounts_db(&db_path)
        .unwrap()
        .into_iter()
        .find(|a| a.id == acc.id)
        .unwrap();
    assert!((account.balance - (-505.0)).abs() < 1e-6);
}
