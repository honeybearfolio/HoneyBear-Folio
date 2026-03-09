import { describe, expect, it } from "vitest";
import { computeReportData } from "../../utils/report";

describe("computeReportData", () => {
  it("builds multicurrency summary and cash-flow totals with investment split", () => {
    const accounts = [
      { id: 1, name: "Cash USD", balance: 1000, currency: "USD" },
      { id: 2, name: "Euro Wallet", balance: 500, currency: "EUR" },
    ];

    const transactions = [
      {
        account_id: 2,
        date: "2025-01-10",
        payee: "Employer",
        category: "Salary",
        amount: 1000,
      },
      {
        account_id: 2,
        date: "2025-01-11",
        payee: "Groceries",
        category: "Food",
        amount: -200,
      },
      {
        account_id: 2,
        date: "2025-01-12",
        payee: "Broker",
        category: "Brokerage Deposit",
        amount: -50,
      },
      {
        account_id: 2,
        date: "2025-01-13",
        payee: "Move",
        category: "Transfer",
        amount: -100,
      },
    ];

    const exchangeRates = {
      "EURUSD=X": {
        map: { "2025-01-10": 1.2 },
        list: [
          { date: "2025-01-09", price: 1.1 },
          { date: "2025-01-10", price: 1.2 },
        ],
      },
    };

    const report = computeReportData({
      accounts,
      transactions,
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      appCurrency: "USD",
      exchangeRates,
      quotes: [],
      labels: {},
    });

    expect(report.summary.total_income).toBeCloseTo(1200);
    expect(report.summary.total_expenses).toBeCloseTo(300);
    expect(report.summary.net_savings).toBeCloseTo(900);
    expect(report.summary.savings_rate).toBeCloseTo(75);
    expect(report.summary.account_count).toBe(2);

    expect(report.cash_flow.total_income).toBeCloseTo(1200);
    expect(report.cash_flow.total_expenses).toBeCloseTo(240);
    expect(report.cash_flow.total_investments).toBeCloseTo(60);
    expect(report.cash_flow.surplus_or_deficit).toBeCloseTo(900);

    expect(report.expense_categories.map((c) => c.category)).toEqual([
      "Food",
      "Brokerage Deposit",
    ]);
    expect(report.portfolio).toBeNull();
    expect(report.accounts_transactions).toHaveLength(1);
  });

  it("builds portfolio totals and holdings when quote data is available", () => {
    const report = computeReportData({
      accounts: [{ id: 1, name: "Brokerage", balance: 0, currency: "USD" }],
      transactions: [
        {
          account_id: 1,
          date: "2025-01-01",
          payee: "Buy",
          category: "Investing",
          amount: -1000,
          ticker: "AAPL",
          shares: 5,
          price_per_share: 200,
          fee: 0,
        },
      ],
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      appCurrency: "USD",
      exchangeRates: {},
      quotes: [{ symbol: "AAPL", regularMarketPrice: 220 }],
      labels: {},
    });

    expect(report.portfolio).not.toBeNull();
    expect(report.portfolio.total_value).toBeCloseTo(1100);
    expect(report.portfolio.total_cost_basis).toBeCloseTo(1000);
    expect(report.portfolio.overall_roi).toBeCloseTo(10);
    expect(report.portfolio.holdings).toHaveLength(1);
    expect(report.portfolio.holdings[0].ticker).toBe("AAPL");
  });
});
