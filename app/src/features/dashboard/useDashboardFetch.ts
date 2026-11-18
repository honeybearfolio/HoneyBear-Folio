import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { TFunction } from "i18next";
import { rust } from "../../api/tauri-client";
import type { Account } from "../../api/types";
import { handleAsyncError, logError } from "../../utils/errors";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";
import { parseIsoDate } from "./dashboard-layout";
import { createGetPrice } from "./dashboard-prices";
import {
  accountIdsOf,
  normalizeDashboardChartSeries,
  type DashboardChartQuery,
  type DashboardChartSeries,
} from "./dashboard-series";
import { dashboardChartQuery } from "./dashboard-time-range";
import type { DailyPriceEntry, DailyPriceData, Quote } from "./dashboard-types";

interface UseDashboardFetchArgs {
  propAccounts: Account[];
  appCurrency: string;
  t: TFunction;
}

function fxTickers(
  accounts: readonly Account[],
  appCurrency: string,
): string[] {
  const tickers = new Set<string>();
  for (const account of accounts) {
    const currency = account.currency || appCurrency;
    if (currency !== appCurrency) tickers.add(`${currency}${appCurrency}=X`);
  }
  return [...tickers];
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDailyPriceList(value: unknown): value is DailyPriceEntry[] {
  return Array.isArray(value);
}

function toDailyPriceData(prices: unknown): DailyPriceData {
  const list = isDailyPriceList(prices) ? prices.slice() : [];
  list.sort((a, b) => (a.date > b.date ? 1 : -1));
  const map: Record<string, number> = {};
  for (const entry of list) map[entry.date] = entry.price;
  return { list, map };
}

function historyFreshToday(
  data: DailyPriceData | undefined,
  today: string,
): boolean {
  if (!data || data.list.length === 0) return false;
  const latest = data.list[data.list.length - 1]?.date;
  return latest !== undefined && latest >= today;
}

async function readDailyPrices(
  tickers: readonly string[],
): Promise<Record<string, DailyPriceData>> {
  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      const prices = await rust.get_daily_stock_prices({ ticker });
      return [ticker, toDailyPriceData(prices)] as const;
    }),
  );
  const pricesMap: Record<string, DailyPriceData> = {};
  for (const [ticker, data] of entries) pricesMap[ticker] = data;
  return pricesMap;
}

async function waitForSettled(
  current: () => Promise<void>,
  cancelled: () => boolean,
): Promise<boolean> {
  let flight = current();
  for (;;) {
    await flight;
    if (cancelled()) return false;
    const latest = current();
    if (latest === flight) return true;
    flight = latest;
  }
}

export function useDashboardFetch({
  propAccounts,
  appCurrency,
  t,
}: UseDashboardFetchArgs) {
  const [accounts, setAccounts] = useState<Account[]>(propAccounts);
  const [accountsReady, setAccountsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartSeries, setChartSeries] = useState<DashboardChartSeries | null>(
    null,
  );
  const [chartQuery, setChartQuery] = useState<DashboardChartQuery | null>(
    null,
  );
  const [dailyPrices, setDailyPrices] = useState<
    Record<string, DailyPriceData>
  >({});
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const requestRef = useRef(0);
  const pricedKey = useRef("");
  const propAccountsRef = useRef(propAccounts);
  const accountsRef = useRef(propAccounts);
  const paintFlight = useRef<Promise<void>>(Promise.resolve());
  const chartLoads = useRef(0);

  useEffect(() => {
    propAccountsRef.current = propAccounts;
  }, [propAccounts]);

  const hiddenAccountIds = useDashboardPreferencesStore(
    (state) => state.view.hiddenAccountIds,
  );
  const timeRange = useDashboardPreferencesStore(
    (state) => state.view.timeRange,
  );
  const customStartDate = useDashboardPreferencesStore(
    (state) => state.view.customStartDate,
  );
  const customEndDate = useDashboardPreferencesStore(
    (state) => state.view.customEndDate,
  );
  const hiddenKey = hiddenAccountIds.join("|");
  const providedKey = propAccounts
    .map((account) => String(account.id))
    .join(",");

  const accountMap = useMemo(() => {
    const map: Record<string | number, Account> = {};
    accounts.forEach((acc) => {
      map[acc.id] = acc;
    });
    return map;
  }, [accounts]);

  const loadSeries = useCallback(
    (source: readonly Account[]) => {
      chartLoads.current += 1;
      const request = ++requestRef.current;
      const run = (async () => {
        const view = useDashboardPreferencesStore.getState().view;
        const hidden = new Set(view.hiddenAccountIds);
        const visible = source.filter(
          (account) => !hidden.has(String(account.id)),
        );
        const query = dashboardChartQuery(
          view.timeRange,
          parseIsoDate(view.customStartDate) ?? new Date(),
          parseIsoDate(view.customEndDate) ?? new Date(),
          accountIdsOf(visible),
          appCurrency,
        );
        const result = await rust.get_dashboard_chart_series({ query });
        if (request !== requestRef.current) return;
        setChartQuery(query);
        setChartSeries(normalizeDashboardChartSeries(result));
      })();
      paintFlight.current = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    [appCurrency],
  );
  const loadSeriesRef = useRef(loadSeries);

  useEffect(() => {
    loadSeriesRef.current = loadSeries;
  }, [loadSeries]);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  useEffect(() => {
    const request = { cancelled: false };
    const provided = propAccountsRef.current;
    void (async () => {
      try {
        const accs = provided.length > 0 ? provided : await rust.get_accounts();
        if (request.cancelled) return;
        setAccounts(accs);
        setError(null);
        setAccountsReady(true);
      } catch (e: unknown) {
        if (request.cancelled) return;
        handleAsyncError({
          context: "Failed to fetch dashboard data",
          error: e,
          setError,
          detailFallback: t("error.failed_to_load"),
        });
        setLoading(false);
      }
    })();
    return () => {
      request.cancelled = true;
    };
  }, [providedKey, reloadToken, t]);

  useEffect(() => {
    if (!accountsReady) return;
    const request = { cancelled: false };
    void (async () => {
      try {
        await loadSeries(accounts);
        if (!request.cancelled) setError(null);
      } catch (e: unknown) {
        if (request.cancelled) return;
        handleAsyncError({
          context: "Failed to fetch dashboard data",
          error: e,
          setError,
          detailFallback: t("error.failed_to_load"),
        });
      } finally {
        if (!request.cancelled) setLoading(false);
      }
    })();
    return () => {
      request.cancelled = true;
    };
  }, [
    accountsReady,
    accounts,
    hiddenKey,
    timeRange,
    customStartDate,
    customEndDate,
    appCurrency,
    loadSeries,
    reloadToken,
    t,
  ]);

  const priceTickers = useMemo(() => {
    const stocks = chartSeries?.tickers ?? [];
    return [
      ...new Set([...stocks, ...fxTickers(accounts, appCurrency)]),
    ].sort();
  }, [chartSeries, accounts, appCurrency]);
  const priceKey = priceTickers.join("|");

  useEffect(() => {
    if (priceKey === "" || pricedKey.current === priceKey) return;
    pricedKey.current = priceKey;
    const tickers = priceKey.split("|");
    let cancelled = false;
    const isCancelled = () => cancelled;

    void (async () => {
      const stocks = tickers.filter((ticker) => !ticker.endsWith("=X"));
      const quotesTask = (async () => {
        try {
          const nextQuotes =
            stocks.length > 0
              ? await rust.get_stock_quotes({ tickers: stocks })
              : [];
          if (isCancelled()) return;
          setQuotes(Array.isArray(nextQuotes) ? nextQuotes : []);
        } catch (e) {
          logError("Failed to fetch stock quotes", e);
        }
      })();

      try {
        const stored = await readDailyPrices(tickers);
        if (isCancelled()) return;
        setDailyPrices(stored);

        const today = utcToday();
        const stale = tickers.filter(
          (ticker) => !historyFreshToday(stored[ticker], today),
        );
        if (stale.length > 0) {
          await rust.update_daily_stock_prices({ tickers: stale });
          if (isCancelled()) return;
          const refreshed = await readDailyPrices(stale);
          if (isCancelled()) return;
          setDailyPrices({ ...stored, ...refreshed });
          if (chartLoads.current > 0) {
            const painted = await waitForSettled(
              () => paintFlight.current,
              isCancelled,
            );
            if (!painted) return;
            await loadSeriesRef.current(accountsRef.current);
          }
        }
      } catch (e) {
        logError("Failed to fetch daily prices", e);
      } finally {
        await quotesTask;
      }
    })();

    return () => {
      cancelled = true;
      if (pricedKey.current === priceKey) pricedKey.current = "";
    };
  }, [priceKey, reloadToken]);

  const getPrice = useMemo(() => createGetPrice(dailyPrices), [dailyPrices]);

  const retryFetch = useCallback(() => {
    setError(null);
    setLoading(true);
    pricedKey.current = "";
    setReloadToken((token) => token + 1);
  }, []);

  return {
    accounts,
    loading,
    error,
    chartSeries,
    chartQuery,
    dailyPrices,
    quotes,
    getPrice,
    accountMap,
    retryFetch,
  };
}
