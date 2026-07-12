import { useMemo } from "react";
import type { TFunction } from "i18next";
import type { ChartOptions } from "chart.js";
import type { Account } from "../../api/types";
import type { ChartColors } from "../../hooks/useChartColors";
import type { ChartFormatNumber } from "../../utils/chartTooltip";
import {
  createBarChartOptions,
  createDoughnutChartOptions,
  createExpensesDoughnutChartOptions,
  createLineChartOptions,
} from "./dashboard-chart-config";
import { buildExpensesByCategoryData } from "./dashboard-expenses-chart";
import { buildIncomeVsExpensesData } from "./dashboard-income-expenses-chart";
import { buildNetWorthChartData } from "./dashboard-networth-chart";
import type { DashboardTimeRange } from "./dashboard-constants";
import type { GetPriceFn } from "./dashboard-prices";
import type { Transaction } from "./dashboard-types";

interface UseDashboardChartsArgs {
  filteredAccounts: Account[];
  filteredTransactions: Transaction[];
  accountMap: Record<string | number, Account>;
  timeRange: DashboardTimeRange;
  customStartDate: Date;
  customEndDate: Date;
  formatDate: (date: string) => string;
  formatNumber: ChartFormatNumber;
  locale: string;
  appCurrency: string;
  getPrice: GetPriceFn;
  isDark: boolean;
  chartColors: ChartColors;
  currentNetWorth: number;
  t: TFunction;
}

export function useDashboardCharts({
  filteredAccounts,
  filteredTransactions,
  accountMap,
  timeRange,
  customStartDate,
  customEndDate,
  formatDate,
  formatNumber,
  locale,
  appCurrency,
  getPrice,
  isDark,
  chartColors,
  currentNetWorth,
  t,
}: UseDashboardChartsArgs) {
  const chartData = useMemo(
    () =>
      buildNetWorthChartData({
        filteredAccounts,
        filteredTransactions,
        timeRange,
        customStartDate,
        customEndDate,
        formatDate,
        appCurrency,
        getPrice,
        chartColors,
        currentNetWorth,
        t,
      }),
    [
      filteredAccounts,
      filteredTransactions,
      timeRange,
      customStartDate,
      customEndDate,
      formatDate,
      appCurrency,
      getPrice,
      chartColors,
      currentNetWorth,
      t,
    ],
  );

  const expensesByCategoryData = useMemo(
    () =>
      buildExpensesByCategoryData({
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
      }),
    [
      filteredTransactions,
      timeRange,
      customStartDate,
      customEndDate,
      isDark,
      accountMap,
      getPrice,
      appCurrency,
      chartColors,
      t,
    ],
  );

  const incomeVsExpensesData = useMemo(
    () =>
      buildIncomeVsExpensesData({
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
      }),
    [
      filteredTransactions,
      timeRange,
      customStartDate,
      customEndDate,
      formatDate,
      locale,
      accountMap,
      getPrice,
      appCurrency,
      chartColors,
      t,
    ],
  );

  const doughnutOptions = useMemo<ChartOptions<"doughnut">>(
    () => createDoughnutChartOptions(isDark, formatNumber, chartColors),
    [isDark, formatNumber, chartColors],
  );

  const expensesOptions = useMemo<ChartOptions<"doughnut">>(
    () => createExpensesDoughnutChartOptions(isDark, formatNumber, chartColors),
    [isDark, formatNumber, chartColors],
  );

  const barOptions = useMemo<ChartOptions<"bar">>(
    () => createBarChartOptions(formatNumber, chartColors),
    [formatNumber, chartColors],
  );

  const lineOptions = useMemo<ChartOptions<"line">>(
    () => createLineChartOptions(formatNumber, chartColors),
    [formatNumber, chartColors],
  );

  return {
    chartData,
    expensesByCategoryData,
    incomeVsExpensesData,
    doughnutOptions,
    expensesOptions,
    barOptions,
    lineOptions,
  };
}
