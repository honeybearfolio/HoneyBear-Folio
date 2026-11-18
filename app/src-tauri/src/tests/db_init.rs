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
        "account_currency_totals",
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
fn test_init_db_at_path_migrates_legacy_db_to_add_archived_column() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("legacy.db");
    {
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, balance REAL NOT NULL, kind TEXT DEFAULT 'cash', currency TEXT);
             CREATE TABLE assets (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other', currency TEXT, notes TEXT);
             CREATE TABLE liabilities (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other', currency TEXT, notes TEXT);
             INSERT INTO accounts (name, balance) VALUES ('Old', 5.0);
             INSERT INTO assets (name) VALUES ('Old asset');
             INSERT INTO liabilities (name) VALUES ('Old liability');",
        )
        .unwrap();
    }

    init_db_at_path(&db_path).unwrap();
    init_db_at_path(&db_path).unwrap();

    assert_eq!(crate::get_accounts_db(&db_path).unwrap().len(), 1);
    assert_eq!(crate::get_assets_db(&db_path, None).unwrap().len(), 1);
    assert_eq!(crate::get_liabilities_db(&db_path, None).unwrap().len(), 1);

    crate::set_account_archived_db(&db_path, 1, true).unwrap();
    assert!(crate::get_accounts_db(&db_path).unwrap().is_empty());
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

fn currency_amount(summary: &crate::models::AccountsSummary, currency: &str) -> f64 {
    summary
        .raw_data
        .iter()
        .filter(|(_, code, _)| code == currency)
        .map(|(_, _, amount)| *amount)
        .sum()
}

#[test]
fn test_init_rebuilds_currency_totals_once_from_the_ledger() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("legacy-totals.db");
    init_db_at_path(&db_path).unwrap();

    {
        let conn = Connection::open(&db_path).unwrap();
        conn.execute("DROP TABLE account_currency_totals", [])
            .unwrap();
        conn.execute(
            "INSERT INTO accounts (name, balance, currency) VALUES ('Cash', 35.0, 'USD')",
            [],
        )
        .unwrap();
        let account_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO transactions (account_id, date, payee, amount, currency) VALUES (?1, '2024-01-01', 'Pay', 100.0, 'USD')",
            [account_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (account_id, date, payee, amount, currency) VALUES (?1, '2024-01-02', 'Shop', -70.0, 'EUR')",
            [account_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (account_id, date, payee, amount) VALUES (?1, '2024-01-03', 'Cash', 5.0)",
            [account_id],
        )
        .unwrap();
    }

    init_db_at_path(&db_path).unwrap();

    let summary = get_accounts_summary_db(&db_path, "GBP").unwrap();
    assert_eq!(currency_amount(&summary, "USD"), 100.0);
    assert_eq!(currency_amount(&summary, "EUR"), -70.0);
    assert_eq!(currency_amount(&summary, "GBP"), 5.0);

    {
        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "UPDATE account_currency_totals SET total = 1.0 WHERE currency = 'USD'",
            [],
        )
        .unwrap();
    }

    init_db_at_path(&db_path).unwrap();
    let drifted = get_accounts_summary_db(&db_path, "GBP").unwrap();
    assert_eq!(currency_amount(&drifted, "USD"), 1.0);

    crate::reconcile_account_balances_db(&db_path).unwrap();
    let rebuilt = get_accounts_summary_db(&db_path, "GBP").unwrap();
    assert_eq!(currency_amount(&rebuilt, "USD"), 100.0);
    assert_eq!(currency_amount(&rebuilt, "EUR"), -70.0);
    assert_eq!(currency_amount(&rebuilt, "GBP"), 5.0);
}

#[test]
fn test_init_db_creates_transaction_list_indexes() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("indexes.db");
    init_db_at_path(&db_path).unwrap();

    let conn = Connection::open(&db_path).unwrap();
    for index in [
        "idx_transactions_account_date",
        "idx_transactions_linked_tx_id",
    ] {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
                rusqlite::params![index],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(exists, 1, "missing index {index}");
    }
}

#[test]
fn test_open_db_applies_pragmas_and_reuses_the_connection() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("pool.db");
    init_db_at_path(&db_path).unwrap();

    {
        let conn = crate::db_init::open_db(&db_path).unwrap();
        let cache_size: i64 = conn
            .query_row("PRAGMA cache_size", [], |row| row.get(0))
            .unwrap();
        let foreign_keys: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        let temp_store: i64 = conn
            .query_row("PRAGMA temp_store", [], |row| row.get(0))
            .unwrap();
        let mmap_size: i64 = conn
            .query_row("PRAGMA mmap_size", [], |row| row.get(0))
            .unwrap();
        let busy_timeout: i64 = conn
            .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
            .unwrap();
        assert_eq!(cache_size, -64_000);
        assert_eq!(foreign_keys, 1);
        assert_eq!(temp_store, 2);
        assert_eq!(mmap_size, 268_435_456);
        assert_eq!(busy_timeout, 5_000);
        conn.pragma_update(None, "query_only", 1).unwrap();
    }

    let conn = crate::db_init::open_db(&db_path).unwrap();
    let query_only: i64 = conn
        .query_row("PRAGMA query_only", [], |row| row.get(0))
        .unwrap();
    assert_eq!(query_only, 1, "idle connection was not reused");
    conn.pragma_update(None, "query_only", 0).unwrap();
}

#[test]
fn test_open_db_nested_checkout_does_not_deadlock() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("nested.db");
    init_db_at_path(&db_path).unwrap();

    let outer = crate::db_init::open_db(&db_path).unwrap();
    let inner = crate::db_init::open_db(&db_path).unwrap();
    let outer_count: i64 = outer
        .query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0))
        .unwrap();
    let inner_count: i64 = inner
        .query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0))
        .unwrap();
    assert_eq!(outer_count, inner_count);
}
