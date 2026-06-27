import { useState, useEffect, useMemo, useCallback } from "react";
import { rust } from "../../api/tauri-client";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  BarElement,
} from "chart.js";
import type { ChartOptions, ChartData, TooltipItem } from "chart.js";
import "../../styles/Dashboard.css";
import { computeNetWorth } from "../../utils/networth";
import { useFormatNumber, useFormatDate } from "../../utils/format";
import { buildHoldingsFromTransactions } from "../../utils/investments";
import {
  buildDoughnutChartData,
  type DoughnutChartData,
} from "./dashboard-doughnut";
import { useNumberFormat } from "../../stores/number-format";
import { DashboardSkeleton, ErrorState } from "../../components/ui/Skeleton";
import { useTranslation } from "react-i18next";
import { handleAsyncError, logError } from "../../utils/errors";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  BarElement,
);

import useIsDark from "../../hooks/useIsDark";
import useChartColors from "../../hooks/useChartColors";
import SankeyDiagram from "./SankeyDiagram";
import TimeRangeSelector from "./TimeRangeSelector";
import AccountFilterPopover from "./AccountFilterPopover";
import SummaryCards from "./SummaryCards";
import NetWorthChart from "./NetWorthChart";
import AssetAllocationChart from "./AssetAllocationChart";
import ExpensesByCategoryChart from "./ExpensesByCategoryChart";
import IncomeVsExpensesChart from "./IncomeVsExpensesChart";
import type {
  Transaction,
  Quote,
  DailyPriceEntry,
  DailyPriceData,
  DashboardProps,
  AccountChartDataset,
} from "./dashboard-types";
import type { Account } from "../../api/types";

export default function Dashboard({
  accounts: propAccounts = [],
  marketValues = {},
  totalAssetsValue = 0,
}: DashboardProps) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>(propAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyPrices, setDailyPrices] = useState<
    Record<string, DailyPriceData>
  >({});
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [timeRange, setTimeRange] = useState("1Y"); // 1M, 3M, 6M, YTD, 1Y, ALL, CUSTOM
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
  );
  const [customEndDate, setCustomEndDate] = useState(new Date());

  const isDark = useIsDark();
  const chartColors = useChartColors();

  const formatNumber = useFormatNumber();
  const formatDate = useFormatDate();
  const {
    dateFormat,
    firstDayOfWeek,
    currency: appCurrency,
    locale,
  } = useNumberFormat();

  const accountMap = useMemo(() => {
    const map: Record<string | number, Account> = {};
    accounts.forEach((acc) => {
      map[acc.id] = acc;
    });
    return map;
  }, [accounts]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const txs = (await rust.get_all_transactions()) as Transaction[];
        setTransactions(txs);

        // If parent passed accounts, use them; otherwise fetch from backend
        if (propAccounts && propAccounts.length > 0) {
          setAccounts(propAccounts);
        } else {
          const accs = await rust.get_accounts();
          setAccounts(accs);
        }
      } catch (e) {
        handleAsyncError({
          context: "Failed to fetch dashboard data",
          error: e,
          setError,
          detailFallback: t("error.failed_to_load"),
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [propAccounts, t]);

  useEffect(() => {
    const fetchQuotes = async () => {
      if (transactions.length === 0) return;
      const { currentHoldings } =
        await buildHoldingsFromTransactions(transactions);
      if (currentHoldings.length === 0) {
        setQuotes([]);
        return;
      }
      const tickers = currentHoldings.map((h) => h.ticker);
      const uniqueTickers = [...new Set(tickers)];
      try {
        const qs = (await rust.get_stock_quotes({
          tickers: uniqueTickers,
        })) as Quote[];
        setQuotes(qs);
      } catch (e) {
        logError("Failed to fetch quotes", e);
      }
    };
    fetchQuotes();
  }, [transactions]);

  useEffect(() => {
    const fetchDailyPrices = async () => {
      const tickers = new Set<string>();

      // Include all tickers from transactions
      transactions.forEach((t) => {
        if (t.ticker) tickers.add(t.ticker);
      });

      // Also include currency pairs for multi-currency support
      const accountMap: Record<string | number, Account> = {};
      accounts.forEach((a) => (accountMap[a.id] = a));

      transactions.forEach((t) => {
        const acc = accountMap[t.account_id];
        const accCurrency = acc?.currency || appCurrency;
        const txCurrency = t.currency || accCurrency;

        if (txCurrency !== accCurrency) {
          tickers.add(`${txCurrency}${accCurrency}=X`);
        }
      });

      accounts.forEach((acc) => {
        const accCurrency = acc.currency || appCurrency;
        if (accCurrency !== appCurrency) {
          tickers.add(`${accCurrency}${appCurrency}=X`);
        }
      });

      if (tickers.size === 0) return;

      try {
        // Trigger update first
        await rust.update_daily_stock_prices({
          tickers: Array.from(tickers),
        });

        // Then fetch
        const pricesMap: Record<string, DailyPriceData> = {};
        for (const ticker of tickers) {
          const prices = (await rust.get_daily_stock_prices({
            ticker,
          })) as DailyPriceEntry[];
          // Sort prices by date ascending to ensure getPrice binary search/linear scan works
          prices.sort((a: DailyPriceEntry, b: DailyPriceEntry) =>
            a.date > b.date ? 1 : -1,
          );

          // Convert to map for faster lookup: date -> price
          const priceByDate: Record<string, number> = {};
          prices.forEach((p: DailyPriceEntry) => {
            priceByDate[p.date] = p.price;
          });
          pricesMap[ticker] = { list: prices, map: priceByDate };
        }
        setDailyPrices(pricesMap);
      } catch (e) {
        logError("Failed to fetch daily prices", e);
      }
    };

    if (transactions.length > 0) {
      fetchDailyPrices();
    }
  }, [transactions, accounts, propAccounts, appCurrency]);

  // Helper to get price
  const getPrice = useCallback(
    (ticker: string, date: string) => {
      if (!dailyPrices[ticker]) return 0;
      const { list, map } = dailyPrices[ticker];
      if (map[date]) return map[date];
      // Find last available price
      let lastPrice = 0;
      for (const p of list) {
        if (p.date > date) break;
        lastPrice = p.price;
      }
      return lastPrice;
    },
    [dailyPrices],
  );

  // Track user toggles for account visibility (dashboard-wide filter).
  // Default: all accounts selected so the full picture is shown on load.
  const [toggledAccounts, setToggledAccounts] = useState<
    Record<string | number, boolean>
  >(() => {
    const map: Record<string | number, boolean> = {};
    propAccounts.forEach((a) => (map[a.id] = true));
    return map;
  });

  // Auto-select newly added accounts
  // Defer the state update so we don't call setState synchronously inside the effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setToggledAccounts((prev) => {
        const next = { ...prev };
        let changed = false;
        accounts.forEach((a) => {
          if (!(a.id in next)) {
            next[a.id] = true;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [accounts]);

  const selectedAccountIds = useMemo(() => {
    const set = new Set();
    accounts.forEach((a) => {
      if (toggledAccounts[a.id]) set.add(a.id);
    });
    return set;
  }, [accounts, toggledAccounts]);

  const toggleAccountVisibility = (accountId: string | number) => {
    setToggledAccounts((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const setAllAccountsVisibility = (visible: boolean) => {
    const map: Record<string | number, boolean> = {};
    accounts.forEach((a) => (map[a.id] = visible));
    setToggledAccounts(map);
  };

  // Filtered data based on the dashboard-wide account selection.
  // Data fetching (FX pairs, daily prices) stays unfiltered.
  const filteredAccounts = useMemo(
    () => accounts.filter((a) => selectedAccountIds.has(a.id)),
    [accounts, selectedAccountIds],
  );

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => selectedAccountIds.has(t.account_id)),
    [transactions, selectedAccountIds],
  );

  const filteredMarketValues = useMemo(() => {
    const mv: Record<string, number> = {};
    for (const [id, val] of Object.entries(marketValues)) {
      if (selectedAccountIds.has(Number(id))) mv[id] = val;
    }
    return mv;
  }, [marketValues, selectedAccountIds]);

  const [currentNetWorth, setCurrentNetWorth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    computeNetWorth(filteredAccounts, filteredMarketValues, totalAssetsValue)
      .then((value) => {
        if (!cancelled) setCurrentNetWorth(value);
      })
      .catch((e) => {
        logError("Failed to compute net worth", e);
      });
    return () => {
      cancelled = true;
    };
  }, [filteredAccounts, filteredMarketValues, totalAssetsValue]);

  const chartData = useMemo(() => {
    // Require accounts and at least one transaction to render the net worth evolution chart
    if (filteredAccounts.length === 0 || filteredTransactions.length === 0)
      return null;

    // 1. Calculate initial balances for each account
    // current_balance = initial_balance + sum(transactions)
    // initial_balance = current_balance - sum(transactions)
    const accountInitialBalances: Record<string | number, number> = {};
    filteredAccounts.forEach((acc) => {
      const accTxs = filteredTransactions.filter(
        (t) => t.account_id === acc.id,
      );
      const totalChange = accTxs.reduce((sum, t) => sum + t.amount, 0);
      accountInitialBalances[acc.id] = acc.balance - totalChange;
    });

    // 2. Collect all relevant dates
    const now = new Date();
    let cutoffDate = new Date();
    let endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    if (timeRange === "1M") cutoffDate.setMonth(now.getMonth() - 1);
    else if (timeRange === "3M") cutoffDate.setMonth(now.getMonth() - 3);
    else if (timeRange === "6M") cutoffDate.setMonth(now.getMonth() - 6);
    else if (timeRange === "YTD")
      cutoffDate = new Date(now.getFullYear(), 0, 1);
    else if (timeRange === "1Y") cutoffDate.setFullYear(now.getFullYear() - 1);
    else if (timeRange === "CUSTOM") {
      cutoffDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else cutoffDate = new Date(0); // ALL

    cutoffDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // If ALL, find the first transaction date
    if (timeRange === "ALL" && filteredTransactions.length > 0) {
      const firstTxDate = new Date(
        filteredTransactions.reduce(
          (min, t) => (t.date < min ? t.date : min),
          filteredTransactions[0]!.date,
        ),
      );
      cutoffDate = firstTxDate;
      cutoffDate.setHours(0, 0, 0, 0);
    } else if (timeRange === "ALL") {
      cutoffDate.setFullYear(now.getFullYear() - 1); // Default to 1Y if no txs
      cutoffDate.setHours(0, 0, 0, 0);
    }

    // Ensure we never show dates earlier than the first transaction — start chart at firstTxDate
    if (filteredTransactions.length > 0) {
      const firstTxDate = new Date(
        filteredTransactions.reduce(
          (min, t) => (t.date < min ? t.date : min),
          filteredTransactions[0]!.date,
        ),
      );
      // Normalize to midnight for consistent comparisons
      firstTxDate.setHours(0, 0, 0, 0);
      if (firstTxDate > cutoffDate && timeRange !== "CUSTOM")
        cutoffDate = new Date(firstTxDate);
    }

    const sortedDates: string[] = [];
    const d = new Date(cutoffDate);
    d.setHours(0, 0, 0, 0);

    while (d <= endDate) {
      // Use local date components to avoid UTC conversion issues that can
      // shift the date to the previous day for users in negative timezones.
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(d.getDate()).padStart(2, "0")}`;
      sortedDates.push(localDate);
      d.setDate(d.getDate() + 1);
    }

    // Index ticker currencies from transactions
    const tickerCurrencies: Record<string, string> = {};
    filteredTransactions.forEach((t) => {
      if (t.ticker && t.currency) {
        tickerCurrencies[t.ticker] = t.currency;
      }
    });

    // 3. Calculate balances for each date
    // We need a map of date -> balance for each account and total.

    const datasets = [];

    // Helper to get color
    const colors =
      chartColors.palette.length > 0
        ? chartColors.palette
        : [
            "rgb(59, 130, 246)",
            "rgb(16, 185, 129)",
            "rgb(245, 158, 11)",
            "rgb(239, 68, 68)",
            "rgb(139, 92, 246)",
            "rgb(236, 72, 153)",
            "rgb(14, 165, 233)",
            "rgb(249, 115, 22)",
          ];

    // Total Net Worth Dataset
    const totalData = sortedDates.map((date) => {
      let total = 0;
      filteredAccounts.forEach((acc) => {
        const accCurrency = acc.currency || appCurrency;
        const initial = accountInitialBalances[acc.id];
        const accTxs = filteredTransactions.filter(
          (t) => t.account_id === acc.id && t.date <= date,
        );
        // Include all transactions (even stock buys/sells) to get correct cash balance
        const cashChange = accTxs.reduce((sum, t) => sum + t.amount, 0);
        const cashBalance = (initial ?? 0) + cashChange;

        const holdings: Record<string, number> = {};
        accTxs.forEach((t) => {
          if (t.ticker && t.shares) {
            holdings[t.ticker] = (holdings[t.ticker] || 0) + t.shares;
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

    // Ensure current (last) data point uses current market values (same as Sidebar/Investments)
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
        gradient.addColorStop(0, chartColors.line + "33"); // 20% opacity
        gradient.addColorStop(1, chartColors.line + "00"); // 0% opacity
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

    // Individual Account Datasets
    filteredAccounts.forEach((acc, index) => {
      const accCurrency = acc.currency || appCurrency;

      // Build both the native (account currency) and converted (app currency) series
      const accDataNative: number[] = [];
      const accDataConverted: number[] = [];

      sortedDates.forEach((date) => {
        const initial = accountInitialBalances[acc.id];
        const accTxs = filteredTransactions.filter(
          (t) => t.account_id === acc.id && t.date <= date,
        );
        // Include all transactions (even stock buys/sells) to get correct cash balance
        const cashChange = accTxs.reduce((sum, t) => sum + t.amount, 0);
        const cashBalance = (initial ?? 0) + cashChange;

        const holdings: Record<string, number> = {};
        accTxs.forEach((t) => {
          if (t.ticker && t.shares) {
            holdings[t.ticker] = (holdings[t.ticker] || 0) + t.shares;
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

      const color = colors[index % colors.length];

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
        borderDash: [5, 5], // Dashed lines for individual accounts to reduce noise
        hidden: false, // Visibility controlled by the dashboard-wide account filter
        accountId: acc.id,
        _color: color, // helper for legend rendering
      });
    });

    return {
      labels: sortedDates.map((d) => formatDate(d)),
      datasets: datasets,
    };
  }, [
    filteredAccounts,
    filteredTransactions,
    timeRange,
    customStartDate,
    customEndDate,
    formatDate,
    appCurrency,
    getPrice,
    chartColors,
    t,
    currentNetWorth,
  ]);

  const [doughnutData, setDoughnutData] = useState<DoughnutChartData | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function computeDoughnutData() {
      if (filteredAccounts.length === 0) {
        if (!cancelled) setDoughnutData(null);
        return;
      }

      const data = await buildDoughnutChartData({
        filteredAccounts,
        filteredTransactions,
        quotes,
        dailyPrices,
        isDark,
        chartColors,
        t,
      });
      if (!cancelled) setDoughnutData(data);
    }

    computeDoughnutData().catch((e) => {
      logError("Failed to compute doughnut chart data", e);
    });

    return () => {
      cancelled = true;
    };
  }, [
    filteredAccounts,
    filteredTransactions,
    quotes,
    dailyPrices,
    isDark,
    chartColors,
    t,
  ]);

  const expensesByCategoryData = useMemo(() => {
    if (filteredTransactions.length === 0) return null;

    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date();

    if (timeRange === "1M") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === "3M") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
    } else if (timeRange === "6M") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 6);
    } else if (timeRange === "YTD") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (timeRange === "1Y") {
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
    } else if (timeRange === "CUSTOM") {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const startStr = startDate.toISOString().split("T")[0] ?? "";
    const endStr = endDate.toISOString().split("T")[0] ?? "";

    const expenses = filteredTransactions.filter(
      (t) =>
        t.amount < 0 &&
        t.category !== "Transfer" &&
        !t.ticker && // Exclude investment transactions
        t.date >= startStr &&
        t.date <= endStr,
    );

    // No expense transactions — return an explicit empty marker so the UI
    // can show a friendly message instead of a blank chart
    if (expenses.length === 0) return { empty: true };

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
        : [
            "rgb(244, 63, 94)",
            "rgb(249, 115, 22)",
            "rgb(245, 158, 11)",
            "rgb(16, 185, 129)",
            "rgb(6, 182, 212)",
            "rgb(59, 130, 246)",
            "rgb(139, 92, 246)",
            "rgb(236, 72, 153)",
          ];

    return {
      labels: sortedCategories.map(([cat]) => cat),
      datasets: [
        {
          data: sortedCategories.map(([, amount]) => amount),
          backgroundColor: sortedCategories.map(
            (_, i) => colors[i % colors.length],
          ),
          borderColor: isDark ? "#474240" : "#ffffff",
          borderWidth: 4,
          hoverOffset: 4,
        },
      ],
    };
  }, [
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
  ]);

  const incomeVsExpensesData = useMemo(() => {
    if (filteredTransactions.length === 0) return null;

    const now = new Date();
    const keys: string[] = []; // keys for matching (YYYY-MM-DD for days or YYYY-MM for months)
    const labels = [];

    const isDayBucket =
      timeRange === "1M" ||
      (timeRange === "CUSTOM" &&
        (customEndDate.getTime() - customStartDate.getTime()) /
          (1000 * 60 * 60 * 24) <=
          31);

    if (isDayBucket) {
      // Last 30 days or custom range <= 31 days
      const end =
        timeRange === "CUSTOM" ? new Date(customEndDate) : new Date(now);
      const start =
        timeRange === "CUSTOM" ? new Date(customStartDate) : new Date(now);
      if (timeRange === "1M") start.setDate(now.getDate() - 29);

      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      const d = new Date(start);
      while (d <= end) {
        const key = d.toISOString().slice(0, 10);
        keys.push(key);
        labels.push(formatDate(key));
        d.setDate(d.getDate() + 1);
      }
    } else {
      // Use months for 3M, 6M, 1Y, ALL and CUSTOM > 31 days
      let end = new Date(now);
      let start = new Date(now);

      if (timeRange === "3M") start.setMonth(now.getMonth() - 2);
      else if (timeRange === "6M") start.setMonth(now.getMonth() - 5);
      else if (timeRange === "YTD") start = new Date(now.getFullYear(), 0, 1);
      else if (timeRange === "1Y") start.setFullYear(now.getFullYear() - 1);
      else if (timeRange === "ALL") {
        const txDates = filteredTransactions.map((t) => t.date).sort();
        const firstDate = txDates[0];
        if (firstDate) start = new Date(firstDate);
      } else if (timeRange === "CUSTOM") {
        start = new Date(customStartDate);
        end = new Date(customEndDate);
      }

      start.setDate(1); // Start of month
      const d = new Date(start);
      while (d <= end) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0",
        )}`;
        keys.push(key);
        const opts: Intl.DateTimeFormatOptions = { month: "short" };
        // If the range spans more than a year, show the year
        const monthsDiff =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth());
        if (monthsDiff >= 12) opts.year = "numeric";
        // Use the current locale from NumberFormatContext for the month display
        labels.push(d.toLocaleDateString(locale, opts));
        d.setMonth(d.getMonth() + 1);
      }
    }

    const incomeData = new Array(keys.length).fill(0);
    const expenseData = new Array(keys.length).fill(0);

    filteredTransactions.forEach((t) => {
      if (t.category === "Transfer" || t.ticker) return; // Exclude transfers and investments
      const key = isDayBucket ? t.date : t.date.slice(0, 7);
      const index = keys.indexOf(key);
      if (index !== -1) {
        const acc = accountMap[t.account_id];
        const accCurrency = acc?.currency || appCurrency;
        const rateToApp =
          accCurrency === appCurrency
            ? 1.0
            : getPrice(`${accCurrency}${appCurrency}=X`, t.date) || 1.0;
        const amount = t.amount * rateToApp;

        if (amount > 0) incomeData[index] += amount;
        else expenseData[index] += Math.abs(amount);
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
  }, [
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
  ]);

  const doughnutOptions: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      borderRadius: 4,
      plugins: {
        legend: {
          position: "right" as const,
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            padding: 20,
            color: isDark ? "rgb(148, 163, 184)" : "rgb(100, 116, 139)",
            font: {
              family: "Inter",
              size: 12,
            },
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.tooltipText,
          bodyColor: chartColors.tooltipText,
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: "Inter", size: 13 },
          bodyFont: { family: "Inter", size: 12 },
          callbacks: {
            label: function (context: TooltipItem<"doughnut">) {
              const dataset = context.dataset as typeof context.dataset & {
                originalData?: number[];
              };
              const value = dataset.originalData
                ? dataset.originalData[context.dataIndex]
                : context.raw;

              let label = context.label || "";
              if (label) {
                label += ": ";
              }
              if (value !== null && value !== undefined) {
                label += formatNumber(Number(value), {
                  style: "currency",
                  ignorePrivacy: true,
                });
              }
              return label;
            },
            labelColor: function (context: TooltipItem<"doughnut">) {
              const dataset = context.dataset;
              const index = context.dataIndex;
              const tooltipBg = chartColors.tooltipBg;

              const bg =
                Array.isArray(dataset.backgroundColor) &&
                dataset.backgroundColor[index] !== undefined
                  ? dataset.backgroundColor[index]
                  : dataset.backgroundColor;
              const border =
                Array.isArray(dataset.borderColor) &&
                dataset.borderColor[index] !== undefined
                  ? dataset.borderColor[index]
                  : dataset.borderColor;

              const backgroundColor =
                bg === "transparent" || bg === "rgba(0, 0, 0, 0)"
                  ? tooltipBg
                  : bg;

              return {
                borderColor: String(border),
                backgroundColor: String(backgroundColor),
                borderWidth: 2,
              };
            },
          },
        },
      },
    }),
    [isDark, formatNumber, chartColors],
  );

  const expensesOptions: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      borderRadius: 4,
      plugins: {
        legend: {
          position: "right" as const,
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            padding: 20,
            color: isDark ? "rgb(148, 163, 184)" : "rgb(100, 116, 139)",
            font: {
              family: "Inter",
              size: 12,
            },
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.tooltipText,
          bodyColor: chartColors.tooltipText,
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: "Inter", size: 13 },
          bodyFont: { family: "Inter", size: 12 },
          callbacks: {
            label: function (context: TooltipItem<"doughnut">) {
              const value = context.raw ?? 0;

              let label = context.label || "";
              if (label) label += ": ";
              label += formatNumber(Number(value) || 0, {
                style: "currency",
                ignorePrivacy: true,
              });
              return label;
            },
            labelColor: function (context: TooltipItem<"doughnut">) {
              const dataset = context.dataset;
              const index = context.dataIndex;
              const tooltipBg = chartColors.tooltipBg;

              const bg =
                Array.isArray(dataset.backgroundColor) &&
                dataset.backgroundColor[index] !== undefined
                  ? dataset.backgroundColor[index]
                  : dataset.backgroundColor;
              const border = dataset.borderColor;

              const backgroundColor =
                bg === "transparent" || bg === "rgba(0, 0, 0, 0)"
                  ? tooltipBg
                  : bg;

              return {
                borderColor: String(border),
                backgroundColor: String(backgroundColor),
                borderWidth: 2,
              };
            },
          },
        },
      },
    }),
    [isDark, formatNumber, chartColors],
  );

  const barOptions: ChartOptions<"bar"> = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
          align: "end" as const,
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            color: chartColors.text,
            font: {
              family: "Inter",
              size: 12,
            },
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.tooltipText,
          bodyColor: chartColors.tooltipText,
          padding: 12,
          cornerRadius: 8,
          titleFont: {
            family: "Inter",
            size: 13,
          },
          bodyFont: {
            family: "Inter",
            size: 12,
          },
          callbacks: {
            label: function (context: TooltipItem<"bar">) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                label += formatNumber(context.parsed.y, {
                  style: "currency",
                  ignorePrivacy: true,
                });
              }
              return label;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          border: {
            display: false,
          },
          grid: {
            color: chartColors.grid,
            borderDash: [4, 4],
            drawBorder: false,
          },
          ticks: {
            font: {
              family: "Inter",
              size: 11,
            },
            color: chartColors.text,
            padding: 10,
            callback: function (value: string | number) {
              const num = Number(value);
              if (Number.isNaN(num)) return value;
              return formatNumber(num, {
                style: "currency",
              });
            },
          },
        },
        x: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            font: {
              family: "Inter",
              size: 11,
            },
            color: chartColors.text,
          },
        },
      },
    };
  }, [formatNumber, chartColors]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: false,
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.tooltipText,
          bodyColor: chartColors.tooltipText,
          padding: 12,
          cornerRadius: 8,
          titleFont: {
            family: "Inter",
            size: 13,
          },
          bodyFont: {
            family: "Inter",
            size: 12,
          },
          displayColors: false,
          callbacks: {
            label: function (context: TooltipItem<"line">) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                // If this dataset represents an individual account, prefer
                // showing the value in the account's native currency when available.
                const ds = context.dataset as typeof context.dataset & {
                  accountCurrency?: string;
                  originalData?: number[];
                };
                if (ds.accountCurrency) {
                  const nativeVal =
                    ds.originalData && ds.originalData[context.dataIndex];
                  if (nativeVal !== undefined && nativeVal !== null) {
                    label += formatNumber(nativeVal, {
                      style: "currency",
                      currency: ds.accountCurrency,
                      ignorePrivacy: true,
                    });
                  } else {
                    label += formatNumber(context.parsed.y, {
                      style: "currency",
                      ignorePrivacy: true,
                    });
                  }
                } else {
                  label += formatNumber(context.parsed.y, {
                    style: "currency",
                    ignorePrivacy: true,
                  });
                }
              }
              return label;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          border: {
            display: false,
          },
          grid: {
            color: chartColors.grid,
            borderDash: [4, 4],
            drawBorder: false,
          },
          ticks: {
            font: {
              family: "Inter",
              size: 11,
            },
            color: chartColors.text,
            padding: 10,
            callback: function (value: string | number) {
              const num = Number(value);
              if (Number.isNaN(num)) return value;
              return formatNumber(num, {
                style: "currency",
              });
            },
          },
        },
        x: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            font: {
              family: "Inter",
              size: 11,
            },
            color: chartColors.text,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
      },
    }),
    [formatNumber, chartColors],
  );

  const retryFetch = useCallback(() => {
    setError(null);
    setLoading(true);
    const doFetch = async () => {
      try {
        const txs = (await rust.get_all_transactions()) as Transaction[];
        setTransactions(txs);
        if (propAccounts && propAccounts.length > 0) {
          setAccounts(propAccounts);
        } else {
          const accs = await rust.get_accounts();
          setAccounts(accs);
        }
      } catch (e) {
        handleAsyncError({
          context: "Failed to fetch dashboard data",
          error: e,
          setError,
          detailFallback: t("error.failed_to_load"),
        });
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [propAccounts, t]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="page-container dashboard-container">
        <div className="hb-header-container">
          <div>
            <h2 className="hb-header-title">{t("nav.dashboard")}</h2>
            <p className="hb-header-subtitle">
              {t("dashboard.subtitle.overview")}
            </p>
          </div>
        </div>
        <ErrorState
          title={t("error.failed_to_load")}
          message={error}
          onRetry={retryFetch}
          retryLabel={t("error.retry")}
        />
      </div>
    );
  }

  return (
    <div className="page-container dashboard-container">
      <div className="hb-header-container">
        <div>
          <h2 className="hb-header-title">{t("nav.dashboard")}</h2>
          <p className="hb-header-subtitle">
            {t("dashboard.subtitle.overview")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 min-w-0 flex-shrink">
          <TimeRangeSelector
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            setCustomStartDate={setCustomStartDate}
            setCustomEndDate={setCustomEndDate}
            dateFormat={dateFormat}
            firstDayOfWeek={firstDayOfWeek}
          />

          <AccountFilterPopover
            accounts={accounts}
            toggledAccounts={toggledAccounts}
            selectedAccountIds={selectedAccountIds}
            toggleAccountVisibility={toggleAccountVisibility}
            setAllAccountsVisibility={setAllAccountsVisibility}
            marketValues={marketValues}
            appCurrency={appCurrency}
            {...(chartData?.datasets
              ? {
                  chartDatasets: chartData.datasets as AccountChartDataset[],
                }
              : {})}
          />
        </div>
      </div>

      <SummaryCards
        netWorth={currentNetWorth}
        totalAccounts={filteredAccounts.length}
        totalTransactions={filteredTransactions.length}
      />

      {filteredTransactions.length === 0 ? null : (
        <NetWorthChart chartData={chartData} options={options} />
      )}

      <div className="charts-grid">
        {filteredTransactions.length === 0 ? (
          <div className="col-span-full flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-16">
            <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-2xl mb-4">
              <svg
                className="w-16 h-16 text-slate-300 dark:text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
              {t("account.no_transactions_found")}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {t("dashboard.no_transactions_body")}
            </p>
          </div>
        ) : (
          <>
            <IncomeVsExpensesChart
              incomeVsExpensesData={incomeVsExpensesData}
              barOptions={barOptions}
            />

            {/* Cash Flow Sankey */}
            <div
              className="chart-card chart-card-full"
              style={{ height: "500px" }}
            >
              <div className="chart-header">
                <h3 className="chart-title">{t("dashboard.cash_flow")}</h3>
                <p className="chart-subtitle">
                  {t("dashboard.subtitle.income_and_expense_flow")}
                </p>
              </div>
              <div className="chart-body">
                <SankeyDiagram
                  transactions={filteredTransactions}
                  timeRange={timeRange}
                  customStartDate={customStartDate}
                  customEndDate={customEndDate}
                  accountMap={accountMap}
                  getPrice={getPrice}
                  appCurrency={appCurrency}
                />
              </div>
            </div>

            <AssetAllocationChart
              doughnutData={doughnutData}
              doughnutOptions={doughnutOptions}
            />

            <ExpensesByCategoryChart
              expensesByCategoryData={
                expensesByCategoryData as
                  | (ChartData<"doughnut"> & { empty?: boolean })
                  | null
              }
              expensesOptions={expensesOptions}
            />
          </>
        )}
      </div>
    </div>
  );
}
