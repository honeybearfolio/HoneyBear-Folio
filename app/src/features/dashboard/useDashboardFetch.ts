import { useState, useEffect, useMemo, useCallback } from "react";
import type { TFunction } from "i18next";
import { rust } from "../../api/tauri-client";
import type { Account } from "../../api/types";
import { buildHoldingsFromTransactions } from "../../utils/investments";
import { handleAsyncError, logError } from "../../utils/errors";
import { collectDailyPriceTickers, createGetPrice } from "./dashboard-prices";
import type {
  DailyPriceEntry,
  DailyPriceData,
  Quote,
  Transaction,
} from "./dashboard-types";

interface UseDashboardFetchArgs {
  propAccounts: Account[];
  appCurrency: string;
  t: TFunction;
}

export function useDashboardFetch({
  propAccounts,
  appCurrency,
  t,
}: UseDashboardFetchArgs) {
  const [accounts, setAccounts] = useState<Account[]>(propAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyPrices, setDailyPrices] = useState<
    Record<string, DailyPriceData>
  >({});
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const accountMap = useMemo(() => {
    const map: Record<string | number, Account> = {};
    accounts.forEach((acc) => {
      map[acc.id] = acc;
    });
    return map;
  }, [accounts]);

  const loadCoreData = useCallback(async () => {
    const txs = await rust.get_all_transactions();
    setTransactions(txs);

    if (propAccounts.length > 0) {
      setAccounts(propAccounts);
    } else {
      const accs = await rust.get_accounts();
      setAccounts(accs);
    }
    setError(null);
  }, [propAccounts]);

  useEffect(() => {
    void (async () => {
      try {
        const txs = await rust.get_all_transactions();
        setTransactions(txs);

        if (propAccounts.length > 0) {
          setAccounts(propAccounts);
        } else {
          const accs = await rust.get_accounts();
          setAccounts(accs);
        }
        setError(null);
      } catch (e: unknown) {
        handleAsyncError({
          context: "Failed to fetch dashboard data",
          error: e,
          setError,
          detailFallback: t("error.failed_to_load"),
        });
      } finally {
        setLoading(false);
      }
    })();
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
        const qs = await rust.get_stock_quotes({
          tickers: uniqueTickers,
        });
        setQuotes(qs);
      } catch (e) {
        logError("Failed to fetch quotes", e);
      }
    };
    void fetchQuotes();
  }, [transactions]);

  useEffect(() => {
    const fetchDailyPrices = async () => {
      const tickers = collectDailyPriceTickers(
        transactions,
        accounts,
        appCurrency,
      );

      if (tickers.size === 0) return;

      try {
        await rust.update_daily_stock_prices({
          tickers: Array.from(tickers),
        });

        const pricesMap: Record<string, DailyPriceData> = {};
        for (const ticker of tickers) {
          const prices = await rust.get_daily_stock_prices({
            ticker,
          });
          prices.sort((a: DailyPriceEntry, b: DailyPriceEntry) =>
            a.date > b.date ? 1 : -1,
          );

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
      void fetchDailyPrices();
    }
  }, [transactions, accounts, appCurrency]);

  const getPrice = useMemo(() => createGetPrice(dailyPrices), [dailyPrices]);

  const retryFetch = useCallback(() => {
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        await loadCoreData();
      } catch (e: unknown) {
        handleAsyncError({
          context: "Failed to fetch dashboard data",
          error: e,
          setError,
          detailFallback: t("error.failed_to_load"),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCoreData, t]);

  return {
    accounts,
    transactions,
    loading,
    error,
    dailyPrices,
    quotes,
    getPrice,
    accountMap,
    retryFetch,
  };
}
