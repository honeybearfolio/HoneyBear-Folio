import type { TFunction } from "i18next";
import type { Account } from "../../api/types";
import type { ChartColors } from "../../hooks/useChartColors";
import {
  DEFAULT_LINE_CHART_PALETTE,
  type DashboardTimeRange,
} from "./dashboard-constants";
import type { GetPriceFn } from "./dashboard-prices";
import { computeNetWorthDateRange } from "./dashboard-time-range";
import type { Transaction } from "./dashboard-types";

export interface NetWorthChartDataset {
  label: string;
  data: number[];
  originalData?: number[];
  accountCurrency?: string;
  borderColor:
    | string
    | ((context: { chart: { ctx: CanvasRenderingContext2D } }) => string);
  backgroundColor:
    | string
    | ((context: {
        chart: { ctx: CanvasRenderingContext2D };
      }) => CanvasGradient | string);
  borderWidth: number;
  tension: number;
  fill: boolean;
  pointRadius: number;
  pointHoverRadius: number;
  pointHoverBackgroundColor?: string;
  pointHoverBorderColor?: string;
  pointHoverBorderWidth?: number;
  borderDash?: number[];
  hidden?: boolean;
  accountId?: string | number;
  _color?: string;
}

export interface NetWorthChartData {
  labels: string[];
  datasets: NetWorthChartDataset[];
}

interface BuildNetWorthChartDataArgs {
  filteredAccounts: Account[];
  filteredTransactions: Transaction[];
  timeRange: DashboardTimeRange;
  customStartDate: Date;
  customEndDate: Date;
  formatDate: (date: string) => string;
  appCurrency: string;
  getPrice: GetPriceFn;
  chartColors: ChartColors;
  currentNetWorth: number;
  t: TFunction;
}

export function buildNetWorthChartData({
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
}: BuildNetWorthChartDataArgs): NetWorthChartData | null {
  if (filteredAccounts.length === 0 || filteredTransactions.length === 0)
    return null;

  const accountInitialBalances: Record<string | number, number> = {};
  filteredAccounts.forEach((acc) => {
    const accTxs = filteredTransactions.filter(
      (tx) => tx.account_id === acc.id,
    );
    const totalChange = accTxs.reduce((sum, tx) => sum + tx.amount, 0);
    accountInitialBalances[acc.id] = acc.balance - totalChange;
  });

  const { sortedDates } = computeNetWorthDateRange(
    timeRange,
    customStartDate,
    customEndDate,
    filteredTransactions,
  );

  const tickerCurrencies: Record<string, string> = {};
  filteredTransactions.forEach((tx) => {
    if (tx.ticker && tx.currency) {
      tickerCurrencies[tx.ticker] = tx.currency;
    }
  });

  const datasets: NetWorthChartDataset[] = [];

  const colors =
    chartColors.palette.length > 0
      ? chartColors.palette
      : DEFAULT_LINE_CHART_PALETTE;

  const totalData = sortedDates.map((date) => {
    let total = 0;
    filteredAccounts.forEach((acc) => {
      const accCurrency = acc.currency || appCurrency;
      const initial = accountInitialBalances[acc.id];
      const accTxs = filteredTransactions.filter(
        (tx) => tx.account_id === acc.id && tx.date <= date,
      );
      const cashChange = accTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const cashBalance = (initial ?? 0) + cashChange;

      const holdings: Record<string, number> = {};
      accTxs.forEach((tx) => {
        if (tx.ticker && tx.shares) {
          holdings[tx.ticker] = (holdings[tx.ticker] || 0) + tx.shares;
        }
      });

      let stockValue = 0;
      for (const [ticker, shares] of Object.entries(holdings)) {
        if (Math.abs(shares) > 0.0001) {
          const price = getPrice(ticker, date);
          const tickerCurr = tickerCurrencies[ticker] || accCurrency;
          const rateToAcc =
            tickerCurr === accCurrency
              ? 1.0
              : getPrice(`${tickerCurr}${accCurrency}=X`, date) || 1.0;
          stockValue += shares * price * rateToAcc;
        }
      }

      const rateToApp =
        accCurrency === appCurrency
          ? 1.0
          : getPrice(`${accCurrency}${appCurrency}=X`, date) || 1.0;
      total += (cashBalance + stockValue) * rateToApp;
    });
    return total;
  });

  if (totalData.length > 0) {
    totalData[totalData.length - 1] = currentNetWorth;
  }

  datasets.push({
    label: t("dashboard.datasets.total_net_worth"),
    data: totalData,
    borderColor: chartColors.line,
    backgroundColor: (context: {
      chart: { ctx: CanvasRenderingContext2D };
    }) => {
      const ctx = context.chart.ctx;
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, chartColors.line + "33");
      gradient.addColorStop(1, chartColors.line + "00");
      return gradient;
    },
    borderWidth: 3,
    tension: 0.4,
    fill: true,
    pointRadius: 0,
    pointHoverRadius: 6,
    pointHoverBackgroundColor: chartColors.line,
    pointHoverBorderColor: "#fff",
    pointHoverBorderWidth: 2,
  });

  filteredAccounts.forEach((acc, index) => {
    const accCurrency = acc.currency || appCurrency;

    const accDataNative: number[] = [];
    const accDataConverted: number[] = [];

    sortedDates.forEach((date) => {
      const initial = accountInitialBalances[acc.id];
      const accTxs = filteredTransactions.filter(
        (tx) => tx.account_id === acc.id && tx.date <= date,
      );
      const cashChange = accTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const cashBalance = (initial ?? 0) + cashChange;

      const holdings: Record<string, number> = {};
      accTxs.forEach((tx) => {
        if (tx.ticker && tx.shares) {
          holdings[tx.ticker] = (holdings[tx.ticker] || 0) + tx.shares;
        }
      });

      let stockValue = 0;
      for (const [ticker, shares] of Object.entries(holdings)) {
        if (Math.abs(shares) > 0.0001) {
          const price = getPrice(ticker, date);
          const tickerCurr = tickerCurrencies[ticker] || accCurrency;
          const rateToAcc =
            tickerCurr === accCurrency
              ? 1.0
              : getPrice(`${tickerCurr}${accCurrency}=X`, date) || 1.0;
          stockValue += shares * price * rateToAcc;
        }
      }

      const nativeVal = cashBalance + stockValue;
      const rateToApp =
        accCurrency === appCurrency
          ? 1.0
          : getPrice(`${accCurrency}${appCurrency}=X`, date) || 1.0;
      const convertedVal = nativeVal * rateToApp;

      accDataNative.push(nativeVal);
      accDataConverted.push(convertedVal);
    });

    const color = colors[index % colors.length]!;

    datasets.push({
      label: acc.name,
      data: accDataConverted,
      originalData: accDataNative,
      accountCurrency: accCurrency,
      borderColor: color,
      backgroundColor: "transparent",
      borderWidth: 2,
      tension: 0.4,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderDash: [5, 5],
      hidden: false,
      accountId: acc.id,
      _color: color,
    });
  });

  return {
    labels: sortedDates.map((d) => formatDate(d)),
    datasets,
  };
}
