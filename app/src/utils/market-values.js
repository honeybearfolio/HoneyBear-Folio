import { rust } from "../api/tauri-client";

function buildAccountHoldings(transactions) {
  const accountHoldings = {};
  const allTickers = new Set();

  transactions.forEach((tx) => {
    if (tx.ticker && tx.shares) {
      if (!accountHoldings[tx.account_id]) accountHoldings[tx.account_id] = {};
      if (!accountHoldings[tx.account_id][tx.ticker]) accountHoldings[tx.account_id][tx.ticker] = 0;
      accountHoldings[tx.account_id][tx.ticker] += tx.shares;
      allTickers.add(tx.ticker);
    }
  });

  return { accountHoldings, allTickers };
}

function buildQuoteMap(quotes) {
  const quoteMap = {};
  quotes.forEach((quote) => {
    quoteMap[quote.symbol] = quote;
  });
  return quoteMap;
}

async function fetchExchangeRates({ accountHoldings, accountCcyMap, appCurrency, quoteMap }) {
  const ratesToFetch = new Set();
  const quoteKeys = Object.keys(quoteMap);

  for (const [accountId, holdings] of Object.entries(accountHoldings)) {
    const targetCcy = accountCcyMap[Number(accountId)] || appCurrency;
    for (const ticker of Object.keys(holdings)) {
      const matchingTicker = quoteKeys.find((name) => name.toLowerCase() === ticker.toLowerCase());
      const quote = quoteMap[matchingTicker];
      if (quote && quote.currency && quote.currency !== targetCcy) {
        ratesToFetch.add(`${quote.currency}${targetCcy}=X`);
      }
    }
  }

  if (ratesToFetch.size === 0) return {};

  const rateQuotes = await rust.get_stock_quotes({ tickers: Array.from(ratesToFetch) });
  const rates = {};
  rateQuotes.forEach((quote) => {
    rates[quote.symbol] = quote.regularMarketPrice;
  });
  return rates;
}

function computeMarketValues({ accountHoldings, accountCcyMap, appCurrency, quoteMap, exchangeRates }) {
  const newMarketValues = {};

  for (const [accountId, holdings] of Object.entries(accountHoldings)) {
    let totalValue = 0;
    const targetCcy = accountCcyMap[Number(accountId)] || appCurrency;

    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares > 0.0001) {
        const quoteName = Object.keys(quoteMap).find((name) => name.toLowerCase() === ticker.toLowerCase());
        const quote = quoteMap[quoteName];
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

export async function fetchMarketValuesForAccounts(currentAccounts = [], appCurrency = "USD") {
  const transactions = await rust.get_all_transactions();
  const { accountHoldings, allTickers } = buildAccountHoldings(transactions);
  if (allTickers.size === 0) return {};

  const accountCcyMap = {};
  currentAccounts.forEach((acc) => {
    if (acc.currency) accountCcyMap[acc.id] = acc.currency;
  });

  const quotes = await rust.get_stock_quotes({ tickers: Array.from(allTickers) });
  const quoteMap = buildQuoteMap(quotes);
  const exchangeRates = await fetchExchangeRates({ accountHoldings, accountCcyMap, appCurrency, quoteMap });

  return computeMarketValues({ accountHoldings, accountCcyMap, appCurrency, quoteMap, exchangeRates });
}
