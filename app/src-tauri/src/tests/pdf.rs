use crate::core::models::{ReportCashFlow, ReportData, ReportLabels, ReportSummary};
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
