use crate::core::accounts::get_accounts_summary_db;
use crate::core::db_init::{init_db_at_path, with_db_lock};
use crate::tests::common::setup_db;
use rusqlite::Connection;
use tempfile::tempdir;

#[test]
fn test_init_db_at_path_creates_all_tables() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("full.db");
    init_db_at_path(&db_path).unwrap();

    let conn = Connection::open(&db_path).unwrap();
    for table in [
        "accounts",
        "transactions",
        "rules",
        "scheduled_transactions",
        "chat_conversations",
        "chat_messages",
        "assets",
        "asset_valuations",
        "liabilities",
        "liability_valuations",
        "custom_exchange_rates",
        "stock_prices",
        "daily_stock_prices",
    ] {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                rusqlite::params![table],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(exists, 1, "missing table {table}");
    }
}

#[test]
fn test_with_db_lock_reentrant_on_same_path() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("lock.db");
    init_db_at_path(&db_path).unwrap();

    with_db_lock(&db_path, || {
        with_db_lock(&db_path, || {
            let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
            conn.execute("INSERT INTO accounts (name, balance) VALUES ('A', 1.0)", [])
                .map_err(|e| e.to_string())?;
            Ok(())
        })
    })
    .unwrap();

    let conn = Connection::open(&db_path).unwrap();
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn test_get_accounts_summary_groups_transactions() {
    let (_dir, db_path) = setup_db();
    let account = crate::create_account_db(
        &db_path,
        "Multi".to_string(),
        0.0,
        Some("USD".to_string()),
        None,
    )
    .unwrap();

    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: account.id,
            date: "2024-01-01".to_string(),
            payee: "Salary".to_string(),
            notes: None,
            category: Some("Income".to_string()),
            amount: 2000.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: Some("USD".to_string()),
        },
    )
    .unwrap();

    let summary = get_accounts_summary_db(&db_path, "USD").unwrap();
    assert_eq!(summary.accounts.len(), 1);
    assert_eq!(summary.raw_data.len(), 1);
    assert_eq!(summary.raw_data[0].2, 2000.0);
}

#[test]
fn test_db_locks_are_per_path() {
    let dir = tempdir().unwrap();
    let db1 = dir.path().join("one.db");
    let db2 = dir.path().join("two.db");
    init_db_at_path(&db1).unwrap();
    init_db_at_path(&db2).unwrap();

    let db1_clone = db1.clone();
    let db2_clone = db2.clone();

    std::thread::scope(|s| {
        s.spawn(|| {
            with_db_lock(&db1_clone, || {
                std::thread::sleep(std::time::Duration::from_millis(50));
                Ok(())
            })
            .unwrap();
        });
        s.spawn(|| {
            with_db_lock(&db2_clone, || Ok(())).unwrap();
        });
    });
}

#[test]
fn test_init_db_at_path_is_idempotent() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("idempotent.db");
    init_db_at_path(&db_path).unwrap();
    init_db_at_path(&db_path).unwrap();

    let conn = Connection::open(&db_path).unwrap();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert!(count >= 10);
}
