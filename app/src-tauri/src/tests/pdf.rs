use crate::core::models::{
    ReportAccountBalance, ReportAccountTransactions, ReportCashFlow, ReportCategoryAmount,
    ReportData, ReportDataPoint, ReportHolding, ReportLabels, ReportMonthlyData, ReportPortfolio,
    ReportSummary, ReportTransaction,
};
use crate::core::pdf::{generate_pdf_report, generate_report};
use std::fs;

// Helper builder for minimal report data in tests
fn make_empty_report() -> ReportData {
    ReportData {
        date_range_start: "2023-01-01".into(),
        date_range_end: "2023-12-31".into(),
        currency_symbol: "$".into(),
        generation_date: "2023-01-01".into(),
        labels: ReportLabels {
            title: String::new(),
            financial_summary: String::new(),
            net_worth_evolution: String::new(),
            income_vs_expenses: String::new(),
            expense_breakdown: String::new(),
            income_breakdown: String::new(),
            cash_flow_summary: String::new(),
            investment_holdings: String::new(),
            transactions_title: String::new(),
            net_worth: String::new(),
            total_income: String::new(),
            total_expenses: String::new(),
            net_savings: String::new(),
            savings_rate: String::new(),
            accounts: String::new(),
            account: String::new(),
            currency: String::new(),
            cash_balance: String::new(),
            market_value: String::new(),
            total: String::new(),
            category: String::new(),
            amount: String::new(),
            percentage: String::new(),
            month: String::new(),
            income: String::new(),
            expenses: String::new(),
            net: String::new(),
            investments: String::new(),
            surplus: String::new(),
            deficit: String::new(),
            ticker: String::new(),
            shares: String::new(),
            price: String::new(),
            value: String::new(),
            cost_basis: String::new(),
            roi: String::new(),
            date: String::new(),
            payee: String::new(),
            notes: String::new(),
            fee: String::new(),
            page: String::new(),
            no_transactions: String::new(),
            portfolio_total: String::new(),
            overall_roi: String::new(),
        },
        summary: ReportSummary {
            net_worth: 0.0,
            total_income: 0.0,
            total_expenses: 0.0,
            net_savings: 0.0,
            savings_rate: 0.0,
            account_count: 0,
        },
        account_balances: Vec::new(),
        net_worth_points: Vec::new(),
        monthly_income_expenses: Vec::new(),
        expense_categories: Vec::new(),
        income_categories: Vec::new(),
        cash_flow: ReportCashFlow {
            total_income: 0.0,
            total_expenses: 0.0,
            total_investments: 0.0,
            surplus_or_deficit: 0.0,
            expense_categories: Vec::new(),
            investment_categories: Vec::new(),
        },
        portfolio: None,
        accounts_transactions: Vec::new(),
    }
}

#[test]
fn test_generate_report_minimal() {
    let data = make_empty_report();
    let bytes = generate_report(&data).expect("report generation failed");
    // PDF documents always start with "%PDF-"
    assert!(bytes.starts_with(b"%PDF"));
    assert!(bytes.len() > 100);
}

#[test]
fn test_generate_pdf_report_writes_file() {
    let data = make_empty_report();
    let tmp = std::env::temp_dir().join("honeybear_test_report.pdf");
    let path_str = tmp.to_string_lossy().into_owned();

    // ensure previous file removed
    let _ = fs::remove_file(&tmp);

    generate_pdf_report(path_str.clone(), data.clone()).expect("pdf command failed");

    assert!(tmp.exists(), "output PDF file should exist");
    let contents = fs::read(&tmp).expect("failed to read generated file");
    assert!(contents.starts_with(b"%PDF"));
    assert!(contents.len() > 100);

    // cleanup
    let _ = fs::remove_file(&tmp);
}

#[test]
fn test_generate_report_with_full_data() {
    let mut data = make_empty_report();
    data.labels.title = "Annual Report".into();
    data.summary = ReportSummary {
        net_worth: 125000.0,
        total_income: 85000.0,
        total_expenses: 42000.0,
        net_savings: 43000.0,
        savings_rate: 50.6,
        account_count: 2,
    };
    data.account_balances = vec![ReportAccountBalance {
        name: "Brokerage".into(),
        currency: "USD".into(),
        currency_symbol: "$".into(),
        cash_balance: 5000.0,
        market_value: 45000.0,
        total: 50000.0,
        exchange_rate: 1.0,
    }];
    data.net_worth_points = vec![
        ReportDataPoint {
            label: "Jan".into(),
            value: 100000.0,
        },
        ReportDataPoint {
            label: "Jun".into(),
            value: 125000.0,
        },
    ];
    data.monthly_income_expenses = vec![ReportMonthlyData {
        label: "January".into(),
        income: 7000.0,
        expenses: 3500.0,
    }];
    data.expense_categories = vec![ReportCategoryAmount {
        category: "Food".into(),
        amount: 800.0,
        percentage: 40.0,
    }];
    data.income_categories = vec![ReportCategoryAmount {
        category: "Salary".into(),
        amount: 7000.0,
        percentage: 100.0,
    }];
    data.cash_flow = ReportCashFlow {
        total_income: 85000.0,
        total_expenses: 42000.0,
        total_investments: 15000.0,
        surplus_or_deficit: 28000.0,
        expense_categories: data.expense_categories.clone(),
        investment_categories: vec![ReportCategoryAmount {
            category: "Stocks".into(),
            amount: 15000.0,
            percentage: 100.0,
        }],
    };
    data.portfolio = Some(ReportPortfolio {
        total_value: 45000.0,
        total_cost_basis: 40000.0,
        overall_roi: 12.5,
        holdings: vec![ReportHolding {
            ticker: "AAPL".into(),
            shares: 100.0,
            price: 180.0,
            current_value: 18000.0,
            cost_basis: 15000.0,
            roi: 20.0,
        }],
    });
    data.accounts_transactions = vec![ReportAccountTransactions {
        account_name: "Checking".into(),
        currency: "USD".into(),
        currency_symbol: "$".into(),
        exchange_rate: 1.0,
        transactions: vec![ReportTransaction {
            date: "2024-01-15".into(),
            payee: "Employer".into(),
            category: "Salary".into(),
            amount: 7000.0,
            notes: String::new(),
            ticker: String::new(),
            shares: 0.0,
            price_per_share: 0.0,
            fee: 0.0,
        }],
    }];

    let bytes = generate_report(&data).expect("full report generation failed");
    assert!(bytes.starts_with(b"%PDF"));
    assert!(bytes.len() > 5000);
}
