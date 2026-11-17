import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChartOptions } from "chart.js";
import { useTranslation } from "react-i18next";
import type { Account } from "../../api/types";
import type { ChartColors } from "../../hooks/useChartColors";
import type { ChartFormatNumber } from "../../utils/chartTooltip";
import { logError } from "../../utils/errors";
import { computeNetWorth } from "../../utils/networth";
import { rust } from "../../api/tauri-client";
import { buildDoughnutChartData } from "./dashboard-doughnut";
import {
  buildExpensesByCategoryData,
  buildExpensesByCategoryFromSeries,
} from "./dashboard-expenses-chart";
import {
  buildIncomeVsExpensesData,
  buildIncomeVsExpensesFromSeries,
} from "./dashboard-income-expenses-chart";
import {
  buildNetWorthChartData,
  buildNetWorthChartFromSeries,
} from "./dashboard-networth-chart";
import type { GetPriceFn } from "./dashboard-prices";
import type { DailyPriceData, Quote, Transaction } from "./dashboard-types";
import type { DoughnutChartData } from "./dashboard-doughnut";
import type { DashboardWidgetInstance } from "./dashboard-layout";
import {
  accountIdsOf,
  dashboardChartQueryKey,
  normalizeDashboardChartSeries,
  type DashboardChartQuery,
  type DashboardChartSeries,
} from "./dashboard-series";
import { dashboardChartQuery } from "./dashboard-time-range";
import {
  filterWidgetTransactions,
  resolveWidgetAccounts,
  resolveWidgetRange,
  widgetDetailFilters,
} from "./dashboard-widget-filters";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";

export interface DashboardSharedData {
  accounts: Account[];
  transactions: Transaction[];
  chartSeries: DashboardChartSeries | null;
  chartQuery: DashboardChartQuery | null;
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

const inflightRows = new Map<string, Promise<Transaction[]>>();

function loadWidgetRows(
  accountIds: number[],
  filters: ReadonlyArray<{ field: string; operator: string; value: string }>,
): Promise<Transaction[]> {
  const key = `${accountIds.join(",")}|${filters
    .map((filter) => `${filter.field}:${filter.operator}:${filter.value}`)
    .join("|")}`;
  const existing = inflightRows.get(key);
  if (existing) return existing;
  const pending = rust
    .query_dashboard_transactions({ accountIds, filters: [...filters] })
    .then((result) => (Array.isArray(result) ? result : []))
    .finally(() => {
      if (inflightRows.get(key) === pending) inflightRows.delete(key);
    });
  inflightRows.set(key, pending);
  return pending;
}

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
  const detailFilters = useMemo(
    () => widgetDetailFilters(widget.filters),
    [widget.filters],
  );
  const needsRows =
    detailFilters.length > 0 ||
    widget.type === "cashFlow" ||
    widget.type === "assetAllocation" ||
    widget.type === "summaryTransactions";
  const usesAggregate =
    detailFilters.length === 0 &&
    (widget.type === "netWorth" ||
      widget.type === "incomeVsExpenses" ||
      widget.type === "expensesByCategory");
  const accountKey = selectedAccounts
    .map((account) => String(account.id))
    .join(",");
  const rangeKey = `${range.timeRange}|${range.customStartDate.toDateString()}|${range.customEndDate.toDateString()}`;
  const widgetQuery = useMemo(
    () =>
      dashboardChartQuery(
        range.timeRange,
        range.customStartDate,
        range.customEndDate,
        accountIdsOf(selectedAccounts),
        data.appCurrency,
      ),
    // Dates from resolveWidgetRange are new objects every render. rangeKey is the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.timeRange, rangeKey, accountKey, data.appCurrency],
  );
  const widgetKey = dashboardChartQueryKey(widgetQuery);
  const sharedKey = data.chartQuery
    ? dashboardChartQueryKey(data.chartQuery)
    : "";
  const [localSeries, setLocalSeries] = useState<DashboardChartSeries | null>(
    null,
  );
  const [rowState, setRowState] = useState<{
    key: string;
    rows: Transaction[];
  }>({ key: "", rows: [] });
  const filterKey = detailFilters
    .map((filter) => `${filter.field}:${filter.operator}:${filter.value}`)
    .join("|");
  const rowKey = `${widgetQuery.accountIds.join(",")}|${filterKey}`;
  const rows = useMemo(
    () => (needsRows && rowState.key === rowKey ? rowState.rows : []),
    [needsRows, rowState, rowKey],
  );

  useEffect(() => {
    if (!needsRows || widgetQuery.accountIds.length === 0) return;
    const request = { cancelled: false };
    const key = rowKey;
    loadWidgetRows(
      widgetQuery.accountIds,
      detailFilters.map((filter) => ({
        field: filter.field,
        operator: filter.operator,
        value: filter.value,
      })),
    )
      .then((result) => {
        if (!request.cancelled) setRowState({ key, rows: result });
      })
      .catch((error: unknown) => {
        logError("Failed to query dashboard transactions", error);
        if (!request.cancelled) setRowState({ key, rows: [] });
      });
    return () => {
      request.cancelled = true;
    };
    // rowKey already covers the account ids and filters. widgetQuery is a fresh object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsRows, rowKey]);

  useEffect(() => {
    if (!usesAggregate || widgetKey === sharedKey) return;
    let cancelled = false;
    rust
      .get_dashboard_chart_series({ query: widgetQuery })
      .then((result) => {
        if (!cancelled) setLocalSeries(normalizeDashboardChartSeries(result));
      })
      .catch((error: unknown) => {
        logError("Failed to load dashboard chart series", error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usesAggregate, widgetKey, sharedKey]);

  const series = !usesAggregate
    ? null
    : widgetKey === sharedKey
      ? data.chartSeries
      : localSeries;
  const transactions = useMemo(
    () =>
      needsRows
        ? filterWidgetTransactions(
            rows,
            data.accounts,
            selectedAccounts,
            widget.filters,
          )
        : [],
    [needsRows, rows, data.accounts, selectedAccounts, widget.filters],
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

  const netWorthChart = useMemo(() => {
    if (widget.type !== "netWorth") return null;
    if (detailFilters.length > 0) {
      return buildNetWorthChartData({
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
      });
    }
    return buildNetWorthChartFromSeries({
      series,
      filteredAccounts: selectedAccounts,
      formatDate: data.formatDate,
      chartColors: data.chartColors,
      currentNetWorth: netWorth,
      totalAssetsValue: assets,
      totalLiabilitiesValue: liabilities,
      t,
    });
  }, [
    widget.type,
    detailFilters.length,
    selectedAccounts,
    transactions,
    series,
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
  ]);

  const incomeChart = useMemo(() => {
    if (widget.type !== "incomeVsExpenses") return null;
    if (detailFilters.length > 0) {
      return buildIncomeVsExpensesData({
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
      });
    }
    return buildIncomeVsExpensesFromSeries({
      series,
      formatDate: data.formatDate,
      locale: data.locale,
      chartColors: data.chartColors,
      t,
    });
  }, [
    widget.type,
    detailFilters.length,
    transactions,
    series,
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
  ]);

  const expensesChart = useMemo(() => {
    if (widget.type !== "expensesByCategory") return null;
    if (detailFilters.length > 0) {
      return buildExpensesByCategoryData({
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
      });
    }
    return buildExpensesByCategoryFromSeries({
      series,
      isDark: data.isDark,
      chartColors: data.chartColors,
      t,
    });
  }, [
    widget.type,
    detailFilters.length,
    transactions,
    series,
    range.timeRange,
    range.customStartDate,
    range.customEndDate,
    data.accountMap,
    data.appCurrency,
    data.getPrice,
    data.isDark,
    data.chartColors,
    t,
  ]);

  const hasSeries = (series?.dates.length ?? 0) > 0;
  return {
    selectedAccounts,
    transactions,
    range,
    netWorth,
    doughnutData,
    netWorthChart,
    incomeChart,
    expensesChart,
    hasTransactions: needsRows ? transactions.length > 0 : hasSeries,
  };
}
