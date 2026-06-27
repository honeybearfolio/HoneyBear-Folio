import { rust } from "../api/tauri-client";
import type {
  Holding,
  HoldingWithQuote,
  HoldingsResult,
  NetWorthMarketValues,
  PortfolioTotals,
  StockQuote,
  Transaction,
} from "../api/types";
import {
  buildAccountHoldingsFromTransactions,
  type AccountHoldingsMap,
} from "./account-holdings";

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

export async function buildHoldingsFromTransactions(
  transactions: InvestmentTransaction[],
): Promise<HoldingsResult> {
  return rust.build_holdings_from_transactions({
    transactions: transactions as Transaction[],
  });
}

export async function mergeHoldingsWithQuotes(
  holdings: Holding[],
  quotes: InvestmentQuote[],
): Promise<HoldingWithQuote[]> {
  return rust.merge_holdings_with_quotes({
    holdings,
    quotes: quotes,
  });
}

export async function computePortfolioTotals(
  finalHoldings: HoldingWithQuote[],
): Promise<PortfolioTotals> {
  return rust.compute_portfolio_totals({ holdings: finalHoldings });
}

/**
 * Computes per-account brokerage market values (shares × quote price).
 *
 * Intentionally skips FX conversion: the FIRE calculator uses this alongside
 * account cash balances that are already in each account's currency. For
 * FX-aware totals in the main app shell, use `fetchMarketValuesForAccounts`.
 */
export function computeNetWorthMarketValues(
  transactions: InvestmentTransaction[],
  quotes: InvestmentQuote[],
): Promise<NetWorthMarketValues> {
  const { accountHoldings } =
    buildAccountHoldingsFromTransactions(transactions);

  const quotePrices: Record<string, number> = {};
  for (const quote of quotes) {
    quotePrices[quote.symbol.toUpperCase()] = quote.regularMarketPrice;
  }

  return Promise.resolve(
    computeMarketValuesWithoutFx(accountHoldings, quotePrices),
  );
}

function computeMarketValuesWithoutFx(
  accountHoldings: AccountHoldingsMap,
  quotePrices: Record<string, number>,
): NetWorthMarketValues {
  const result: NetWorthMarketValues = {};

  for (const [accountId, holdings] of Object.entries(accountHoldings)) {
    let total = 0;
    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares > 0.0001) {
        const price = quotePrices[ticker.toUpperCase()] ?? 0;
        total += shares * price;
      }
    }
    result[accountId] = total;
  }

  return result;
}
