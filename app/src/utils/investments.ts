// Helpers to compute holdings and portfolio metrics from transactions and quotes

import type { StockQuote, Transaction } from "../api/types";

type InvestmentTransaction = Pick<
  Transaction,
  | "date"
  | "ticker"
  | "shares"
  | "price_per_share"
  | "fee"
  | "account_id"
  | "category"
> & {
  amount?: number;
};

type InvestmentQuote = Pick<
  StockQuote,
  "symbol" | "regularMarketPrice" | "regularMarketChangePercent" | "quoteType"
>;

interface Holding {
  ticker: string;
  shares: number;
  costBasis: number;
}

interface MergedHolding extends Holding {
  price: number;
  currentValue: number;
  roi: number;
  changePercent: number;
  quoteType: string | null;
}

export function buildHoldingsFromTransactions(
  transactions: InvestmentTransaction[],
): { currentHoldings: Holding[]; firstTradeDate: Date | null } {
  const holdingMap: Record<string, Holding> = {};
  let firstTradeDate: Date | null = null;

  // Sort transactions by date to ensure consistent results
  const txs = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  txs.forEach((tx) => {
    if (tx.ticker && tx.shares) {
      if (!firstTradeDate) firstTradeDate = new Date(tx.date);

      if (!holdingMap[tx.ticker]) {
        holdingMap[tx.ticker] = {
          ticker: tx.ticker,
          shares: 0,
          costBasis: 0,
        };
      }

      if (tx.shares > 0) {
        // Buy
        holdingMap[tx.ticker].shares += tx.shares;
        holdingMap[tx.ticker].costBasis +=
          (tx.price_per_share || 0) * tx.shares + (tx.fee || 0);
      } else {
        // Sell
        const currentShares = holdingMap[tx.ticker].shares;
        const currentCost = holdingMap[tx.ticker].costBasis;
        const avgCost = currentShares > 0 ? currentCost / currentShares : 0;
        const sharesSold = Math.abs(tx.shares);

        holdingMap[tx.ticker].shares -= sharesSold;
        holdingMap[tx.ticker].costBasis -= sharesSold * avgCost;
      }
    }
  });

  const currentHoldings = Object.values(holdingMap).filter(
    (h) => h.shares > 0.0001,
  );
  return { currentHoldings, firstTradeDate };
}

export function mergeHoldingsWithQuotes(
  holdings: Holding[],
  quotes: InvestmentQuote[],
): MergedHolding[] {
  const finalHoldings: MergedHolding[] = holdings.map((h) => {
    const quote = quotes.find(
      (q) => q.symbol.toLowerCase() === h.ticker.toLowerCase(),
    );
    const price = quote ? quote.regularMarketPrice : 0;
    const currentValue = h.shares * price;
    const roi =
      h.costBasis > 0 ? ((currentValue - h.costBasis) / h.costBasis) * 100 : 0;
    return {
      ...h,
      price,
      currentValue,
      roi,
      changePercent: quote ? (quote.regularMarketChangePercent ?? 0) : 0,
      quoteType: quote ? (quote.quoteType ?? null) : null,
    };
  });

  finalHoldings.sort((a, b) => b.currentValue - a.currentValue);
  return finalHoldings;
}

export function computePortfolioTotals(finalHoldings: MergedHolding[]): {
  totalValue: number;
  totalCostBasis: number;
} {
  const totalValue = finalHoldings.reduce(
    (s, h) => s + (h.currentValue || 0),
    0,
  );
  const totalCostBasis = finalHoldings.reduce(
    (s, h) => s + (h.costBasis || 0),
    0,
  );
  return { totalValue, totalCostBasis };
}

export function computeNetWorthMarketValues(
  transactions: InvestmentTransaction[],
  quotes: InvestmentQuote[],
): Record<string, number> {
  const accountHoldings: Record<string, Record<string, number>> = {};
  transactions.forEach((tx) => {
    if (tx.ticker && tx.shares) {
      if (!accountHoldings[tx.account_id]) accountHoldings[tx.account_id] = {};
      if (!accountHoldings[tx.account_id][tx.ticker])
        accountHoldings[tx.account_id][tx.ticker] = 0;
      accountHoldings[tx.account_id][tx.ticker] += tx.shares;
    }
  });

  const quoteMap: Record<string, number> = {};
  quotes.forEach((q) => (quoteMap[q.symbol] = q.regularMarketPrice));

  const map: Record<string, number> = {};
  for (const [accountId, holdings] of Object.entries(accountHoldings)) {
    let val = 0;
    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares > 0.0001) {
        val +=
          shares * (quoteMap[ticker] || quoteMap[ticker.toUpperCase()] || 0);
      }
    }
    map[accountId] = val;
  }

  return map;
}
