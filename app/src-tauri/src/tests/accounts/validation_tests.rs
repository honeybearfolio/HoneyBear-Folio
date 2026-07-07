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
