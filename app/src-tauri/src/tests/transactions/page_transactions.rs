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

#[allow(clippy::too_many_arguments)]
fn rich(
    db_path: &PathBuf,
    account_id: i32,
    date: &str,
    payee: &str,
    category: Option<&str>,
    notes: Option<&str>,
    amount: f64,
    ticker: Option<&str>,
    shares: Option<f64>,
    price_per_share: Option<f64>,
    fee: Option<f64>,
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
            ticker: ticker.map(str::to_string),
            shares,
            price_per_share,
            fee,
            currency: None,
        },
    )
    .unwrap()
}

#[test]
fn every_sort_column_and_text_cursor_is_applied_in_sql() {
    let (_dir, db_path) = setup_db();
    let apple = create_account_db(&db_path, "Apple".to_string(), 0.0, None, None).unwrap();
    let mango = create_account_db(&db_path, "Mango".to_string(), 0.0, None, None).unwrap();
    let first = rich(
        &db_path,
        apple.id,
        "2024-05-01",
        "amber",
        Some("Food"),
        Some("aaa"),
        -10.0,
        None,
        None,
        None,
        None,
    );
    let second = rich(
        &db_path,
        apple.id,
        "2024-05-02",
        "amber",
        Some("Rent"),
        Some("zzz"),
        -10.5,
        Some("ZZZ"),
        Some(2.0),
        Some(3.0),
        Some(1.0),
    );
    let third = rich(
        &db_path,
        mango.id,
        "2024-05-03",
        "zebra",
        None,
        None,
        -1.0,
        Some("aaa"),
        Some(9.0),
        Some(1.0),
        Some(0.0),
    );

    let mut seen = std::collections::HashSet::new();
    for (key, dir) in [
        ("date", Some("ascending")),
        ("payee", Some("descending")),
        ("category", Some("asc")),
        ("notes", None),
        ("amount", Some("desc")),
        ("shares", Some("ascending")),
        ("price_per_share", Some("descending")),
        ("fee", Some("asc")),
        ("ticker", Some("descending")),
        ("account_name", Some("ascending")),
        ("  payee  ", Some("  desc  ")),
    ] {
        let rows = page(
            &db_path,
            TransactionListQuery {
                limit: Some(10),
                sort_key: Some(key.to_string()),
                sort_dir: dir.map(str::to_string),
                ..TransactionListQuery::default()
            },
        );
        assert_eq!(rows.len(), 3, "sort {key}");
        seen.extend(rows.iter().map(|tx| tx.id));
    }
    assert_eq!(seen.len(), 3);

    let names = page(
        &db_path,
        TransactionListQuery {
            exclude_archived: true,
            limit: Some(2),
            sort_key: Some("account_name".to_string()),
            sort_dir: Some("ascending".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(
        names.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![first.id, second.id]
    );
    let name_rest = page(
        &db_path,
        TransactionListQuery {
            exclude_archived: true,
            limit: Some(2),
            sort_key: Some("account_name".to_string()),
            sort_dir: Some("ascending".to_string()),
            cursor_date: Some(names[1].date.clone()),
            cursor_id: Some(names[1].id),
            cursor_sort: Some("Apple".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(
        name_rest.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![third.id]
    );

    let payees = page(
        &db_path,
        TransactionListQuery {
            limit: Some(1),
            sort_key: Some("payee".to_string()),
            sort_dir: Some("descending".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(payees[0].id, third.id);
    let payee_rest = page(
        &db_path,
        TransactionListQuery {
            limit: Some(2),
            sort_key: Some("payee".to_string()),
            sort_dir: Some("descending".to_string()),
            cursor_date: Some(payees[0].date.clone()),
            cursor_id: Some(payees[0].id),
            cursor_sort: Some("zebra".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(
        payee_rest.iter().map(|tx| tx.id).collect::<Vec<_>>(),
        vec![second.id, first.id]
    );

    for (key, cursor) in [
        ("shares", "2"),
        ("price_per_share", "3"),
        ("fee", "1"),
        ("category", "Rent"),
        ("notes", "zzz"),
        ("ticker", "ZZZ"),
    ] {
        let next = page(
            &db_path,
            TransactionListQuery {
                limit: Some(5),
                sort_key: Some(key.to_string()),
                sort_dir: Some("ascending".to_string()),
                cursor_date: Some(second.date.clone()),
                cursor_id: Some(second.id),
                cursor_sort: Some(cursor.to_string()),
                ..TransactionListQuery::default()
            },
        );
        assert!(next.iter().all(|tx| tx.id != second.id), "cursor {key}");
    }

    let unfiltered = page(
        &db_path,
        TransactionListQuery {
            limit: Some(10),
            search: Some("   ".to_string()),
            category: Some("  ".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert_eq!(unfiltered.len(), 3);
}

#[test]
fn rejects_bad_sort_direction_and_incomplete_cursors() {
    let (_dir, db_path) = setup_db();
    let account = create_account_db(&db_path, "Checking".to_string(), 0.0, None, None).unwrap();

    let bad_dir = query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account.id),
            sort_key: Some("payee".to_string()),
            sort_dir: Some("sideways".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert!(bad_dir.unwrap_err().contains("sort direction"));

    let missing_text = query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account.id),
            sort_key: Some("payee".to_string()),
            sort_dir: Some("ascending".to_string()),
            cursor_date: Some("2024-01-01".to_string()),
            cursor_id: Some(1),
            ..TransactionListQuery::default()
        },
    );
    assert!(missing_text.unwrap_err().contains("sort value"));

    let bad_number = query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account.id),
            sort_key: Some("shares".to_string()),
            cursor_date: Some("2024-01-01".to_string()),
            cursor_id: Some(1),
            cursor_sort: Some("nope".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert!(bad_number.unwrap_err().contains("numeric"));

    let only_sort = query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account.id),
            cursor_sort: Some("amber".to_string()),
            ..TransactionListQuery::default()
        },
    );
    assert!(only_sort.unwrap_err().contains("date and id"));

    let negative = query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account.id),
            limit: Some(-3),
            ..TransactionListQuery::default()
        },
    );
    assert!(negative.unwrap_err().contains("limit"));
}
