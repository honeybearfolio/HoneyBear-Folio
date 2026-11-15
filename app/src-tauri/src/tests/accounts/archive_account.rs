use super::common::setup_db;

fn add_tx(db_path: &std::path::PathBuf, account_id: i32, amount: f64) {
    crate::create_transaction_db(
        db_path,
        crate::CreateTransactionArgs {
            account_id,
            date: "2023-01-02".to_string(),
            payee: "Payee".to_string(),
            notes: None,
            category: None,
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

#[test]
fn test_archived_account_hidden_but_restorable() {
    let (_dir, db_path) = setup_db();
    let keep = crate::create_account_db(&db_path, "Keep".to_string(), 0.0, None, None).unwrap();
    let old = crate::create_account_db(&db_path, "Old".to_string(), 0.0, None, None).unwrap();
    add_tx(&db_path, keep.id, 10.0);
    add_tx(&db_path, old.id, 50.0);

    crate::set_account_archived_db(&db_path, old.id, true).unwrap();

    let active = crate::get_accounts_db(&db_path).unwrap();
    assert_eq!(active.len(), 1);
    assert_eq!(active[0].id, keep.id);

    let all = crate::get_accounts_with_archived_db(&db_path, true).unwrap();
    assert_eq!(all.len(), 2);
    assert!(all.iter().find(|a| a.id == old.id).unwrap().archived);
    assert!(!all.iter().find(|a| a.id == keep.id).unwrap().archived);

    // Archived transactions are hidden from global views but kept per account.
    let txs = crate::get_all_transactions_db(&db_path).unwrap();
    assert!(txs.iter().all(|t| t.account_id == keep.id));
    assert_eq!(
        crate::get_transactions_db(&db_path, old.id).unwrap().len(),
        1
    );

    let summary = crate::get_accounts_summary_db(&db_path, "USD").unwrap();
    assert!(summary.raw_data.iter().all(|(id, _, _)| *id != old.id));
    let summary_all = crate::get_accounts_summary_with_archived_db(&db_path, "USD", true).unwrap();
    assert!(summary_all.raw_data.iter().any(|(id, _, _)| *id == old.id));

    crate::set_account_archived_db(&db_path, old.id, false).unwrap();

    assert_eq!(crate::get_accounts_db(&db_path).unwrap().len(), 2);
    assert_eq!(crate::get_all_transactions_db(&db_path).unwrap().len(), 2);
}

#[test]
fn test_archived_account_name_stays_reserved() {
    let (_dir, db_path) = setup_db();
    let acc = crate::create_account_db(&db_path, "Old".to_string(), 0.0, None, None).unwrap();
    crate::set_account_archived_db(&db_path, acc.id, true).unwrap();

    let err = crate::create_account_db(&db_path, "old".to_string(), 0.0, None, None).unwrap_err();
    assert!(err.contains("already exists"));
}

#[test]
fn test_archive_missing_account_errors() {
    let (_dir, db_path) = setup_db();
    assert!(crate::set_account_archived_db(&db_path, 999, true).is_err());
}
