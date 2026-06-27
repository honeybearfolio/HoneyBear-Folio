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
    let err = crate::create_account_db(&db_path, "savings".to_string(), 0.0, None, None).unwrap_err();
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
