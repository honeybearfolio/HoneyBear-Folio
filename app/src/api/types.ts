// Shared domain types returned by the Rust backend (Tauri commands).
// These are the canonical TypeScript representations—prefer importing from
// here rather than redeclaring per-file.

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface Account {
  id: string | number;
  name: string;
  balance: number;
  totalValue?: number;
  currency?: string;
  kind?: string;
  exchange_rate?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

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
  tags?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface Session {
  path: string;
  name: string;
  last_opened?: string;
  file_exists?: boolean;
  file_size?: number;
}

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export interface ExchangeRate {
  currency: string;
  rate: number;
  isCustom: boolean;
}

// ---------------------------------------------------------------------------
// Stock quotes & daily prices
// ---------------------------------------------------------------------------

export interface StockQuote {
  symbol: string;
  regularMarketPrice: number;
  price?: number;
  ticker?: string;
  regularMarketChangePercent?: number;
  quoteType?: string | null;
  currency?: string;
  [key: string]: unknown;
}

export interface DailyPrice {
  date: string;
  price: number;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export interface RuleCondition {
  field: string;
  operator: string;
  value: string;
  negated?: boolean;
}

export interface RuleAction {
  field: string;
  value: string;
}

export interface RuleRecord {
  id: number;
  priority: number;
  logic?: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  match_field?: string;
  match_pattern?: string;
  action_field?: string;
  action_value?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Scheduled transactions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Ticker search
// ---------------------------------------------------------------------------

export interface TickerSuggestion {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  typeDisp?: string;
  currency?: string;
}

// ---------------------------------------------------------------------------
// FIRE projections
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// LLM / Chat
// ---------------------------------------------------------------------------

export interface LlmSettings {
  ollama_url?: string;
  ollama_model?: string;
}

export interface OllamaModel {
  name: string;
  size?: number;
}

export interface Conversation {
  id: string;
  title?: string;
  created_at?: string;
}

export interface ChatMessage {
  id?: number;
  role: string;
  content?: string;
  tool_call_id?: string;
  thinking?: string;
  conversation_id?: string;
  created_at?: string;
  tool_calls?: string;
}

// ---------------------------------------------------------------------------
// XLSX import/export
// ---------------------------------------------------------------------------

export interface XlsxReadResult {
  data: unknown[][];
}

export interface XlsxSheet {
  name: string;
  data: Record<string, unknown>[];
}
