import { describe, it, expect } from "vitest";
import {
  buildNetWorthChartData,
  buildNetWorthChartFromSeries,
} from "../../../features/dashboard/dashboard-networth-chart";
import {
  buildExpensesByCategoryData,
  buildExpensesByCategoryFromSeries,
} from "../../../features/dashboard/dashboard-expenses-chart";
import {
  buildIncomeVsExpensesData,
  buildIncomeVsExpensesFromSeries,
} from "../../../features/dashboard/dashboard-income-expenses-chart";
import type { DashboardChartSeries } from "../../../features/dashboard/dashboard-series";
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
    payee: "",
    amount: 100,
    category: "Salary",
  },
  {
    id: 2,
    account_id: 1,
    date: "2024-06-02",
    payee: "",
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
        totalAssetsValue: 0,
        totalLiabilitiesValue: 0,
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
      totalAssetsValue: 0,
      totalLiabilitiesValue: 0,
      t,
    });

    expect(result).not.toBeNull();
    expect(result!.datasets.length).toBeGreaterThanOrEqual(2);
    expect(result!.datasets[0]!.label).toBe(
      t("dashboard.datasets.total_net_worth"),
    );
    expect(result!.datasets[result!.datasets.length - 1]!.label).toBe(
      "Checking",
    );
  });

  it("buildExpensesByCategoryData marks empty expense periods", () => {
    const incomeOnly: Transaction[] = [
      {
        id: 3,
        account_id: 1,
        date: "2024-06-01",
        payee: "",
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
        payee: "",
        amount: 100,
        category: "Salary",
      },
      {
        id: 2,
        account_id: 1,
        date: "2024-06-15",
        payee: "",
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
    const incomeTotal = result!.datasets[0]!.data.reduce(
      (sum, v) => sum + v,
      0,
    );
    const expenseTotal = result!.datasets[1]!.data.reduce(
      (sum, v) => sum + v,
      0,
    );
    expect(incomeTotal).toBe(100);
    expect(expenseTotal).toBe(40);
  });

  it("builds the standard charts from aggregate series", () => {
    const series: DashboardChartSeries = {
      dates: ["2024-06-01", "2024-06-02"],
      totals: [100, 60],
      accounts: [
        {
          accountId: 1,
          currency: "USD",
          native: [100, 60],
          converted: [100, 60],
        },
      ],
      incomeExpense: [{ key: "2024-06", income: 100, expenses: 40 }],
      categories: [{ category: "Food", amount: 40 }],
      tickers: [],
      bucket: "month",
    };

    const netWorth = buildNetWorthChartFromSeries({
      series,
      filteredAccounts: accounts,
      formatDate: (date) => date,
      chartColors,
      currentNetWorth: 1060,
      totalAssetsValue: 5,
      totalLiabilitiesValue: 1,
      t,
    });
    expect(netWorth!.datasets[0]!.data).toEqual([104, 1060]);
    expect(netWorth!.datasets[1]!.label).toBe("Checking");
    expect(netWorth!.datasets[1]!.data).toEqual([100, 60]);

    const income = buildIncomeVsExpensesFromSeries({
      series,
      formatDate: (date) => date,
      locale: "en-US",
      chartColors,
      t,
    });
    expect(income!.datasets[0]!.data).toEqual([100]);
    expect(income!.datasets[1]!.data).toEqual([40]);

    const expenses = buildExpensesByCategoryFromSeries({
      series,
      isDark: false,
      chartColors,
      t,
    });
    expect(expenses!.labels).toEqual(["Food"]);
    expect(expenses!.datasets[0]!.data).toEqual([40]);

    expect(
      buildExpensesByCategoryFromSeries({
        series: { ...series, categories: [] },
        isDark: false,
        chartColors,
        t,
      }),
    ).toEqual({ empty: true, labels: [], datasets: [] });
  });
});
