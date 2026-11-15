use crate::core::calculations::{
    collect_tickers, compute_net_worth_logic, compute_report_data_logic,
    run_monte_carlo_simulation_logic, ExchangeRatePoint, ExchangeRateSeries, MonteCarloInput,
    ReportComputeInput,
};
use crate::core::goals::{
    create_goal_db, delete_goal_db, update_goal_db, GoalLinkInput, GoalWrite, UpdateGoalArgs,
};
use crate::core::io::{read_xlsx, write_xlsx, SheetData};
use crate::core::llm_tools::execute_tool;
use crate::core::models::{Account, ScheduledTransaction, Transaction};
use crate::core::rules::{create_rule_db, CreateRuleDbParams};
use crate::core::scheduled::{
    apply_scheduled_occurrence_db, compute_occurrences, create_scheduled_transaction_db,
    get_pending_occurrences_db, CreateScheduledTransactionArgs,
};
use crate::tests::common::setup_db;
use chrono::NaiveDate;
use serde_json::{json, Value};
use std::collections::HashMap;

fn date(y: i32, m: u32, d: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(y, m, d).unwrap()
}

fn schedule(kind: &str) -> ScheduledTransaction {
    ScheduledTransaction {
        id: 1,
        account_id: 1,
        payee: "P".into(),
        amount: -10.0,
        category: None,
        notes: None,
        currency: None,
        recurrence_type: kind.into(),
        interval_value: Some(1),
        interval_unit: Some("month".into()),
        days_of_week: None,
        ordinal: None,
        weekday: None,
        start_date: "2024-01-01".into(),
        end_date: None,
        max_occurrences: None,
        occurrences_count: 0,
        last_applied_date: None,
        enabled: true,
        transaction_type: "regular".into(),
        ticker: None,
        shares: None,
        price_per_share: None,
        fee: None,
        is_buy: None,
    }
}

fn tx(account_id: i32, date: &str, amount: f64, category: Option<&str>) -> Transaction {
    Transaction {
        id: 1,
        account_id,
        date: date.into(),
        payee: "P".into(),
        notes: None,
        category: category.map(Into::into),
        amount,
        ticker: None,
        shares: None,
        price_per_share: None,
        fee: None,
        currency: None,
    }
}

// ── scheduled ────────────────────────────────────────────────────────

#[test]
fn test_every_n_units_and_end_date() {
    let mut s = schedule("every_n");
    s.start_date = "2024-01-31".into();
    let monthly = compute_occurrences(&s, date(2024, 1, 1), date(2024, 3, 31));
    assert_eq!(
        monthly,
        vec![date(2024, 1, 31), date(2024, 2, 29), date(2024, 3, 29)]
    );

    s.interval_unit = Some("week".into());
    s.end_date = Some("2024-02-15".into());
    let weekly = compute_occurrences(&s, date(2024, 1, 1), date(2024, 3, 31));
    assert_eq!(weekly.len(), 3);

    s.interval_unit = Some("year".into());
    s.end_date = None;
    let yearly = compute_occurrences(&s, date(2024, 1, 1), date(2026, 12, 31));
    assert_eq!(yearly.len(), 3);

    s.start_date = "not-a-date".into();
    assert!(compute_occurrences(&s, date(2024, 1, 1), date(2024, 12, 31)).is_empty());
}

#[test]
fn test_day_of_week_edge_cases() {
    let mut s = schedule("day_of_week");
    assert!(compute_occurrences(&s, date(2024, 1, 1), date(2024, 1, 31)).is_empty());

    s.days_of_week = Some(vec![1, 3, 9]);
    s.end_date = Some("2024-01-15".into());
    let limited = compute_occurrences(&s, date(2024, 1, 1), date(2024, 1, 31));
    assert_eq!(limited.len(), 5);

    s.end_date = None;
    s.max_occurrences = Some(2);
    let capped = compute_occurrences(&s, date(2024, 1, 1), date(2024, 1, 31));
    assert_eq!(capped.len(), 2);

    s.start_date = "bad".into();
    assert!(compute_occurrences(&s, date(2024, 1, 1), date(2024, 1, 31)).is_empty());
}

#[test]
fn test_ordinal_weekday_edge_cases() {
    let mut s = schedule("ordinal_weekday");
    assert!(compute_occurrences(&s, date(2024, 1, 1), date(2024, 6, 30)).is_empty());

    s.ordinal = Some(1);
    assert!(compute_occurrences(&s, date(2024, 1, 1), date(2024, 6, 30)).is_empty());

    s.weekday = Some(9);
    assert!(compute_occurrences(&s, date(2024, 1, 1), date(2024, 6, 30)).is_empty());

    s.weekday = Some(1);
    s.start_date = "bad".into();
    assert!(compute_occurrences(&s, date(2024, 1, 1), date(2024, 6, 30)).is_empty());

    s.start_date = "2024-01-01".into();
    s.end_date = Some("2024-03-15".into());
    assert_eq!(
        compute_occurrences(&s, date(2024, 1, 1), date(2024, 6, 30)).len(),
        3
    );

    s.end_date = None;
    s.max_occurrences = Some(2);
    assert_eq!(
        compute_occurrences(&s, date(2024, 1, 1), date(2024, 6, 30)).len(),
        2
    );
}

fn create_args(account_id: i32, kind: &str) -> CreateScheduledTransactionArgs {
    CreateScheduledTransactionArgs {
        account_id,
        payee: "Plan".into(),
        amount: -20.0,
        category: None,
        notes: None,
        currency: None,
        recurrence_type: "every_n".into(),
        interval_value: Some(1),
        interval_unit: Some("month".into()),
        days_of_week: None,
        ordinal: None,
        weekday: None,
        start_date: "2024-01-01".into(),
        end_date: None,
        max_occurrences: Some(2),
        transaction_type: Some(kind.into()),
        ticker: Some("AAPL".into()),
        shares: Some(2.0),
        price_per_share: Some(10.0),
        fee: Some(1.0),
        is_buy: Some(true),
    }
}

#[test]
fn test_apply_investment_occurrence_and_pending_filters() {
    let (_dir, db_path) = setup_db();
    let acc = crate::create_account_db(&db_path, "Broker".into(), 1000.0, None, None).unwrap();
    let other = crate::create_account_db(&db_path, "Other".into(), 0.0, None, None).unwrap();

    let invest_id =
        create_scheduled_transaction_db(&db_path, create_args(acc.id, "investment")).unwrap();
    let mut disabled = create_args(other.id, "regular");
    disabled.max_occurrences = None;
    create_scheduled_transaction_db(&db_path, disabled).unwrap();

    let pending = get_pending_occurrences_db(&db_path, Some(acc.id), "2024-01-02").unwrap();
    assert!(pending.iter().all(|o| o.account_id == acc.id));
    assert_eq!(pending[0].status, "missed");

    apply_scheduled_occurrence_db(&db_path, invest_id, "2024-01-01").unwrap();
    let txs = crate::get_transactions_db(&db_path, acc.id).unwrap();
    assert!(txs
        .iter()
        .any(|t| t.ticker.as_deref() == Some("AAPL") && t.shares == Some(2.0)));

    assert!(get_pending_occurrences_db(&db_path, None, "garbage").is_err());
}

// ── goals ────────────────────────────────────────────────────────────

fn goal(monthly: Option<f64>, links: Vec<GoalLinkInput>) -> GoalWrite {
    GoalWrite {
        name: "Goal".into(),
        target_amount: 100.0,
        currency: None,
        target_date: None,
        monthly_contribution: monthly,
        notes: None,
        color: None,
        links,
    }
}

#[test]
fn test_goal_validation_and_link_types() {
    let (_dir, db_path) = setup_db();

    let err = create_goal_db(&db_path, &goal(Some(0.0), vec![])).unwrap_err();
    assert!(err.contains("Monthly contribution"));

    let holding = |account_id: Option<i32>| GoalLinkInput {
        source_type: "holding".into(),
        account_id,
        ticker: Some("AAPL".into()),
        allocation_percent: 50.0,
    };
    create_goal_db(&db_path, &goal(None, vec![holding(None)])).unwrap();

    let unknown = GoalLinkInput {
        source_type: "mystery".into(),
        account_id: None,
        ticker: None,
        allocation_percent: 50.0,
    };
    let err = create_goal_db(&db_path, &goal(None, vec![unknown])).unwrap_err();
    assert!(err.contains("Unknown goal link type"));

    let update = UpdateGoalArgs {
        id: 9999,
        archived: false,
        goal: goal(None, vec![]),
    };
    assert!(update_goal_db(&db_path, &update)
        .unwrap_err()
        .contains("not found"));
    assert!(delete_goal_db(&db_path, 9999).is_err());
}

// ── accounts ─────────────────────────────────────────────────────────

#[test]
fn test_rename_and_update_reject_duplicate_names() {
    let (_dir, db_path) = setup_db();
    crate::create_account_db(&db_path, "Taken".into(), 0.0, None, None).unwrap();
    let acc = crate::create_account_db(&db_path, "Mine".into(), 0.0, None, None).unwrap();

    let err = crate::rename_account_db(&db_path, acc.id, "taken".into()).unwrap_err();
    assert!(err.contains("already exists"));
    let err = crate::update_account_db(&db_path, acc.id, "TAKEN".into(), None).unwrap_err();
    assert!(err.contains("already exists"));

    // Keeping its own name is allowed.
    crate::rename_account_db(&db_path, acc.id, "Mine".into()).unwrap();
}

// ── rules ────────────────────────────────────────────────────────────

#[test]
fn test_legacy_rules_apply_to_new_transactions() {
    let (_dir, db_path) = setup_db();
    let acc = crate::create_account_db(&db_path, "Cash".into(), 0.0, None, None).unwrap();

    for (field, pattern, action_field, value) in [
        ("payee", "Cafe", "notes", "legacy-notes"),
        ("notes", "lunch", "payee", "Renamed"),
        ("ticker", "AAPL", "category", "Stocks"),
        ("unknown", "x", "unknown", "y"),
    ] {
        create_rule_db(
            &db_path,
            CreateRuleDbParams {
                priority: 1,
                match_field: field.into(),
                match_pattern: pattern.into(),
                action_field: action_field.into(),
                action_value: value.into(),
                logic: "and".into(),
                conditions: vec![],
                actions: vec![],
            },
        )
        .unwrap();
    }
    create_rule_db(
        &db_path,
        CreateRuleDbParams {
            priority: 0,
            match_field: String::new(),
            match_pattern: String::new(),
            action_field: String::new(),
            action_value: String::new(),
            logic: "and".into(),
            conditions: vec![],
            actions: vec![],
        },
    )
    .unwrap();

    let created = crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
            account_id: acc.id,
            date: "2024-01-01".into(),
            payee: "Cafe".into(),
            notes: Some("lunch".into()),
            category: None,
            amount: -3.0,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency: None,
        },
    )
    .unwrap();
    assert_eq!(created.payee, "Renamed");
    assert!(created.notes.is_some());
}

// ── calculations ─────────────────────────────────────────────────────

#[test]
fn test_net_worth_parses_string_market_values() {
    let account = Account {
        id: 1,
        name: "A".into(),
        balance: 10.0,
        currency: None,
        exchange_rate: 1.0,
        archived: false,
    };
    let mut values: HashMap<String, Value> = HashMap::new();
    values.insert("1".into(), json!("5.5"));
    assert_eq!(
        compute_net_worth_logic(std::slice::from_ref(&account), &values, None, None),
        15.5
    );
    values.insert("1".into(), json!(["bad"]));
    assert_eq!(
        compute_net_worth_logic(&[account], &values, None, None),
        10.0
    );
}

#[test]
fn test_collect_tickers_skips_empty() {
    let mut a = tx(1, "2024-01-01", 1.0, None);
    a.ticker = Some("AAPL".into());
    let mut b = tx(1, "2024-01-01", 1.0, None);
    b.ticker = Some(String::new());
    let mut c = tx(1, "2024-01-02", 1.0, None);
    c.ticker = Some("AAPL".into());
    let tickers = collect_tickers(&[a, b, c, tx(1, "2024-01-03", 1.0, None)]);
    assert_eq!(tickers, vec!["AAPL".to_string()]);
}

#[test]
fn test_report_converts_currencies_and_sorts_categories() {
    let eur = Account {
        id: 1,
        name: "Euro".into(),
        balance: 100.0,
        currency: Some("EUR".into()),
        exchange_rate: 1.1,
        archived: false,
    };
    let empty = Account {
        id: 2,
        name: "Empty".into(),
        balance: 0.0,
        currency: None,
        exchange_rate: 1.0,
        archived: false,
    };
    let mut rates = HashMap::new();
    rates.insert(
        "EURUSD=X".to_string(),
        ExchangeRateSeries {
            map: HashMap::from([("2025-01-10".to_string(), 1.2)]),
            list: vec![
                ExchangeRatePoint {
                    date: "2025-01-01".into(),
                    price: 1.1,
                },
                ExchangeRatePoint {
                    date: "2025-02-01".into(),
                    price: 1.3,
                },
            ],
        },
    );

    let input = ReportComputeInput {
        accounts: vec![eur, empty],
        transactions: vec![
            tx(1, "2025-01-10", 100.0, Some("Salary")),
            tx(1, "2025-01-15", 50.0, Some("Gift")),
            tx(1, "2025-01-20", -10.0, Some("Food")),
            tx(1, "2025-02-05", -40.0, Some("Rent")),
            tx(1, "2025-02-06", -5.0, Some("Transfer")),
            tx(2, "2025-01-11", 7.0, None),
        ],
        start_date: "2025-01-01".into(),
        end_date: "2025-02-28".into(),
        app_currency: "USD".into(),
        exchange_rates: rates,
        quotes: vec![],
        labels: json!({}),
    };

    let report = compute_report_data_logic(&input);
    // 100 * 1.2 (exact date) + 50 * 1.1 (latest earlier point) + 7
    let income = report["summary"]["total_income"].as_f64().unwrap();
    assert!((income - (120.0 + 55.0 + 7.0)).abs() < 1e-6);
    let expenses = report["summary"]["total_expenses"].as_f64().unwrap();
    assert!((expenses - (10.0 * 1.1 + 40.0 * 1.3)).abs() < 1e-6);
    let months = report["monthly_income_expenses"].as_array().unwrap();
    assert_eq!(months[0]["label"], "2025-01");
    assert_eq!(months[1]["label"], "2025-02");
}

#[test]
fn test_monte_carlo_depletion_pads_balances() {
    let result = run_monte_carlo_simulation_logic(&MonteCarloInput {
        current_net_worth: 1000.0,
        annual_savings: 0.0,
        annual_expenses: 50000.0,
        expected_return: 0.0,
        inflation: 0.0,
        volatility: 1.0,
        current_age: 60,
        retirement_age: 61,
        retirement_duration: 20,
        simulation_count: 20,
    });
    assert_eq!(result.success_rate, 0.0);
    assert_eq!(result.percentiles.p50.len(), 22);
}

// ── llm tools ────────────────────────────────────────────────────────

#[tokio::test]
async fn test_execute_tool_transaction_filters() {
    let (_dir, db_path) = setup_db();
    let acc = crate::create_account_db(&db_path, "Cash".into(), 0.0, None, None).unwrap();
    for (d, payee, category, amount) in [
        ("2024-01-05", "Coffee Shop", "Food", -3.0),
        ("2024-02-05", "Landlord", "Rent", -500.0),
        ("2024-03-05", "Coffee Roasters", "Food", -9.0),
    ] {
        crate::create_transaction_db(
            &db_path,
            crate::CreateTransactionArgs {
                account_id: acc.id,
                date: d.into(),
                payee: payee.into(),
                notes: None,
                category: Some(category.into()),
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

    let client = reqwest::Client::builder().build().unwrap();
    let result = execute_tool(
        &client,
        &db_path,
        "get_transactions",
        &json!({
            "account_id": acc.id,
            "category": "FOOD",
            "payee": "coffee",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "limit": 1
        }),
    )
    .await
    .unwrap();
    assert_eq!(result.as_array().unwrap().len(), 1);

    let none = execute_tool(
        &client,
        &db_path,
        "get_transactions",
        &json!({ "account_id": acc.id + 1 }),
    )
    .await
    .unwrap();
    assert!(none.as_array().unwrap().is_empty());

    let outside = execute_tool(
        &client,
        &db_path,
        "get_transactions",
        &json!({ "start_date": "2030-01-01" }),
    )
    .await
    .unwrap();
    assert!(outside.as_array().unwrap().is_empty());

    for tool in ["get_accounts", "get_categories", "get_payees"] {
        assert!(execute_tool(&client, &db_path, tool, &json!({}))
            .await
            .is_ok());
    }
    assert!(execute_tool(&client, &db_path, "no_such_tool", &json!({}))
        .await
        .is_err());
}

// ── io ───────────────────────────────────────────────────────────────

#[test]
fn test_xlsx_roundtrip_with_nested_values_and_integers() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mixed.xlsx");

    write_xlsx(
        path.to_string_lossy().into_owned(),
        vec![SheetData {
            name: "Mixed".into(),
            data: vec![json!({
                "count": 3,
                "ratio": 0.5,
                "label": "x",
                "flag": true,
                "list": [1, 2],
                "object": { "a": 1 },
                "nothing": null
            })],
        }],
    )
    .unwrap();

    let result = read_xlsx(std::fs::read(&path).unwrap()).unwrap();
    assert_eq!(result.sheets.len(), 1);
    let flat: Vec<String> = result.data[1].iter().map(ToString::to_string).collect();
    assert!(flat.iter().any(|v| v.contains("[1,2]")));
    assert!(flat.iter().any(|v| v.contains("\\\"a\\\"")));
}

#[test]
fn test_read_xlsx_rejects_garbage() {
    assert!(read_xlsx(vec![1, 2, 3]).is_err());
}
