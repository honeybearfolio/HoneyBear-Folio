import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChartOptions } from "chart.js";
import { useTranslation } from "react-i18next";
import type { Account } from "../../api/types";
import type { ChartColors } from "../../hooks/useChartColors";
import type { ChartFormatNumber } from "../../utils/chartTooltip";
import { logError } from "../../utils/errors";
import { computeNetWorth } from "../../utils/networth";
import { buildDoughnutChartData } from "./dashboard-doughnut";
import { buildExpensesByCategoryData } from "./dashboard-expenses-chart";
import { buildIncomeVsExpensesData } from "./dashboard-income-expenses-chart";
import { buildNetWorthChartData } from "./dashboard-networth-chart";
import type { GetPriceFn } from "./dashboard-prices";
import type { DailyPriceData, Quote, Transaction } from "./dashboard-types";
import type { DoughnutChartData } from "./dashboard-doughnut";
import type { DashboardWidgetInstance } from "./dashboard-layout";
import {
  filterWidgetTransactions,
  resolveWidgetAccounts,
  resolveWidgetRange,
} from "./dashboard-widget-filters";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";

export interface DashboardSharedData {
  accounts: Account[];
  transactions: Transaction[];
  marketValues: Record<string, number>;
  totalAssetsValue: number;
  totalLiabilitiesValue: number;
  quotes: Quote[];
  dailyPrices: Record<string, DailyPriceData>;
  getPrice: GetPriceFn;
  accountMap: Record<string | number, Account>;
  formatDate: (date: string) => string;
  formatNumber: ChartFormatNumber;
  locale: string;
  appCurrency: string;
  isDark: boolean;
  chartColors: ChartColors;
  lineOptions: ChartOptions<"line">;
  barOptions: ChartOptions<"bar">;
  doughnutOptions: ChartOptions<"doughnut">;
  expensesOptions: ChartOptions<"doughnut">;
}

const DashboardDataContext = createContext<DashboardSharedData | null>(null);

export const DashboardDataProvider = DashboardDataContext.Provider;

export function useDashboardData(): DashboardSharedData {
  const value = useContext(DashboardDataContext);
  if (!value) {
    throw new Error("Dashboard data is unavailable");
  }
  return value;
}

export function useWidgetData(widget: DashboardWidgetInstance) {
  const { t } = useTranslation();
  const data = useDashboardData();
  const view = useDashboardPreferencesStore((state) => state.view);
  const range = resolveWidgetRange(widget, view);
  const selectedAccounts = useMemo(
    () =>
      resolveWidgetAccounts(
        data.accounts,
        view.hiddenAccountIds,
        widget.filters,
      ),
    [data.accounts, view.hiddenAccountIds, widget.filters],
  );
  const transactions = useMemo(
    () =>
      filterWidgetTransactions(
        data.transactions,
        data.accounts,
        selectedAccounts,
        widget.filters,
      ),
    [data.transactions, data.accounts, selectedAccounts, widget.filters],
  );
  const marketValues = useMemo(() => {
    const selected = new Set(
      selectedAccounts.map((account) => String(account.id)),
    );
    const values: Record<string, number> = {};
    for (const [id, value] of Object.entries(data.marketValues)) {
      if (selected.has(id) || selected.has(String(Number(id))))
        values[id] = value;
    }
    return values;
  }, [data.marketValues, selectedAccounts]);

  const followsAllAccounts = widget.filters.every(
    (filter) => filter.field !== "account",
  );
  const assets = followsAllAccounts ? data.totalAssetsValue : 0;
  const liabilities = followsAllAccounts ? data.totalLiabilitiesValue : 0;
  const needsNetWorth =
    widget.type === "summaryNetWorth" || widget.type === "netWorth";
  const [netWorth, setNetWorth] = useState(0);
  const [doughnutData, setDoughnutData] = useState<DoughnutChartData | null>(
    null,
  );

  useEffect(() => {
    if (!needsNetWorth) return;
    let cancelled = false;
    computeNetWorth(selectedAccounts, marketValues, assets, liabilities)
      .then((value) => {
        if (!cancelled) setNetWorth(value);
      })
      .catch((error: unknown) => {
        logError("Failed to compute net worth", error);
      });
    return () => {
      cancelled = true;
    };
  }, [needsNetWorth, selectedAccounts, marketValues, assets, liabilities]);

  useEffect(() => {
    if (widget.type !== "assetAllocation") return;
    let cancelled = false;
    buildDoughnutChartData({
      filteredAccounts: selectedAccounts,
      filteredTransactions: transactions,
      quotes: data.quotes,
      dailyPrices: data.dailyPrices,
      isDark: data.isDark,
      chartColors: data.chartColors,
      t,
    })
      .then((value) => {
        if (!cancelled) setDoughnutData(value);
      })
      .catch((error: unknown) => {
        logError("Failed to compute doughnut chart data", error);
      });
    return () => {
      cancelled = true;
    };
  }, [
    widget.type,
    selectedAccounts,
    transactions,
    data.quotes,
    data.dailyPrices,
    data.isDark,
    data.chartColors,
    t,
  ]);

  const netWorthChart = useMemo(
    () =>
      widget.type === "netWorth"
        ? buildNetWorthChartData({
            filteredAccounts: selectedAccounts,
            filteredTransactions: transactions,
            timeRange: range.timeRange,
            customStartDate: range.customStartDate,
            customEndDate: range.customEndDate,
            formatDate: data.formatDate,
            appCurrency: data.appCurrency,
            getPrice: data.getPrice,
            chartColors: data.chartColors,
            currentNetWorth: netWorth,
            totalAssetsValue: assets,
            totalLiabilitiesValue: liabilities,
            t,
          })
        : null,
    [
      widget.type,
      selectedAccounts,
      transactions,
      range.timeRange,
      range.customStartDate,
      range.customEndDate,
      data.formatDate,
      data.appCurrency,
      data.getPrice,
      data.chartColors,
      netWorth,
      assets,
      liabilities,
      t,
    ],
  );

  const incomeChart = useMemo(
    () =>
      widget.type === "incomeVsExpenses"
        ? buildIncomeVsExpensesData({
            filteredTransactions: transactions,
            timeRange: range.timeRange,
            customStartDate: range.customStartDate,
            customEndDate: range.customEndDate,
            formatDate: data.formatDate,
            locale: data.locale,
            accountMap: data.accountMap,
            appCurrency: data.appCurrency,
            getPrice: data.getPrice,
            chartColors: data.chartColors,
            t,
          })
        : null,
    [
      widget.type,
      transactions,
      range.timeRange,
      range.customStartDate,
      range.customEndDate,
      data.formatDate,
      data.locale,
      data.accountMap,
      data.appCurrency,
      data.getPrice,
      data.chartColors,
      t,
    ],
  );

  const expensesChart = useMemo(
    () =>
      widget.type === "expensesByCategory"
        ? buildExpensesByCategoryData({
            filteredTransactions: transactions,
            timeRange: range.timeRange,
            customStartDate: range.customStartDate,
            customEndDate: range.customEndDate,
            accountMap: data.accountMap,
            appCurrency: data.appCurrency,
            getPrice: data.getPrice,
            isDark: data.isDark,
            chartColors: data.chartColors,
            t,
          })
        : null,
    [
      widget.type,
      transactions,
      range.timeRange,
      range.customStartDate,
      range.customEndDate,
      data.accountMap,
      data.appCurrency,
      data.getPrice,
      data.isDark,
      data.chartColors,
      t,
    ],
  );

  return {
    selectedAccounts,
    transactions,
    range,
    netWorth,
    doughnutData,
    netWorthChart,
    incomeChart,
    expensesChart,
    hasTransactions: transactions.length > 0,
  };
}
