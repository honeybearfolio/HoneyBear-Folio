import type { Account } from "../../api/types";
import type { DailyPriceData, Transaction } from "./dashboard-types";

export function getPriceFromDailyPrices(
  dailyPrices: Record<string, DailyPriceData>,
  ticker: string,
  date: string,
): number {
  if (!dailyPrices[ticker]) return 0;
  const { list, map } = dailyPrices[ticker];
  if (map[date]) return map[date];
  let lastPrice = 0;
  for (const p of list) {
    if (p.date > date) break;
    lastPrice = p.price;
  }
  return lastPrice;
}

export type GetPriceFn = (ticker: string, date: string) => number;

export function createGetPrice(
  dailyPrices: Record<string, DailyPriceData>,
): GetPriceFn {
  return (ticker: string, date: string) =>
    getPriceFromDailyPrices(dailyPrices, ticker, date);
}

export function collectDailyPriceTickers(
  transactions: Transaction[],
  accounts: Account[],
  appCurrency: string,
): Set<string> {
  const tickers = new Set<string>();

  transactions.forEach((t) => {
    if (t.ticker) tickers.add(t.ticker);
  });

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

  return tickers;
}
