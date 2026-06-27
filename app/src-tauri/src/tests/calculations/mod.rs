use crate::core::calculations::{
    build_holdings_from_transactions_logic, calculate_deterministic_projection_logic,
    compute_net_worth_logic, compute_net_worth_market_values_logic, compute_portfolio_totals_logic,
    compute_report_data_logic, merge_holdings_with_quotes_logic, run_monte_carlo_simulation_logic,
    DeterministicProjectionInput, Holding, HoldingWithQuote, MonteCarloInput, ReportComputeInput,
};
use crate::core::models::{Account, Transaction, YahooQuote};
use serde_json::{json, Value};
use std::collections::HashMap;

fn base_account() -> Account {
    Account {
        id: 1,
        name: "Main".into(),
        balance: 1000.0,
        currency: Some("USD".into()),
        exchange_rate: 1.0,
    }
}

fn tx(amount: f64, date: &str) -> Transaction {
    Transaction {
        id: 1,
        account_id: 1,
        date: date.into(),
        payee: "P".into(),
        notes: None,
        category: Some("Salary".into()),
        amount,
        ticker: None,
        shares: None,
        price_per_share: None,
        fee: None,
        currency: Some("USD".into()),
    }
}

#[test]
fn compute_net_worth_applies_market_values() {
    let accounts = vec![base_account()];
    let mut mv = HashMap::<String, Value>::new();
    mv.insert("1".into(), json!(250.0));

    let result = compute_net_worth_logic(&accounts, &mv, None);
    assert_eq!(result, 1250.0);
}

#[test]
fn compute_net_worth_includes_total_assets_value() {
    let accounts = vec![base_account()];
    let mv = HashMap::<String, Value>::new();

    let result = compute_net_worth_logic(&accounts, &mv, Some(5000.0));
    assert_eq!(result, 6000.0);
}

#[test]
fn compute_net_worth_ignores_non_finite_total_assets_value() {
    let accounts = vec![base_account()];
    let mv = HashMap::<String, Value>::new();

    let result = compute_net_worth_logic(&accounts, &mv, Some(f64::NAN));
    assert_eq!(result, 1000.0);
}

#[test]
fn holdings_cost_basis_tracks_buys_and_sells() {
    let transactions = vec![
        Transaction {
            id: 1,
            account_id: 1,
            date: "2023-01-01".into(),
            payee: "Buy".into(),
            notes: None,
            category: Some("Invest".into()),
            amount: -1505.0,
            ticker: Some("AAPL".into()),
            shares: Some(10.0),
            price_per_share: Some(150.0),
            fee: Some(5.0),
            currency: Some("USD".into()),
        },
        Transaction {
            id: 2,
            account_id: 1,
            date: "2023-02-01".into(),
            payee: "Sell".into(),
            notes: None,
            category: Some("Invest".into()),
            amount: 300.0,
            ticker: Some("AAPL".into()),
            shares: Some(-2.0),
            price_per_share: Some(150.0),
            fee: Some(0.0),
            currency: Some("USD".into()),
        },
    ];

    let result = build_holdings_from_transactions_logic(&transactions);
    assert_eq!(result.current_holdings.len(), 1);
    assert_eq!(result.current_holdings[0].shares, 8.0);
    assert!((result.current_holdings[0].cost_basis - 1204.0).abs() < 1e-6);
}

#[test]
fn merge_holdings_with_quotes_calculates_value_and_roi() {
    let holdings = vec![
        Holding {
            ticker: "AAPL".into(),
            shares: 10.0,
            cost_basis: 1500.0,
        },
        Holding {
            ticker: "GOOGL".into(),
            shares: 5.0,
            cost_basis: 5000.0,
        },
    ];
    let quotes = vec![YahooQuote {
        symbol: "AAPL".into(),
        price: 200.0,
        change_percent: 1.5,
        currency: Some("USD".into()),
        quote_type: Some("EQUITY".into()),
    }];

    let merged = merge_holdings_with_quotes_logic(&holdings, &quotes);
    assert_eq!(merged.len(), 2);

    let aapl = merged.iter().find(|h| h.ticker == "AAPL").unwrap();
    assert_eq!(aapl.price, 200.0);
    assert_eq!(aapl.current_value, 2000.0);
    assert!((aapl.roi - 33.333333333).abs() < 1e-6);

    let googl = merged.iter().find(|h| h.ticker == "GOOGL").unwrap();
    assert_eq!(googl.price, 0.0);
    assert_eq!(googl.current_value, 0.0);
    assert_eq!(googl.roi, -100.0);
}

#[test]
fn compute_portfolio_totals_sums_fields() {
    let holdings = vec![
        HoldingWithQuote {
            ticker: "AAPL".into(),
            shares: 10.0,
            cost_basis: 1500.0,
            price: 200.0,
            current_value: 2000.0,
            roi: 33.333333,
            change_percent: 1.2,
            quote_type: Some("EQUITY".into()),
        },
        HoldingWithQuote {
            ticker: "GOOGL".into(),
            shares: 5.0,
            cost_basis: 5000.0,
            price: 0.0,
            current_value: 0.0,
            roi: -100.0,
            change_percent: 0.0,
            quote_type: None,
        },
    ];

    let totals = compute_portfolio_totals_logic(&holdings);
    assert_eq!(totals.total_value, 2000.0);
    assert_eq!(totals.total_cost_basis, 6500.0);
}

#[test]
fn net_worth_market_values_groups_by_account_and_symbol() {
    let transactions = vec![
        Transaction {
            id: 1,
            account_id: 1,
            date: "2025-01-01".into(),
            payee: "Buy".into(),
            notes: None,
            category: Some("Invest".into()),
            amount: -1000.0,
            ticker: Some("AAPL".into()),
            shares: Some(5.0),
            price_per_share: Some(200.0),
            fee: Some(0.0),
            currency: Some("USD".into()),
        },
        Transaction {
            id: 2,
            account_id: 1,
            date: "2025-01-02".into(),
            payee: "Buy".into(),
            notes: None,
            category: Some("Invest".into()),
            amount: -440.0,
            ticker: Some("MSFT".into()),
            shares: Some(2.0),
            price_per_share: Some(220.0),
            fee: Some(0.0),
            currency: Some("USD".into()),
        },
        Transaction {
            id: 3,
            account_id: 2,
            date: "2025-01-03".into(),
            payee: "Buy".into(),
            notes: None,
            category: Some("Invest".into()),
            amount: -600.0,
            ticker: Some("AAPL".into()),
            shares: Some(3.0),
            price_per_share: Some(200.0),
            fee: Some(0.0),
            currency: Some("USD".into()),
        },
    ];
    let quotes = vec![
        YahooQuote {
            symbol: "AAPL".into(),
            price: 220.0,
            change_percent: 0.0,
            currency: Some("USD".into()),
            quote_type: Some("EQUITY".into()),
        },
        YahooQuote {
            symbol: "MSFT".into(),
            price: 250.0,
            change_percent: 0.0,
            currency: Some("USD".into()),
            quote_type: Some("EQUITY".into()),
        },
    ];

    let result = compute_net_worth_market_values_logic(&transactions, &quotes);
    assert_eq!(result.get("1").copied().unwrap_or(0.0), 1600.0);
    assert_eq!(result.get("2").copied().unwrap_or(0.0), 660.0);
}

#[test]
fn deterministic_projection_behaves_like_js() {
    let input = DeterministicProjectionInput {
        current_net_worth: 100000.0,
        annual_savings: 20000.0,
        annual_expenses: 40000.0,
        expected_return: 7.0,
        inflation: 2.0,
        withdrawal_rate: 4.0,
        max_years: 50,
    };

    let result = calculate_deterministic_projection_logic(&input);
    assert_eq!(result.fire_number, 2040000.0);
    assert_eq!(result.projection_data.len(), 51);
}

#[test]
fn deterministic_projection_handles_unreachable_fire() {
    let input = DeterministicProjectionInput {
        current_net_worth: 0.0,
        annual_savings: 0.0,
        annual_expenses: 50000.0,
        expected_return: 0.0,
        inflation: 5.0,
        withdrawal_rate: 4.0,
        max_years: 50,
    };
    let result = calculate_deterministic_projection_logic(&input);
    assert!(result.fire_number.is_infinite());
    assert!(result.never_reached);
    assert_eq!(result.years_to_fire, None);
}

#[test]
fn monte_carlo_output_has_expected_shape() {
    let input = MonteCarloInput {
        current_net_worth: 500000.0,
        annual_savings: 20000.0,
        annual_expenses: 40000.0,
        expected_return: 7.0,
        inflation: 2.0,
        volatility: 15.0,
        current_age: 40,
        retirement_age: 65,
        retirement_duration: 30,
        simulation_count: 100,
    };

    let result = run_monte_carlo_simulation_logic(&input);
    assert!(result.success_rate >= 0.0 && result.success_rate <= 100.0);
    assert_eq!(result.years_to_retirement, 25);
    assert_eq!(result.total_years, 55);
    assert_eq!(result.percentiles.p50.len(), 56);
}

#[test]
fn report_data_contains_expected_summary() {
    let input = ReportComputeInput {
        accounts: vec![base_account()],
        transactions: vec![tx(1000.0, "2025-01-10"), tx(-200.0, "2025-01-12")],
        start_date: "2025-01-01".into(),
        end_date: "2025-01-31".into(),
        app_currency: "USD".into(),
        exchange_rates: HashMap::new(),
        quotes: vec![YahooQuote {
            symbol: "AAPL".into(),
            price: 220.0,
            change_percent: 0.0,
            currency: Some("USD".into()),
            quote_type: Some("EQUITY".into()),
        }],
        labels: json!({"title":"Report"}),
    };

    let report = compute_report_data_logic(&input);
    assert_eq!(report["summary"]["total_income"], json!(1000.0));
    assert_eq!(report["summary"]["total_expenses"], json!(200.0));
    assert_eq!(report["summary"]["net_savings"], json!(800.0));
}

#[test]
fn report_data_builds_portfolio_when_quotes_present() {
    let buy_tx = Transaction {
        id: 1,
        account_id: 1,
        date: "2025-01-01".into(),
        payee: "Buy".into(),
        notes: None,
        category: Some("Investing".into()),
        amount: -1000.0,
        ticker: Some("AAPL".into()),
        shares: Some(5.0),
        price_per_share: Some(200.0),
        fee: Some(0.0),
        currency: Some("USD".into()),
    };

    let input = ReportComputeInput {
        accounts: vec![base_account()],
        transactions: vec![buy_tx],
        start_date: "2025-01-01".into(),
        end_date: "2025-01-31".into(),
        app_currency: "USD".into(),
        exchange_rates: HashMap::new(),
        quotes: vec![YahooQuote {
            symbol: "AAPL".into(),
            price: 220.0,
            change_percent: 0.0,
            currency: Some("USD".into()),
            quote_type: Some("EQUITY".into()),
        }],
        labels: json!({"title":"Report"}),
    };

    let report = compute_report_data_logic(&input);
    assert_eq!(report["portfolio"]["total_value"], json!(1100.0));
    assert_eq!(report["portfolio"]["total_cost_basis"], json!(1000.0));
    assert_eq!(report["portfolio"]["overall_roi"], json!(10.0));
}
