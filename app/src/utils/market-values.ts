import { rust } from "../api/tauri-client";
import type { Account, StockQuote, Transaction } from "../api/types";
import {
  buildAccountHoldingsFromTransactions,
  type AccountHoldingsMap,
} from "./account-holdings";

type MarketValueAccount = Pick<Account, "id" | "currency">;

type QuoteMap = Record<string, StockQuote>;
type RateMap = Record<string, number>;
type CurrencyMap = Record<number, string>;
type MarketValueMap = Record<string, number>;

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

  const rateQuotes = (await rust.get_stock_quotes({
    tickers: Array.from(ratesToFetch),
  })) as StockQuote[];
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

function computeMarketValues({
  accountHoldings,
  accountCcyMap,
  appCurrency,
  quoteMap,
  exchangeRates,
}: ComputeMarketValuesParams): MarketValueMap {
  const newMarketValues: MarketValueMap = {};

  for (const [accountId, holdings] of Object.entries(accountHoldings)) {
    let totalValue = 0;
    const targetCcy = accountCcyMap[Number(accountId)] || appCurrency;

    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares > 0.0001) {
        const quoteName = Object.keys(quoteMap).find(
          (name) => name.toLowerCase() === ticker.toLowerCase(),
        );
        const quote = quoteName ? quoteMap[quoteName] : undefined;
        if (!quote) continue;

        let price = quote.regularMarketPrice || 0;
        if (quote.currency && quote.currency !== targetCcy) {
          const pair = `${quote.currency}${targetCcy}=X`;
          if (exchangeRates[pair]) price = price * exchangeRates[pair];
        }
        totalValue += shares * price;
      }
    }

    newMarketValues[accountId] = totalValue;
  }

  return newMarketValues;
}

export async function fetchMarketValuesForAccounts(
  currentAccounts: MarketValueAccount[] = [],
  appCurrency: string = "USD",
): Promise<MarketValueMap> {
  const transactions = (await rust.get_all_transactions()) as Transaction[];
  const { accountHoldings, allTickers } =
    buildAccountHoldingsFromTransactions(transactions);
  if (allTickers.size === 0) return {};

  const accountCcyMap: CurrencyMap = {};
  currentAccounts.forEach((acc) => {
    if (acc.currency) accountCcyMap[Number(acc.id)] = acc.currency;
  });

  const quotes = (await rust.get_stock_quotes({
    tickers: Array.from(allTickers),
  })) as StockQuote[];
  const quoteMap = buildQuoteMap(quotes);
  const exchangeRates = await fetchExchangeRates({
    accountHoldings,
    accountCcyMap,
    appCurrency,
    quoteMap,
  });

  return computeMarketValues({
    accountHoldings,
    accountCcyMap,
    appCurrency,
    quoteMap,
    exchangeRates,
  });
}
