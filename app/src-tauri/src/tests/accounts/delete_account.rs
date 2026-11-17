use super::common::setup_db;

#[test]
fn test_delete_account() {
    let (_dir, db_path) = setup_db();
    let account =
        crate::create_account_db(&db_path, "ToDelete".to_string(), 100.0, None, None).unwrap();
    crate::delete_account_db(&db_path, account.id).unwrap();
    let accounts = crate::get_accounts_db(&db_path).unwrap();
    assert!(accounts.is_empty());
}

#[test]
fn test_delete_account_with_transactions() {
    let (_dir, db_path) = setup_db();
    let account =
        crate::create_account_db(&db_path, "ToDelete".to_string(), 100.0, None, None).unwrap();
    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: account.id,
            date: "2023-01-02".to_string(),
            payee: "Payee".to_string(),
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
    let txs_before = crate::get_transactions_db(&db_path, account.id).unwrap();
    assert!(!txs_before.is_empty());

    crate::delete_account_db(&db_path, account.id).unwrap();

    let accounts = crate::get_accounts_db(&db_path).unwrap();
    assert!(accounts.iter().all(|a| a.id != account.id));

    let txs_after = crate::get_transactions_db(&db_path, account.id).unwrap();
    assert!(txs_after.is_empty());
}

#[test]
fn test_delete_account_removes_scheduled_transactions() {
    let (_dir, db_path) = setup_db();
    let account =
        crate::create_account_db(&db_path, "Scheduled".to_string(), 0.0, None, None).unwrap();
    {
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO scheduled_transactions (account_id, payee, amount, start_date) VALUES (?1, 'Rent', -10.0, '2024-01-01')",
            rusqlite::params![account.id],
        )
        .unwrap();
    }

    crate::delete_account_db(&db_path, account.id).unwrap();

    let conn = rusqlite::Connection::open(&db_path).unwrap();
    let remaining: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM scheduled_transactions",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 0);
}
