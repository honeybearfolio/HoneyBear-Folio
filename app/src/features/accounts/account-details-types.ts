import type { InputHTMLAttributes } from "react";
import type {
  Account,
  PendingOccurrence,
  RuleAction,
  RuleCondition,
  TickerSuggestion,
  Transaction,
} from "../../api/types";

export type {
  PendingOccurrence,
  RuleAction,
  RuleCondition,
  TickerSuggestion,
  Transaction,
};

/** Real accounts plus the synthetic "all transactions" view. */
export type AccountDetailsAccount =
  | Account
  | (Pick<Account, "name" | "balance" | "totalValue" | "currency"> & {
      id: "all";
    });

export interface AccountDetailsProps {
  account: AccountDetailsAccount;
  onUpdate: () => void;
}

export interface AutocompleteSuggestion {
  value: string;
  label?: string;
  type?: string;
}

export interface AutocompleteInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  suggestions: AutocompleteSuggestion[];
}

/** In-progress transaction edit state; numeric fields may be strings while typing. */
export interface TransactionEditForm {
  id: string | number;
  date: string;
  payee: string;
  amount?: number | string;
  category?: string;
  notes?: string;
  account_id: string | number;
  account_name?: string;
  ticker?: string;
  shares?: number | string;
  price_per_share?: number | string;
  fee?: number | string;
  currency?: string;
}

export interface Rule {
  priority: number;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  logic?: string;
  match_field?: string;
  match_pattern?: string;
  action_field?: string;
  action_value?: string;
}

export type AvailableAccount = Pick<
  Account,
  "id" | "name" | "kind" | "currency"
>;

export interface MenuCoords {
  x?: number;
  y?: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
}

export type SortableTransactionKey = keyof Pick<
  Transaction,
  | "date"
  | "payee"
  | "category"
  | "notes"
  | "amount"
  | "shares"
  | "price_per_share"
  | "fee"
  | "ticker"
  | "account_name"
>;

export type FormFieldKey =
  | "payee"
  | "category"
  | "notes"
  | "amount"
  | "date"
  | "ticker"
  | "shares"
  | "price"
  | "fee";
