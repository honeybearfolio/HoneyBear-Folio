export interface Account {
  id: number;
  kind: string;
  balance: number;
  [key: string]: unknown;
}

export interface InvestmentTransaction {
  date: string;
  ticker?: string;
  shares?: number;
  price_per_share?: number;
  fee?: number;
  account_id: number;
  amount: number;
  category?: string;
  [key: string]: unknown;
}

export interface InvestmentQuote {
  symbol: string;
  regularMarketPrice: number;
  [key: string]: unknown;
}

export interface ProjectionResult {
  fireNumber: number;
  yearsToFire: number | null;
  projectionData: number[];
  neverReached: boolean;
}

export interface MonteCarloResult {
  successRate: number;
  simulationCount: number;
  percentiles: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
}
