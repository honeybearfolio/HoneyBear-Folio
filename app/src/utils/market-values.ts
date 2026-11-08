import { rust } from "../api/tauri-client";
import type { Account, StockQuote } from "../api/types";
import {
  buildAccountHoldingsFromTransactions,
  type AccountHoldingsMap,
} from "./account-holdings";

type MarketValueAccount = Pick<Account, "id" | "currency">;

type QuoteMap = Record<string, StockQuote>;
type RateMap = Record<string, number>;
type CurrencyMap = Record<number, string>;
type MarketValueMap = Record<string, number>;

/** Per-account ticker values in the account currency. `null` means the quote is missing. */
export type HoldingValueMap = Record<string, Record<string, number | null>>;

function buildQuoteMap(quotes: StockQuote[]): QuoteMap {
  const quoteMap: QuoteMap = {};
  quotes.forEach((quote) => {
    quoteMap[quote.symbol] = quote;
  });
  return quoteMap;
}

interface FetchExchangeRatesParams {
  accountHoldings: AccountHoldingsMap;
  accountCcyMap: CurrencyMap;
  appCurrency: string;
  quoteMap: QuoteMap;
}

async function fetchExchangeRates({
  accountHoldings,
  accountCcyMap,
  appCurrency,
  quoteMap,
}: FetchExchangeRatesParams): Promise<RateMap> {
  const ratesToFetch = new Set<string>();
  const quoteKeys = Object.keys(quoteMap);

  for (const [accountId, holdings] of Object.entries(accountHoldings)) {
    const targetCcy = accountCcyMap[Number(accountId)] || appCurrency;
    for (const ticker of Object.keys(holdings)) {
      const matchingTicker = quoteKeys.find(
        (name) => name.toLowerCase() === ticker.toLowerCase(),
      );
      const quote = matchingTicker ? quoteMap[matchingTicker] : undefined;
      if (quote && quote.currency && quote.currency !== targetCcy) {
        ratesToFetch.add(`${quote.currency}${targetCcy}=X`);
      }
    }
  }

  if (ratesToFetch.size === 0) return {};

  const rateQuotes = await rust.get_stock_quotes({
    tickers: Array.from(ratesToFetch),
  });
  const rates: RateMap = {};
  rateQuotes.forEach((quote) => {
    rates[quote.symbol] = quote.regularMarketPrice;
  });
  return rates;
}

interface ComputeMarketValuesParams {
  accountHoldings: AccountHoldingsMap;
  accountCcyMap: CurrencyMap;
  appCurrency: string;
  quoteMap: QuoteMap;
  exchangeRates: RateMap;
}

function computeHoldingValues({
  accountHoldings,
  accountCcyMap,
  appCurrency,
  quoteMap,
  exchangeRates,
}: ComputeMarketValuesParams): HoldingValueMap {
  const holdingValues: HoldingValueMap = {};

  for (const [accountId, holdings] of Object.entries(accountHoldings)) {
    const byTicker: Record<string, number | null> = {};
    const targetCcy = accountCcyMap[Number(accountId)] || appCurrency;

    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares <= 0.0001) continue;
      const quoteName = Object.keys(quoteMap).find(
        (name) => name.toLowerCase() === ticker.toLowerCase(),
      );
      const quote = quoteName ? quoteMap[quoteName] : undefined;
      if (!quote) {
        byTicker[ticker] = null;
        continue;
      }

      let price = quote.regularMarketPrice || 0;
      if (quote.currency && quote.currency !== targetCcy) {
        const pair = `${quote.currency}${targetCcy}=X`;
        if (exchangeRates[pair]) price = price * exchangeRates[pair];
      }
      byTicker[ticker] = shares * price;
    }

    holdingValues[accountId] = byTicker;
  }

  return holdingValues;
}

function computeMarketValues(
  params: ComputeMarketValuesParams,
): MarketValueMap {
  const holdingValues = computeHoldingValues(params);
  const newMarketValues: MarketValueMap = {};

  for (const [accountId, tickers] of Object.entries(holdingValues)) {
    let totalValue = 0;
    for (const value of Object.values(tickers)) {
      if (value != null) totalValue += value;
    }
    newMarketValues[accountId] = totalValue;
  }

  return newMarketValues;
}

async function loadQuoteContext(
  currentAccounts: MarketValueAccount[],
  appCurrency: string,
): Promise<ComputeMarketValuesParams | null> {
  const transactions = await rust.get_all_transactions();
  const { accountHoldings, allTickers } =
    buildAccountHoldingsFromTransactions(transactions);
  if (allTickers.size === 0) return null;

  const accountCcyMap: CurrencyMap = {};
  currentAccounts.forEach((acc) => {
    if (acc.currency) accountCcyMap[Number(acc.id)] = acc.currency;
  });

  const quotes = await rust.get_stock_quotes({
    tickers: Array.from(allTickers),
  });
  const quoteMap = buildQuoteMap(quotes);
  const exchangeRates = await fetchExchangeRates({
    accountHoldings,
    accountCcyMap,
    appCurrency,
    quoteMap,
  });

  return {
    accountHoldings,
    accountCcyMap,
    appCurrency,
    quoteMap,
    exchangeRates,
  };
}

export async function fetchHoldingValuesForAccounts(
  currentAccounts: MarketValueAccount[] = [],
  appCurrency: string = "USD",
): Promise<HoldingValueMap> {
  const context = await loadQuoteContext(currentAccounts, appCurrency);
  if (!context) return {};
  return computeHoldingValues(context);
}

export async function fetchMarketValuesForAccounts(
  currentAccounts: MarketValueAccount[] = [],
  appCurrency: string = "USD",
): Promise<MarketValueMap> {
  const context = await loadQuoteContext(currentAccounts, appCurrency);
  if (!context) return {};
  return computeMarketValues(context);
}
