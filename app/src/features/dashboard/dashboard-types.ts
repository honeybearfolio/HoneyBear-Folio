import type {
  Account,
  DailyPrice,
  StockQuote,
  Transaction,
} from "../../api/types";

export type { Transaction };
export type Quote = StockQuote;
export type DailyPriceEntry = DailyPrice;

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
  totalLiabilitiesValue?: number;
}
