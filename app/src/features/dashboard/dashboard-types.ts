import type { Account } from "../../api/types";

export interface Transaction {
  id?: string | number;
  amount: number;
  category?: string;
  account_id: string | number;
  date: string;
  payee?: string;
  notes?: string;
  tags?: string;
  ticker?: string;
  shares?: number;
  currency?: string;
  price_per_share?: number;
  fee?: number;
}

export interface Quote {
  ticker: string;
  price: number;
  symbol: string;
  regularMarketPrice: number;
  quoteType?: string | null;
}

export interface DailyPriceEntry {
  date: string;
  price: number;
}

export interface DailyPriceData {
  list: DailyPriceEntry[];
  map: Record<string, number>;
}

export interface AccountChartDataset {
  accountId?: string | number;
  _color?: string;
}

export interface DashboardProps {
  accounts?: Account[];
  marketValues?: Record<string, number>;
  totalAssetsValue?: number;
}
