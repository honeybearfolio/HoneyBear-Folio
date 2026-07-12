import { CURRENCIES } from "../../utils/currencies";
import type {
  Account,
  ScheduleRecord,
  TickerSuggestion,
} from "../../api/types";

export type { ScheduleRecord, TickerSuggestion };

export const currencyOptions = [
  { value: "", label: "—" },
  ...CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.code} (${c.symbol})`,
  })),
];

export type AccountRecord = Pick<Account, "id" | "name">;
