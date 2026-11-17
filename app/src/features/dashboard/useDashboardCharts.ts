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
import { buildExpensesByCategoryFromSeries } from "./dashboard-expenses-chart";
import { buildIncomeVsExpensesFromSeries } from "./dashboard-income-expenses-chart";
import { buildNetWorthChartFromSeries } from "./dashboard-networth-chart";
import type { DashboardChartSeries } from "./dashboard-series";

interface UseDashboardChartsArgs {
  series: DashboardChartSeries | null;
  filteredAccounts: Account[];
  formatDate: (date: string) => string;
  formatNumber: ChartFormatNumber;
  locale: string;
  isDark: boolean;
  chartColors: ChartColors;
  currentNetWorth: number;
  totalAssetsValue: number;
  totalLiabilitiesValue: number;
  t: TFunction;
}

export function useDashboardCharts({
  series,
  filteredAccounts,
  formatDate,
  formatNumber,
  locale,
  isDark,
  chartColors,
  currentNetWorth,
  totalAssetsValue,
  totalLiabilitiesValue,
  t,
}: UseDashboardChartsArgs) {
  const chartData = useMemo(
    () =>
      buildNetWorthChartFromSeries({
        series,
        filteredAccounts,
        formatDate,
        chartColors,
        currentNetWorth,
        totalAssetsValue,
        totalLiabilitiesValue,
        t,
      }),
    [
      series,
      filteredAccounts,
      formatDate,
      chartColors,
      currentNetWorth,
      totalAssetsValue,
      totalLiabilitiesValue,
      t,
    ],
  );

  const expensesByCategoryData = useMemo(
    () =>
      buildExpensesByCategoryFromSeries({
        series,
        isDark,
        chartColors,
        t,
      }),
    [series, isDark, chartColors, t],
  );

  const incomeVsExpensesData = useMemo(
    () =>
      buildIncomeVsExpensesFromSeries({
        series,
        formatDate,
        locale,
        chartColors,
        t,
      }),
    [series, formatDate, locale, chartColors, t],
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
    () =>
      createLineChartOptions(
        formatNumber,
        chartColors,
        t("dashboard.datasets.assets_liabilities_net"),
      ),
    [formatNumber, chartColors, t],
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
