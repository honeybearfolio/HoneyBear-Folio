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
    quotes: quotes as StockQuote[],
  });
}

export async function computePortfolioTotals(
  finalHoldings: HoldingWithQuote[],
): Promise<PortfolioTotals> {
  return rust.compute_portfolio_totals({ holdings: finalHoldings });
}

export async function computeNetWorthMarketValues(
  transactions: InvestmentTransaction[],
  quotes: InvestmentQuote[],
): Promise<NetWorthMarketValues> {
  return rust.compute_net_worth_market_values({
    transactions: transactions as Transaction[],
    quotes: quotes as StockQuote[],
  });
}
