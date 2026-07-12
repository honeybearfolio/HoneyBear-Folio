import type { StockQuote } from "../../api/types";

export type { ProjectionResult, MonteCarloResult } from "../../api/types";

export type InvestmentQuote = Pick<
  StockQuote,
  | "symbol"
  | "regularMarketPrice"
  | "regularMarketChangePercent"
  | "quoteType"
  | "currency"
>;
