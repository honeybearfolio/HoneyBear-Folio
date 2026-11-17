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
    assert!(clamped.categories.is_empty());

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
    assert!(series.dates.is_empty());
    assert!(series.income_expense.is_empty());

    let rows = query_dashboard_transactions_db(&db_path, &[], &[]).unwrap();
    assert!(rows.is_empty());
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
    assert!(hostile.is_empty());
    assert_eq!(
        crate::get_transactions_db(&db_path, checking.id)
            .unwrap()
            .len(),
        2
    );
}
