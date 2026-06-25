import type { InputHTMLAttributes } from "react";
import type { Account, RuleAction, RuleCondition } from "../../api/types";

export type { RuleAction, RuleCondition };

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

export interface Transaction {
  id: string | number;
  date: string;
  payee: string;
  category?: string;
  notes?: string;
  amount: number;
  account_id: string | number;
  account_name?: string;
  ticker?: string;
  shares?: number;
  price_per_share?: number;
  fee?: number;
  currency?: string;
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

export interface PendingOccurrence {
  scheduled_tx_id: string | number;
  date: string;
  payee?: string;
  category?: string;
  notes?: string;
  amount: number;
  account_id?: string | number;
  account_name?: string;
  status?: string;
}

export interface TickerSuggestion {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  typeDisp?: string;
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
