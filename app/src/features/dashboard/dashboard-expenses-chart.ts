import type { TFunction } from "i18next";
import type { Account } from "../../api/types";
import type { ChartColors } from "../../hooks/useChartColors";
import {
  DEFAULT_EXPENSE_CHART_PALETTE,
  type DashboardTimeRange,
} from "./dashboard-constants";
import type { GetPriceFn } from "./dashboard-prices";
import type { DashboardChartSeries } from "./dashboard-series";
import { computeExpenseDateRange } from "./dashboard-time-range";
import type { Transaction } from "./dashboard-types";

export interface ExpensesByCategoryChartData {
  empty?: boolean;
  labels: string[];
  datasets: Array<{
    data: number[];
    backgroundColor: string[];
    borderColor: string;
    borderWidth: number;
    hoverOffset: number;
  }>;
}

interface BuildExpensesByCategoryDataArgs {
  filteredTransactions: Transaction[];
  timeRange: DashboardTimeRange;
  customStartDate: Date;
  customEndDate: Date;
  accountMap: Record<string | number, Account>;
  appCurrency: string;
  getPrice: GetPriceFn;
  isDark: boolean;
  chartColors: ChartColors;
  t: TFunction;
}

export function buildExpensesByCategoryData({
  filteredTransactions,
  timeRange,
  customStartDate,
  customEndDate,
  accountMap,
  appCurrency,
  getPrice,
  isDark,
  chartColors,
  t,
}: BuildExpensesByCategoryDataArgs): ExpensesByCategoryChartData | null {
  if (filteredTransactions.length === 0) return null;

  const { startStr, endStr } = computeExpenseDateRange(
    timeRange,
    customStartDate,
    customEndDate,
  );

  const expenses = filteredTransactions.filter(
    (tx) =>
      tx.amount < 0 &&
      tx.category !== "Transfer" &&
      !tx.ticker &&
      tx.date >= startStr &&
      tx.date <= endStr,
  );

  if (expenses.length === 0) return { empty: true, labels: [], datasets: [] };

  const categoryTotals: Record<string, number> = {};

  expenses.forEach((f) => {
    const cat = f.category || t("general.uncategorized");
    const acc = accountMap[f.account_id];
    const accCurrency = acc?.currency || appCurrency;
    const rateToApp =
      accCurrency === appCurrency
        ? 1.0
        : getPrice(`${accCurrency}${appCurrency}=X`, f.date) || 1.0;
    const convertedAmount = Math.abs(f.amount) * rateToApp;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + convertedAmount;
  });

  const sortedCategories = Object.entries(categoryTotals).sort(
    ([, a], [, b]) => b - a,
  );

  const colors =
    chartColors.piePalette.length > 0
      ? chartColors.piePalette
      : DEFAULT_EXPENSE_CHART_PALETTE;

  return {
    labels: sortedCategories.map(([cat]) => cat),
    datasets: [
      {
        data: sortedCategories.map(([, amount]) => amount),
        backgroundColor: sortedCategories.map(
          (_, i) => colors[i % colors.length]!,
        ),
        borderColor: isDark ? "#474240" : "#ffffff",
        borderWidth: 4,
        hoverOffset: 4,
      },
    ],
  };
}

interface BuildExpensesFromSeriesArgs {
  series: DashboardChartSeries | null;
  isDark: boolean;
  chartColors: ChartColors;
  t: TFunction;
}

export function buildExpensesByCategoryFromSeries({
  series,
  isDark,
  chartColors,
  t,
}: BuildExpensesFromSeriesArgs): ExpensesByCategoryChartData | null {
  if (!series || series.dates.length === 0) return null;
  if (series.categories.length === 0) {
    return { empty: true, labels: [], datasets: [] };
  }

  const colors =
    chartColors.piePalette.length > 0
      ? chartColors.piePalette
      : DEFAULT_EXPENSE_CHART_PALETTE;
  const categories = [...series.categories].sort(
    (left, right) => right.amount - left.amount,
  );

  return {
    labels: categories.map((category) =>
      category.category ? category.category : t("general.uncategorized"),
    ),
    datasets: [
      {
        data: categories.map((category) => category.amount),
        backgroundColor: categories.map(
          (_, index) => colors[index % colors.length]!,
        ),
        borderColor: isDark ? "#474240" : "#ffffff",
        borderWidth: 4,
        hoverOffset: 4,
      },
    ],
  };
}
