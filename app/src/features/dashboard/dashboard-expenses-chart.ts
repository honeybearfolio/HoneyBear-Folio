import type { TFunction } from "i18next";
import type { Account } from "../../api/types";
import type { ChartColors } from "../../hooks/useChartColors";
import { DEFAULT_EXPENSE_CHART_PALETTE } from "./dashboard-constants";
import type { GetPriceFn } from "./dashboard-prices";
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
  timeRange: string;
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
    chartColors.palette.length > 0
      ? chartColors.palette
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
