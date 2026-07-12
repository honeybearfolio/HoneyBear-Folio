import type { TFunction } from "i18next";
import type { Account } from "../../api/types";
import type { ChartColors } from "../../hooks/useChartColors";
import type { DashboardTimeRange } from "./dashboard-constants";
import type { GetPriceFn } from "./dashboard-prices";
import { computeIncomeExpenseBuckets } from "./dashboard-time-range";
import type { Transaction } from "./dashboard-types";

export interface IncomeVsExpensesChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
    borderRadius: number;
    barPercentage: number;
    categoryPercentage: number;
  }>;
}

interface BuildIncomeVsExpensesDataArgs {
  filteredTransactions: Transaction[];
  timeRange: DashboardTimeRange;
  customStartDate: Date;
  customEndDate: Date;
  formatDate: (date: string) => string;
  locale: string;
  accountMap: Record<string | number, Account>;
  appCurrency: string;
  getPrice: GetPriceFn;
  chartColors: ChartColors;
  t: TFunction;
}

export function buildIncomeVsExpensesData({
  filteredTransactions,
  timeRange,
  customStartDate,
  customEndDate,
  formatDate,
  locale,
  accountMap,
  appCurrency,
  getPrice,
  chartColors,
  t,
}: BuildIncomeVsExpensesDataArgs): IncomeVsExpensesChartData | null {
  if (filteredTransactions.length === 0) return null;

  const { keys, labels, isDayBucket } = computeIncomeExpenseBuckets(
    timeRange,
    customStartDate,
    customEndDate,
    filteredTransactions,
    formatDate,
    locale,
  );

  const incomeData: number[] = Array.from({ length: keys.length }, () => 0);
  const expenseData: number[] = Array.from({ length: keys.length }, () => 0);

  filteredTransactions.forEach((tx) => {
    if (tx.category === "Transfer" || tx.ticker) return;
    const key = isDayBucket ? tx.date : tx.date.slice(0, 7);
    const index = keys.indexOf(key);
    if (index !== -1) {
      const acc = accountMap[tx.account_id];
      const accCurrency = acc?.currency || appCurrency;
      const rateToApp =
        accCurrency === appCurrency
          ? 1.0
          : getPrice(`${accCurrency}${appCurrency}=X`, tx.date) || 1.0;
      const txAmount =
        typeof tx.amount === "number" ? tx.amount : Number(tx.amount) || 0;
      const amount = txAmount * rateToApp;

      if (amount > 0) {
        incomeData[index] = (incomeData[index] ?? 0) + amount;
      } else {
        expenseData[index] = (expenseData[index] ?? 0) + Math.abs(amount);
      }
    }
  });

  return {
    labels,
    datasets: [
      {
        label: t("dashboard.income"),
        data: incomeData,
        backgroundColor: chartColors.profit,
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
      {
        label: t("dashboard.expenses"),
        data: expenseData,
        backgroundColor: chartColors.loss,
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
    ],
  };
}
