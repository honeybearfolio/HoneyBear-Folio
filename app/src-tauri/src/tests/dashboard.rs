use crate::core::dashboard::{
    dashboard_chart_series_db, query_dashboard_transactions_db, DashboardChartQuery,
    DashboardTransactionFilter,
};
use crate::core::transactions::{
    create_investment_transaction_db, CreateInvestmentTransactionArgs,
};
use crate::tests::common::setup_db;

fn query(
    account_ids: Vec<i32>,
    start: &str,
    end: &str,
    bucket: &str,
    clamp: bool,
) -> DashboardChartQuery {
    DashboardChartQuery {
        account_ids,
        start_date: start.to_string(),
        end_date: end.to_string(),
        app_currency: "USD".to_string(),
        bucket: bucket.to_string(),
        clamp_start: clamp,
    }
}

fn cash(
    db: &std::path::Path,
    account_id: i32,
    date: &str,
    amount: f64,
    category: &str,
    payee: &str,
) {
    crate::create_transaction_db(
        &db.to_path_buf(),
        crate::CreateTransactionArgs {
            account_id,
            date: date.to_string(),
            payee: payee.to_string(),
            notes: None,
            category: Some(category.to_string()),
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
fn chart_series_sums_income_expenses_and_running_balance() {
    let (_dir, db_path) = setup_db();
    let checking = crate::create_account_db(
        &db_path,
        "Checking".to_string(),
        0.0,
        Some("USD".into()),
        None,
    )
    .unwrap();
    let other =
        crate::create_account_db(&db_path, "Other".to_string(), 0.0, Some("USD".into()), None)
            .unwrap();
    cash(
        &db_path,
        checking.id,
        "2024-06-01",
        100.0,
        "Salary",
        "Employer",
    );
    cash(&db_path, checking.id, "2024-06-02", -40.0, "Food", "Market");
    cash(
        &db_path,
        checking.id,
        "2024-06-02",
        -15.0,
        "Transfer",
        "Savings",
    );
    cash(&db_path, other.id, "2024-06-02", -999.0, "Food", "Ignored");

    let series = dashboard_chart_series_db(
        &db_path,
        &query(vec![checking.id], "2024-06-01", "2024-06-03", "day", true),
    )
    .unwrap();

    assert_eq!(series.dates, vec!["2024-06-01", "2024-06-02", "2024-06-03"]);
    assert_eq!(series.totals, vec![100.0, 45.0, 45.0]);
    assert_eq!(series.accounts.len(), 1);
    assert_eq!(series.accounts[0].account_id, checking.id);
    assert_eq!(series.accounts[0].native, vec![100.0, 45.0, 45.0]);
    let income: f64 = series
        .income_expense
        .iter()
        .map(|bucket| bucket.income)
        .sum();
    let expenses: f64 = series
        .income_expense
        .iter()
        .map(|bucket| bucket.expenses)
        .sum();
    assert_eq!(income, 100.0);
    assert_eq!(expenses, 40.0);
    assert_eq!(series.categories.len(), 1);
    assert_eq!(series.categories[0].category, "Food");
    assert_eq!(series.categories[0].amount, 40.0);
}

#[test]
fn chart_series_prices_holdings_and_clamps_the_first_point() {
    let (_dir, db_path) = setup_db();
    let brokerage = crate::create_account_db(
        &db_path,
        "Brokerage".to_string(),
        0.0,
        Some("USD".into()),
        None,
    )
    .unwrap();
    create_investment_transaction_db(
        &db_path,
        CreateInvestmentTransactionArgs {
            account_id: brokerage.id,
            date: "2024-06-01".to_string(),
            ticker: "AAPL".to_string(),
            shares: 2.0,
            price_per_share: 10.0,
            fee: 0.0,
            is_buy: true,
            currency: Some("USD".to_string()),
            payee: None,
            notes: None,
            category: None,
        },
    )
    .unwrap();
    let conn = crate::db_init::open_db(&db_path).unwrap();
    conn.execute(
        "INSERT INTO daily_stock_prices (ticker, date, price) VALUES ('AAPL', '2024-06-01', 15.0)",
        [],
    )
    .unwrap();
    drop(conn);

    let clamped = dashboard_chart_series_db(
        &db_path,
        &query(
            vec![brokerage.id],
            "2024-05-01",
            "2024-06-01",
            "month",
            true,
        ),
    )
    .unwrap();
    assert_eq!(clamped.dates, vec!["2024-06-01"]);
    assert_eq!(clamped.totals, vec![10.0]);
    assert!(clamped.tickers.iter().any(|ticker| ticker == "AAPL"));
    assert!(clamped
        .income_expense
        .iter()
        .all(|bucket| bucket.income == 0.0 && bucket.expenses == 0.0));
    assert_eq!(clamped.categories.len(), 0);

    let leading = dashboard_chart_series_db(
        &db_path,
        &query(vec![brokerage.id], "2024-05-30", "2024-06-01", "day", false),
    )
    .unwrap();
    assert_eq!(
        leading.dates.first().map(String::as_str),
        Some("2024-05-30")
    );
    assert_eq!(leading.totals[0], 0.0);
    assert_eq!(*leading.totals.last().unwrap(), 10.0);
}

#[test]
fn chart_series_converts_income_with_the_account_fx_rate() {
    let (_dir, db_path) = setup_db();
    let eur = crate::create_account_db(&db_path, "Euro".to_string(), 0.0, Some("EUR".into()), None)
        .unwrap();
    cash(&db_path, eur.id, "2024-01-10", 10.0, "Salary", "Employer");
    cash(&db_path, eur.id, "2024-01-22", -4.0, "Food", "Market");
    let conn = crate::db_init::open_db(&db_path).unwrap();
    conn.execute(
        "INSERT INTO daily_stock_prices (ticker, date, price) VALUES ('EURUSD=X', '2024-01-01', 2.0)",
        [],
    )
    .unwrap();
    drop(conn);

    let mut request = query(vec![eur.id], "2024-01-20", "2024-02-01", "month", false);
    request.app_currency = "USD".to_string();
    let series = dashboard_chart_series_db(&db_path, &request).unwrap();

    assert_eq!(
        series
            .income_expense
            .iter()
            .map(|bucket| bucket.key.as_str())
            .collect::<Vec<_>>(),
        vec!["2024-01", "2024-02"]
    );
    assert_eq!(series.income_expense[0].income, 20.0);
    assert_eq!(series.income_expense[0].expenses, 8.0);
    assert_eq!(series.categories.len(), 1);
    assert_eq!(series.categories[0].amount, 8.0);
}

#[test]
fn chart_series_with_no_accounts_does_not_read_the_table() {
    let (_dir, db_path) = setup_db();
    let account =
        crate::create_account_db(&db_path, "Checking".to_string(), 0.0, None, None).unwrap();
    cash(
        &db_path,
        account.id,
        "2024-06-01",
        25.0,
        "Salary",
        "Employer",
    );

    let series = dashboard_chart_series_db(
        &db_path,
        &query(vec![], "2024-06-01", "2024-06-02", "day", true),
    )
    .unwrap();
    assert_eq!(series.dates.len(), 0);
    assert_eq!(series.income_expense.len(), 0);

    let rows = query_dashboard_transactions_db(&db_path, &[], &[]).unwrap();
    assert_eq!(rows.len(), 0);
}

#[test]
fn widget_filters_use_sql_where_instead_of_the_whole_table() {
    let (_dir, db_path) = setup_db();
    let checking = crate::create_account_db(
        &db_path,
        "Checking".to_string(),
        0.0,
        Some("USD".into()),
        None,
    )
    .unwrap();
    let savings = crate::create_account_db(
        &db_path,
        "Savings".to_string(),
        0.0,
        Some("EUR".into()),
        None,
    )
    .unwrap();
    cash(&db_path, checking.id, "2024-01-02", -12.0, "Food", "Market");
    cash(&db_path, savings.id, "2024-03-02", -4.0, "Food", "Cafe");
    cash(
        &db_path,
        checking.id,
        "2024-04-01",
        -3.0,
        "Rent",
        "Landlord",
    );

    let matched = query_dashboard_transactions_db(
        &db_path,
        &[checking.id, savings.id],
        &[
            DashboardTransactionFilter {
                field: "payee".to_string(),
                operator: "starts_with".to_string(),
                value: "caf".to_string(),
            },
            DashboardTransactionFilter {
                field: "currency".to_string(),
                operator: "equals".to_string(),
                value: "EUR".to_string(),
            },
            DashboardTransactionFilter {
                field: "date".to_string(),
                operator: "greater_than".to_string(),
                value: "2024-02-01".to_string(),
            },
        ],
    )
    .unwrap();
    assert_eq!(matched.len(), 1);
    assert_eq!(matched[0].account_id, savings.id);

    let food = query_dashboard_transactions_db(
        &db_path,
        &[checking.id],
        &[DashboardTransactionFilter {
            field: "category".to_string(),
            operator: "matches_regex".to_string(),
            value: "^food$".to_string(),
        }],
    )
    .unwrap();
    assert_eq!(food.len(), 1);
    assert_eq!(food[0].payee, "Market");

    let hostile = query_dashboard_transactions_db(
        &db_path,
        &[checking.id],
        &[DashboardTransactionFilter {
            field: "payee".to_string(),
            operator: "contains".to_string(),
            value: "'; DROP TABLE transactions; --".to_string(),
        }],
    )
    .unwrap();
    assert_eq!(hostile.len(), 0);
    assert_eq!(
        crate::get_transactions_db(&db_path, checking.id)
            .unwrap()
            .len(),
        2
    );
}

fn insert_price(db: &std::path::Path, ticker: &str, date: &str, price: f64) {
    let conn = crate::db_init::open_db(db).unwrap();
    conn.execute(
        "INSERT INTO daily_stock_prices (ticker, date, price) VALUES (?1, ?2, ?3)",
        rusqlite::params![ticker, date, price],
    )
    .unwrap();
}

fn buy(
    db: &std::path::Path,
    account_id: i32,
    date: &str,
    ticker: &str,
    shares: f64,
    price: f64,
    currency: Option<&str>,
    is_buy: bool,
) {
    create_investment_transaction_db(
        &db.to_path_buf(),
        CreateInvestmentTransactionArgs {
            account_id,
            date: date.to_string(),
            ticker: ticker.to_string(),
            shares,
            price_per_share: price,
            fee: 0.0,
            is_buy,
            currency: currency.map(str::to_string),
            payee: None,
            notes: None,
            category: None,
        },
    )
    .unwrap();
}

#[test]
fn chart_series_empty_inputs_and_invalid_dates() {
    let parsed: DashboardChartQuery = serde_json::from_str(
        r#"{"accountIds":[],"startDate":"","endDate":"2024-06-01","appCurrency":"USD","bucket":"day"}"#,
    )
    .unwrap();
    assert!(parsed.clamp_start);

    let (_dir, db_path) = setup_db();
    let idle = crate::create_account_db(&db_path, "Idle".to_string(), 0.0, None, None).unwrap();
    let active = crate::create_account_db(&db_path, "Active".to_string(), 0.0, None, None).unwrap();
    cash(&db_path, active.id, "2024-06-01", 4.0, "Salary", "Employer");

    let no_txs = dashboard_chart_series_db(
        &db_path,
        &query(vec![idle.id], "2024-06-01", "2024-06-02", "day", true),
    )
    .unwrap();
    assert_eq!(no_txs.dates.len(), 0);

    let missing = dashboard_chart_series_db(
        &db_path,
        &query(vec![999_999], "2024-06-01", "2024-06-02", "day", true),
    )
    .unwrap();
    assert_eq!(missing.dates.len(), 0);

    let bad_end = dashboard_chart_series_db(
        &db_path,
        &query(vec![active.id], "2024-06-01", "not-a-date", "day", true),
    );
    assert!(bad_end.unwrap_err().contains("invalid dashboard date"));
    let bad_start = dashboard_chart_series_db(
        &db_path,
        &query(vec![active.id], "not-a-date", "2024-06-02", "day", true),
    );
    assert!(bad_start.unwrap_err().contains("invalid dashboard date"));

    let reversed = dashboard_chart_series_db(
        &db_path,
        &query(vec![active.id], "2024-08-01", "2024-06-01", "day", true),
    )
    .unwrap();
    assert_eq!(reversed.dates.len(), 0);

    let mut open = query(vec![active.id, 999_999], "", "2024-06-02", " DAY ", true);
    open.app_currency = "  ".to_string();
    let series = dashboard_chart_series_db(&db_path, &open).unwrap();
    assert_eq!(series.bucket, "day");
    assert_eq!(series.dates, vec!["2024-06-01", "2024-06-02"]);
    assert_eq!(series.totals, vec![4.0, 4.0]);
    assert_eq!(series.accounts[0].currency, "USD");
    assert_eq!(series.income_expense[0].income, 4.0);
}

#[test]
fn chart_series_carries_prices_and_converts_ticker_currency() {
    let (_dir, db_path) = setup_db();
    let broker = crate::create_account_db(
        &db_path,
        "Broker".to_string(),
        0.0,
        Some("USD".into()),
        None,
    )
    .unwrap();
    buy(
        &db_path,
        broker.id,
        "2024-12-01",
        "AAPL",
        2.0,
        10.0,
        Some("USD"),
        true,
    );
    buy(
        &db_path,
        broker.id,
        "2024-12-01",
        "FLAT",
        1.0,
        5.0,
        Some("USD"),
        true,
    );
    buy(
        &db_path,
        broker.id,
        "2024-12-01",
        "FLAT",
        1.0,
        5.0,
        Some("USD"),
        false,
    );
    buy(
        &db_path,
        broker.id,
        "2024-12-01",
        "NOPRICE",
        1.0,
        1.0,
        Some("USD"),
        true,
    );
    crate::create_transaction_db(
        &db_path.to_path_buf(),
        crate::CreateTransactionArgs {
            account_id: broker.id,
            date: "2024-12-01".to_string(),
            payee: "Zero".to_string(),
            notes: None,
            category: Some("Investment".to_string()),
            amount: 0.0,
            ticker: Some("ZERO".to_string()),
            shares: Some(0.0),
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    crate::create_transaction_db(
        &db_path.to_path_buf(),
        crate::CreateTransactionArgs {
            account_id: broker.id,
            date: "2024-12-04".to_string(),
            payee: "Market".to_string(),
            notes: None,
            category: Some("Food".to_string()),
            amount: -2.0,
            ticker: Some(String::new()),
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    insert_price(&db_path, "AAPL", "2024-12-03", 15.0);

    let priced = dashboard_chart_series_db(
        &db_path,
        &query(vec![broker.id], "2024-12-01", "2024-12-04", "day", false),
    )
    .unwrap();
    assert_eq!(
        priced.dates,
        vec!["2024-12-01", "2024-12-02", "2024-12-03", "2024-12-04"]
    );
    assert_eq!(priced.totals, vec![-21.0, -21.0, 9.0, 7.0]);
    assert_eq!(priced.tickers, vec!["AAPL", "FLAT", "NOPRICE", "ZERO"]);
    assert_eq!(priced.income_expense[3].expenses, 2.0);
    assert_eq!(priced.categories[0].category, "Food");

    let fx = crate::create_account_db(&db_path, "Fx".to_string(), 0.0, Some("USD".into()), None)
        .unwrap();
    buy(
        &db_path,
        fx.id,
        "2024-06-01",
        "SAP",
        1.0,
        10.0,
        Some("EUR"),
        true,
    );
    insert_price(&db_path, "SAP", "2024-06-01", 10.0);
    insert_price(&db_path, "EURUSD=X", "2024-06-01", 2.0);
    let converted = dashboard_chart_series_db(
        &db_path,
        &query(vec![fx.id], "2024-06-01", "2024-06-01", "day", true),
    )
    .unwrap();
    assert_eq!(converted.totals, vec![10.0]);
    assert_eq!(converted.tickers, vec!["EURUSD=X", "SAP"]);

    let pound =
        crate::create_account_db(&db_path, "Pound".to_string(), 0.0, Some("GBP".into()), None)
            .unwrap();
    cash(&db_path, pound.id, "2024-06-01", 10.0, "Salary", "Employer");
    let missing_rate = dashboard_chart_series_db(
        &db_path,
        &query(vec![pound.id], "2024-06-01", "2024-06-01", "month", true),
    )
    .unwrap();
    assert_eq!(missing_rate.totals, vec![10.0]);
    assert_eq!(missing_rate.income_expense[0].income, 10.0);
    assert_eq!(missing_rate.tickers, vec!["GBPUSD=X"]);

    let franc =
        crate::create_account_db(&db_path, "Franc".to_string(), 0.0, Some("CHF".into()), None)
            .unwrap();
    cash(&db_path, franc.id, "2024-06-01", 6.0, "Salary", "Employer");
    insert_price(&db_path, "CHFUSD=X", "2024-06-01", 0.0);
    let zero_rate = dashboard_chart_series_db(
        &db_path,
        &query(vec![franc.id], "2024-06-01", "2024-06-01", "month", true),
    )
    .unwrap();
    assert_eq!(zero_rate.income_expense[0].income, 6.0);
}

#[test]
fn chart_series_sorts_categories_across_the_year_boundary() {
    let (_dir, db_path) = setup_db();
    let account =
        crate::create_account_db(&db_path, "Cash".to_string(), 0.0, Some("USD".into()), None)
            .unwrap();
    cash(&db_path, account.id, "2024-12-21", -5.0, "Alpha", "A");
    cash(&db_path, account.id, "2024-12-22", -5.0, "Beta", "B");
    cash(&db_path, account.id, "2024-12-25", -1.0, "Alpha", "A2");
    cash(&db_path, account.id, "2024-12-23", -6.0, "Gamma", "G");
    cash(&db_path, account.id, "2024-12-24", 0.0, "Zero", "Z");
    cash(
        &db_path,
        account.id,
        "2025-01-02",
        3.0,
        "Salary",
        "Employer",
    );
    cash(&db_path, account.id, "2025-02-01", -9.0, "Late", "Later");
    crate::create_transaction_db(
        &db_path.to_path_buf(),
        crate::CreateTransactionArgs {
            account_id: account.id,
            date: "2024-12-26".to_string(),
            payee: "Shop".to_string(),
            notes: None,
            category: None,
            amount: -7.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();

    let series = dashboard_chart_series_db(
        &db_path,
        &query(
            vec![account.id],
            "2024-12-20",
            "2025-01-02",
            "quarter",
            false,
        ),
    )
    .unwrap();
    assert_eq!(series.bucket, "month");
    assert_eq!(
        series
            .income_expense
            .iter()
            .map(|bucket| bucket.key.as_str())
            .collect::<Vec<_>>(),
        vec!["2024-12", "2025-01"]
    );
    assert_eq!(series.income_expense[0].expenses, 24.0);
    assert_eq!(series.income_expense[1].income, 3.0);
    assert_eq!(series.income_expense[1].expenses, 0.0);
    assert_eq!(
        series
            .categories
            .iter()
            .map(|category| (category.category.as_str(), category.amount))
            .collect::<Vec<_>>(),
        vec![("", 7.0), ("Alpha", 6.0), ("Gamma", 6.0), ("Beta", 5.0)]
    );
}

fn rule(field: &str, operator: &str, value: &str) -> DashboardTransactionFilter {
    DashboardTransactionFilter {
        field: field.to_string(),
        operator: operator.to_string(),
        value: value.to_string(),
    }
}

fn payees(db: &std::path::Path, ids: &[i32], filter: DashboardTransactionFilter) -> Vec<String> {
    query_dashboard_transactions_db(db, ids, &[filter])
        .unwrap()
        .into_iter()
        .map(|row| row.payee)
        .collect()
}

#[test]
fn widget_filters_cover_text_numeric_and_date_operators() {
    let (_dir, db_path) = setup_db();
    let checking = crate::create_account_db(
        &db_path,
        "Checking".to_string(),
        0.0,
        Some("USD".into()),
        None,
    )
    .unwrap();
    let savings = crate::create_account_db(
        &db_path,
        "Savings".to_string(),
        0.0,
        Some("EUR".into()),
        None,
    )
    .unwrap();
    crate::create_transaction_db(
        &db_path.to_path_buf(),
        crate::CreateTransactionArgs {
            account_id: checking.id,
            date: "2024-01-02".to_string(),
            payee: "Market".to_string(),
            notes: Some("weekly shop".to_string()),
            category: Some("Food".to_string()),
            amount: -12.5,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    crate::create_transaction_db(
        &db_path.to_path_buf(),
        crate::CreateTransactionArgs {
            account_id: savings.id,
            date: "2024-03-02".to_string(),
            payee: "Cafe".to_string(),
            notes: Some(String::new()),
            category: Some("Food".to_string()),
            amount: -4.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: Some("EUR".to_string()),
        },
    )
    .unwrap();
    crate::create_transaction_db(
        &db_path.to_path_buf(),
        crate::CreateTransactionArgs {
            account_id: checking.id,
            date: "2024-04-01".to_string(),
            payee: "Landlord".to_string(),
            notes: Some("April".to_string()),
            category: Some("Rent".to_string()),
            amount: -3.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    cash(
        &db_path,
        checking.id,
        "2024-05-01",
        100.0,
        "Salary",
        "Bonus",
    );
    crate::create_transaction_db(
        &db_path.to_path_buf(),
        crate::CreateTransactionArgs {
            account_id: checking.id,
            date: "2024-06-01".to_string(),
            payee: "Wild_card%name".to_string(),
            notes: Some("100%".to_string()),
            category: Some("Misc".to_string()),
            amount: -1.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    create_investment_transaction_db(
        &db_path,
        CreateInvestmentTransactionArgs {
            account_id: checking.id,
            date: "2024-07-01".to_string(),
            ticker: "AAPL".to_string(),
            shares: 2.0,
            price_per_share: 10.0,
            fee: 1.5,
            is_buy: true,
            currency: Some("USD".to_string()),
            payee: None,
            notes: None,
            category: None,
        },
    )
    .unwrap();

    let ids = [checking.id, savings.id];
    assert_eq!(
        payees(&db_path, &ids, rule("payee", "equals", "Market")),
        vec!["Market"]
    );
    assert!(
        !payees(&db_path, &ids, rule("payee", "not_equals", "Market"))
            .contains(&"Market".to_string())
    );
    assert_eq!(
        payees(&db_path, &ids, rule("payee", "contains", "ARK")),
        vec!["Market"]
    );
    assert!(
        !payees(&db_path, &ids, rule("payee", "not_contains", "ark"))
            .contains(&"Market".to_string())
    );
    assert_eq!(
        payees(&db_path, &ids, rule("payee", "ends_with", "ket")),
        vec!["Market"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("payee", "starts_with", "wild_card%")),
        vec!["Wild_card%name"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("notes", "contains", "shop")),
        vec!["Market"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("notes", "ends_with", "shop")),
        vec!["Market"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("notes", "is_empty", "")),
        vec!["Cafe", "Bonus"]
    );
    assert!(
        !payees(&db_path, &ids, rule("notes", "is_not_empty", "")).contains(&"Cafe".to_string())
    );
    assert_eq!(
        payees(&db_path, &ids, rule("account", "equals", "Checking")).len(),
        5
    );
    assert_eq!(
        payees(&db_path, &ids, rule("account", "not_equals", "Checking")),
        vec!["Cafe"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("ticker", "equals", "AAPL")),
        vec!["Buy"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("tags", "is_empty", "")).len(),
        6
    );
    assert_eq!(
        payees(&db_path, &ids, rule("tags", "is_not_empty", "")).len(),
        0
    );
    assert_eq!(
        payees(&db_path, &ids, rule("date", "equals", "2024-04-01")),
        vec!["Landlord"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("date", "less_than", "2024-02-01")),
        vec!["Market"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("date", "greater_than", "2024-06-01")),
        vec!["Buy"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("date", "greater_than", "")).len(),
        0
    );
    assert_eq!(
        payees(&db_path, &ids, rule("date", "less_than", "")).len(),
        0
    );
    assert_eq!(
        payees(
            &db_path,
            &ids,
            rule("category", "not_matches_regex", "^food$")
        )
        .len(),
        4
    );
    assert_eq!(
        payees(&db_path, &ids, rule("category", "matches_regex", "(")).len(),
        0
    );
    assert_eq!(
        payees(&db_path, &ids, rule("category", "not_matches_regex", "(")).len(),
        0
    );
    assert_eq!(
        payees(&db_path, &ids, rule("amount", "equals", "100")),
        vec!["Bonus"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("amount", "equals", "-12.5")),
        vec!["Market"]
    );
    assert!(
        !payees(&db_path, &ids, rule("amount", "not_equals", "100")).contains(&"Bonus".to_string())
    );
    assert_eq!(
        payees(&db_path, &ids, rule("amount", "greater_than", "50")),
        vec!["Bonus"]
    );
    assert!(
        payees(&db_path, &ids, rule("amount", "less_than", "-10")).contains(&"Market".to_string())
    );
    assert_eq!(
        payees(&db_path, &ids, rule("amount", "greater_than", "abc")).len(),
        0
    );
    assert_eq!(
        payees(&db_path, &ids, rule("amount", "is_empty", "")).len(),
        0
    );
    assert_eq!(
        payees(&db_path, &ids, rule("amount", "is_not_empty", "")).len(),
        6
    );
    assert_eq!(
        payees(&db_path, &ids, rule("fee", "is_not_empty", "")),
        vec!["Buy"]
    );
    assert_eq!(payees(&db_path, &ids, rule("fee", "is_empty", "")).len(), 5);
    assert_eq!(
        payees(&db_path, &ids, rule("fee", "greater_than", "1")),
        vec!["Buy"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("fee", "less_than", "2")),
        vec!["Buy"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("fee", "greater_than", "")).len(),
        0
    );
    assert_eq!(
        payees(&db_path, &ids, rule("shares", "equals", "2")),
        vec!["Buy"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("shares", "greater_than", "1")),
        vec!["Buy"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("shares", "is_empty", "")).len(),
        5
    );
    assert_eq!(
        payees(&db_path, &ids, rule("price", "equals", "10")),
        vec!["Buy"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("price", "is_not_empty", "")),
        vec!["Buy"]
    );
    assert_eq!(
        payees(&db_path, &ids, rule("price", "is_empty", "")).len(),
        5
    );

    let bad_field =
        query_dashboard_transactions_db(&db_path, &ids, &[rule("color", "equals", "red")]);
    assert!(bad_field
        .unwrap_err()
        .contains("unsupported dashboard filter field"));
    let bad_text =
        query_dashboard_transactions_db(&db_path, &ids, &[rule("payee", "between", "a")]);
    assert!(bad_text
        .unwrap_err()
        .contains("unsupported dashboard filter operator"));
    let bad_number =
        query_dashboard_transactions_db(&db_path, &ids, &[rule("amount", "between", "1")]);
    assert!(bad_number
        .unwrap_err()
        .contains("unsupported dashboard filter operator"));
}
