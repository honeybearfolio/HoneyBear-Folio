import { describe, it, expect } from "vitest";
import { buildNetWorthChartData } from "../../../features/dashboard/dashboard-networth-chart";
import { buildExpensesByCategoryData } from "../../../features/dashboard/dashboard-expenses-chart";
import { buildIncomeVsExpensesData } from "../../../features/dashboard/dashboard-income-expenses-chart";
import i18n from "../../../i18n/i18n";
import type { Account } from "../../../api/types";
import type { Transaction } from "../../../features/dashboard/dashboard-types";

const t = i18n.t.bind(i18n);
const chartColors = {
  primary: "#000",
  secondary: "#111",
  success: "#0f0",
  line: "rgb(59, 130, 246)",
  profit: "rgb(16, 185, 129)",
  loss: "rgb(239, 68, 68)",
  text: "rgb(100, 116, 139)",
  grid: "rgba(0,0,0,0.1)",
  background: "#fff",
  tooltipBg: "#000",
  tooltipText: "#fff",
  palette: ["rgb(59, 130, 246)", "rgb(16, 185, 129)"],
};

const accounts: Account[] = [
  { id: 1, name: "Checking", balance: 1000, currency: "USD" },
];
const transactions: Transaction[] = [
  {
    id: 1,
    account_id: 1,
    date: "2024-06-01",
    amount: 100,
    category: "Salary",
  },
  {
    id: 2,
    account_id: 1,
    date: "2024-06-02",
    amount: -40,
    category: "Food",
  },
];

const getPrice = () => 1;

describe("dashboard chart data builders", () => {
  it("buildNetWorthChartData returns null without accounts or transactions", () => {
    expect(
      buildNetWorthChartData({
        filteredAccounts: [],
        filteredTransactions: transactions,
        timeRange: "1Y",
        customStartDate: new Date("2024-01-01"),
        customEndDate: new Date("2024-12-31"),
        formatDate: (d) => d,
        appCurrency: "USD",
        getPrice,
        chartColors,
        currentNetWorth: 1000,
        t,
      }),
    ).toBeNull();
  });

  it("buildNetWorthChartData includes total and account datasets", () => {
    const result = buildNetWorthChartData({
      filteredAccounts: accounts,
      filteredTransactions: transactions,
      timeRange: "1M",
      customStartDate: new Date("2024-01-01"),
      customEndDate: new Date("2024-12-31"),
      formatDate: (d) => d,
      appCurrency: "USD",
      getPrice,
      chartColors,
      currentNetWorth: 1060,
      t,
    });

    expect(result).not.toBeNull();
    expect(result!.datasets.length).toBeGreaterThanOrEqual(2);
    expect(result!.datasets[0]!.label).toBe(t("dashboard.datasets.total_net_worth"));
    expect(result!.datasets[result!.datasets.length - 1]!.label).toBe("Checking");
  });

  it("buildExpensesByCategoryData marks empty expense periods", () => {
    const incomeOnly: Transaction[] = [
      {
        id: 3,
        account_id: 1,
        date: "2024-06-01",
        amount: 100,
        category: "Salary",
      },
    ];

    const result = buildExpensesByCategoryData({
      filteredTransactions: incomeOnly,
      timeRange: "1Y",
      customStartDate: new Date("2024-01-01"),
      customEndDate: new Date("2024-12-31"),
      accountMap: { 1: accounts[0]! },
      appCurrency: "USD",
      getPrice,
      isDark: false,
      chartColors,
      t,
    });

    expect(result).toEqual({ empty: true, labels: [], datasets: [] });
  });

  it("buildIncomeVsExpensesData aggregates income and expenses", () => {
    const recentTransactions: Transaction[] = [
      {
        id: 1,
        account_id: 1,
        date: "2024-06-01",
        amount: 100,
        category: "Salary",
      },
      {
        id: 2,
        account_id: 1,
        date: "2024-06-15",
        amount: -40,
        category: "Food",
      },
    ];

    const result = buildIncomeVsExpensesData({
      filteredTransactions: recentTransactions,
      timeRange: "ALL",
      customStartDate: new Date("2024-01-01"),
      customEndDate: new Date("2024-12-31"),
      formatDate: (d) => d,
      locale: "en-US",
      accountMap: { 1: accounts[0]! },
      appCurrency: "USD",
      getPrice,
      chartColors,
      t,
    });

    expect(result).not.toBeNull();
    const incomeTotal = result!.datasets[0]!.data.reduce((sum, v) => sum + v, 0);
    const expenseTotal = result!.datasets[1]!.data.reduce((sum, v) => sum + v, 0);
    expect(incomeTotal).toBe(100);
    expect(expenseTotal).toBe(40);
  });
});
