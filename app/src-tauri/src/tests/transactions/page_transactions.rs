use std::path::{Path, PathBuf};

use super::common::setup_db;
use crate::transactions::{query_transactions_db, TransactionListQuery};
use crate::{
    create_account_db, create_transaction_db, set_account_archived_db, CreateTransactionArgs,
    Transaction,
};

fn insert(
    db_path: &PathBuf,
    account_id: i32,
    date: &str,
    payee: &str,
    category: Option<&str>,
    notes: Option<&str>,
    amount: f64,
) -> Transaction {
    create_transaction_db(
        db_path,
        CreateTransactionArgs {
            account_id,
            date: date.to_string(),
            payee: payee.to_string(),
            notes: notes.map(str::to_string),
            category: category.map(str::to_string),
            amount,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap()
}

fn page(db_path: &Path, query: TransactionListQuery) -> Vec<Transaction> {
    query_transactions_db(db_path, &query).unwrap()
}

#[test]
fn keyset_pages_follow_date_then_id_without_overlap() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Checking".to_string(), 0.0, None, None).unwrap();
    let older = insert(
        &db_path,
        account.id,
        "2024-01-01",
        "Older",
        None,
        None,
        -1.0,
    );
    let same_day = insert(
        &db_path,
        account.id,
        "2024-01-01",
        "Same day",
        None,
        None,
        -2.0,
    );
    let newest = insert(
        &db_path,
        account.id,
        "2024-01-03",
        "Newest",
        None,
        None,
        -3.0,
    );

    let first = page(
        &db_path,
        TransactionListQuery {
            account_id: Some(account.id),
            limit: Some(2),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(
        first.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![newest.id, same_day.id]
    );

    let second = page(
        &db_path,
        TransactionListQuery {
            account_id: Some(account.id),
            limit: Some(2),
            cursor_date: Some(first[1].date.clone()),
            cursor_id: Some(first[1].id),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(
        second.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![older.id]
    );

    let all = page(
        &db_path,
        TransactionListQuery {
            account_id: Some(account.id),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(all.len(), 3);
}

#[test]
fn keyset_pages_follow_the_chosen_column_with_id_tie_break() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Checking".to_string(), 0.0, None, None).unwrap();
    let low = insert(&db_path, account.id, "2024-02-01", "A", None, None, 10.0);
    let tied = insert(&db_path, account.id, "2024-03-01", "B", None, None, 10.0);
    let high = insert(&db_path, account.id, "2024-01-01", "C", None, None, 30.0);

    let query = |cursor: Option<&Transaction>| TransactionListQuery {
        account_id: Some(account.id),
        limit: Some(2),
        sort_key: Some("amount".to_string()),
        sort_dir: Some("ascending".to_string()),
        cursor_date: cursor.map(|tx| tx.date.clone()),
        cursor_id: cursor.map(|tx| tx.id),
        cursor_sort: cursor.map(|tx| tx.amount.to_string()),
        ..TransactionListQuery::default()
    };

    let first = page(&db_path, query(None));
    assert_eq!(
        first.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![low.id, tied.id]
    );

    let second = page(&db_path, query(Some(&first[1])));
    assert_eq!(
        second.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![high.id]
    );
}

#[test]
fn search_category_and_account_filters_apply_in_sql() {
    let (_dir, db_path) = setup_db();
    let checking = create_account_db(&db_path, "Checking".to_string(), 0.0, None, None).unwrap();
    let savings = create_account_db(&db_path, "Savings".to_string(), 0.0, None, None).unwrap();
    let rent = insert(
        &db_path,
        checking.id,
        "2024-04-01",
        "Landlord",
        Some("Housing"),
        Some("April rent"),
        -500.0,
    );
    insert(
        &db_path,
        checking.id,
        "2024-04-02",
        "Market",
        Some("Food"),
        None,
        -12.0,
    );
    let saved = insert(
        &db_path,
        savings.id,
        "2024-04-03",
        "Transfer in",
        Some("Housing"),
        None,
        20.0,
    );

    let by_text = page(
        &db_path,
        TransactionListQuery {
            account_id: Some(checking.id),
            search: Some("rent".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(
        by_text.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![rent.id]
    );

    let by_category = page(
        &db_path,
        TransactionListQuery {
            exclude_archived: true,
            category: Some("Housing".to_string()),
            ..TransactionListQuery::default()
        },
    );
    let mut category_ids: Vec<i32> = by_category.iter().map(|tx| tx.id).collect();
    category_ids.sort_unstable();
    let mut expected = vec![rent.id, saved.id];
    expected.sort_unstable();
    assert_eq!(category_ids, expected);

    let by_account = page(
        &db_path,
        TransactionListQuery {
            account_id: Some(savings.id),
            exclude_archived: true,
            category: Some("Housing".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(
        by_account.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![saved.id]
    );

    set_account_archived_db(&db_path, savings.id, true).unwrap();
    let active_only = page(
        &db_path,
        TransactionListQuery {
            exclude_archived: true,
            ..TransactionListQuery::default()
        },
    );
    assert!(active_only.iter().all(|tx| tx.account_id == checking.id));
    let archived_account = page(
        &db_path,
        TransactionListQuery {
            account_id: Some(savings.id),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(archived_account.len(), 1);
}

#[test]
fn rejects_a_partial_cursor_and_a_non_positive_limit() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Checking".to_string(), 0.0, None, None).unwrap();

    let missing_id = query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account.id),
            limit: Some(10),
            cursor_date: Some("2024-01-01".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert!(missing_id.unwrap_err().contains("date and id"));

    let bad_limit = query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account.id),
            limit: Some(0),
            ..TransactionListQuery::default()
        },
    );
    assert!(bad_limit.unwrap_err().contains("limit"));

    let bad_column = query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account.id),
            sort_key: Some("balance".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert!(bad_column.unwrap_err().contains("sort column"));
}
