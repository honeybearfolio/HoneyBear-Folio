import { CURRENCIES } from "../../utils/currencies";
import type { Account } from "../../api/types";

export const currencyOptions = [
  { value: "", label: "—" },
  ...CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.code} (${c.symbol})`,
  })),
];

export interface ScheduleRecord {
  id: number;
  account_id: number;
  transaction_type?: string;
  payee: string;
  amount: number;
  category?: string;
  notes?: string;
  currency?: string;
  recurrence_type: string;
  interval_value?: number;
  interval_unit?: string;
  days_of_week?: number[];
  ordinal?: number;
  weekday?: number;
  start_date: string;
  end_date?: string;
  max_occurrences?: number;
  enabled: boolean;
  ticker?: string;
  shares?: number;
  price_per_share?: number;
  fee?: number;
  is_buy?: boolean;
  occurrences_count?: number;
}

export type AccountRecord = Pick<Account, "id" | "name">;

export interface TickerSuggestion {
  symbol: string;
  currency?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  typeDisp?: string;
}
