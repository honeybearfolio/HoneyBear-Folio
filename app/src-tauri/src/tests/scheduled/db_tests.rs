use crate::core::scheduled::{
    apply_scheduled_occurrence_db, create_scheduled_transaction_db,
    delete_scheduled_transaction_db, get_pending_occurrences_db, get_scheduled_transactions_db,
    skip_scheduled_occurrence_db, update_scheduled_transaction_db, CreateScheduledTransactionArgs,
    UpdateScheduledTransactionArgs,
};
use crate::create_account_db;
use crate::tests::common::setup_db;

fn base_args(account_id: i32) -> CreateScheduledTransactionArgs {
    CreateScheduledTransactionArgs {
        account_id,
        payee: "Rent".to_string(),
        amount: -1200.0,
        category: Some("Housing".to_string()),
        notes: None,
        currency: Some("USD".to_string()),
        recurrence_type: "every_n".to_string(),
        interval_value: Some(1),
        interval_unit: Some("month".to_string()),
        days_of_week: None,
        ordinal: None,
        weekday: None,
        start_date: "2024-01-01".to_string(),
        end_date: None,
        max_occurrences: None,
        transaction_type: Some("regular".to_string()),
        ticker: None,
        shares: None,
        price_per_share: None,
        fee: None,
        is_buy: None,
    }
}

#[test]
fn test_scheduled_transaction_crud() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Checking".to_string(), 5000.0, None, None).unwrap();

    let scheduled_id = create_scheduled_transaction_db(&db_path, base_args(account.id)).unwrap();
    assert!(scheduled_id > 0);

    let all = get_scheduled_transactions_db(&db_path).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].payee, "Rent");

    update_scheduled_transaction_db(
        &db_path,
        UpdateScheduledTransactionArgs {
            id: scheduled_id,
            account_id: account.id,
            payee: "Updated Rent".to_string(),
            amount: -1300.0,
            category: Some("Housing".to_string()),
            notes: Some("Monthly".to_string()),
            currency: Some("USD".to_string()),
            recurrence_type: "every_n".to_string(),
            interval_value: Some(1),
            interval_unit: Some("month".to_string()),
            days_of_week: None,
            ordinal: None,
            weekday: None,
            start_date: "2024-01-01".to_string(),
            end_date: None,
            max_occurrences: None,
            enabled: true,
            transaction_type: Some("regular".to_string()),
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            is_buy: None,
        },
    )
    .unwrap();

    let updated = get_scheduled_transactions_db(&db_path).unwrap();
    assert_eq!(updated[0].payee, "Updated Rent");
    assert_eq!(updated[0].amount, -1300.0);

    delete_scheduled_transaction_db(&db_path, scheduled_id).unwrap();
    assert!(get_scheduled_transactions_db(&db_path).unwrap().is_empty());
}

#[test]
fn test_pending_occurrences_apply_and_skip() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Cash".to_string(), 1000.0, None, None).unwrap();
    let scheduled_id = create_scheduled_transaction_db(&db_path, base_args(account.id)).unwrap();

    let pending = get_pending_occurrences_db(&db_path, None, "2024-03-01").unwrap();
    assert!(!pending.is_empty());

    let first = &pending[0];
    apply_scheduled_occurrence_db(&db_path, scheduled_id, &first.date).unwrap();

    let txs = crate::get_transactions_db(&db_path, account.id).unwrap();
    assert!(txs.iter().any(|t| t.payee == "Rent"));

    let pending2 = get_pending_occurrences_db(&db_path, None, "2024-03-01").unwrap();
    if let Some(next) = pending2.first() {
        skip_scheduled_occurrence_db(&db_path, scheduled_id, &next.date).unwrap();
    }

    let after_skip = get_scheduled_transactions_db(&db_path).unwrap();
    assert_eq!(after_skip[0].id, scheduled_id);
}
