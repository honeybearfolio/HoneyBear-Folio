export interface Account {
  id: string | number;
  name?: string;
  balance?: number;
  totalValue?: number;
  currency?: string;
  kind?: string;
}

export interface AccountDetailsProps {
  account: Account;
  onUpdate: () => void;
}

export interface AutocompleteSuggestion {
  value: string;
  label?: string;
  type?: string;
}

export interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: AutocompleteSuggestion[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  [key: string]: unknown;
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
  [key: string]: unknown;
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

export interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

export interface RuleAction {
  field: string;
  value: string;
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

export interface AvailableAccount {
  id: string | number;
  name: string;
  kind?: string;
  currency?: string;
}

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
