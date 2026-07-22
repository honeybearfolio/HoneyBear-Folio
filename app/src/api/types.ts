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

export interface XlsxSheetRows {
  name: string;
  data: unknown[][];
}

export interface XlsxReadResult {
  data: unknown[][];
  sheets?: XlsxSheetRows[];
}

export interface XlsxSheet {
  name: string;
  data: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface Asset {
  id: number;
  name: string;
  category: string;
  currency?: string;
  notes?: string;
}

export interface AssetValuation {
  id: number;
  asset_id: number;
  date: string;
  value: number;
}

export interface AssetWithLatestValue {
  id: number;
  name: string;
  category: string;
  currency?: string;
  notes?: string;
  latest_value?: number;
  latest_date?: string;
  exchange_rate: number;
}

// ---------------------------------------------------------------------------
// Liabilities
// ---------------------------------------------------------------------------

export interface Liability {
  id: number;
  name: string;
  category: string;
  currency?: string;
  notes?: string;
}

export interface LiabilityValuation {
  id: number;
  liability_id: number;
  date: string;
  value: number;
}

export interface LiabilityWithLatestValue {
  id: number;
  name: string;
  category: string;
  currency?: string;
  notes?: string;
  latest_value?: number;
  latest_date?: string;
  exchange_rate: number;
}

// ---------------------------------------------------------------------------
// Rust-side compute helpers (serde camelCase)
// ---------------------------------------------------------------------------

export interface Holding {
  ticker: string;
  shares: number;
  costBasis: number;
}

export interface HoldingWithQuote extends Holding {
  price: number;
  currentValue: number;
  roi: number;
  changePercent: number;
  quoteType?: string | null;
}

export interface PortfolioTotals {
  totalValue: number;
  totalCostBasis: number;
}

export interface HoldingsResult {
  currentHoldings: Holding[];
  firstTradeDate: string | null;
}

/** Per-account market values keyed by account ID string. */
export type NetWorthMarketValues = Record<string, number>;

// ---------------------------------------------------------------------------
// PDF report (serde snake_case — matches Rust ReportData structs)
// ---------------------------------------------------------------------------

export interface ReportSummary {
  net_worth: number;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  account_count: number;
}

export interface ReportAccountBalance {
  name: string;
  currency: string;
  currency_symbol: string;
  cash_balance: number;
  market_value: number;
  total: number;
  exchange_rate: number;
}

export interface ReportDataPoint {
  label: string;
  value: number;
}

export interface ReportMonthlyData {
  label: string;
  income: number;
  expenses: number;
}

export interface ReportCategoryAmount {
  category: string;
  amount: number;
  percentage: number;
}

export interface ReportCashFlow {
  total_income: number;
  total_expenses: number;
  total_investments: number;
  surplus_or_deficit: number;
  expense_categories: ReportCategoryAmount[];
  investment_categories: ReportCategoryAmount[];
}

export interface ReportHolding {
  ticker: string;
  shares: number;
  price: number;
  current_value: number;
  cost_basis: number;
  roi: number;
}

export interface ReportPortfolio {
  total_value: number;
  total_cost_basis: number;
  overall_roi: number;
  holdings: ReportHolding[];
}

export interface ReportTransaction {
  date: string;
  payee: string;
  category: string;
  amount: number;
  notes: string;
  ticker: string;
  shares: number;
  price_per_share: number;
  fee: number;
}

export interface ReportAccountTransactions {
  account_name: string;
  currency: string;
  currency_symbol: string;
  exchange_rate: number;
  transactions: ReportTransaction[];
}

export interface ReportLabels {
  title: string;
  financial_summary: string;
  net_worth_evolution: string;
  income_vs_expenses: string;
  expense_breakdown: string;
  income_breakdown: string;
  cash_flow_summary: string;
  investment_holdings: string;
  transactions_title: string;
  net_worth: string;
  total_income: string;
  total_expenses: string;
  net_savings: string;
  savings_rate: string;
  accounts: string;
  account: string;
  currency: string;
  cash_balance: string;
  market_value: string;
  total: string;
  category: string;
  amount: string;
  percentage: string;
  month: string;
  income: string;
  expenses: string;
  net: string;
  investments: string;
  surplus: string;
  deficit: string;
  ticker: string;
  shares: string;
  price: string;
  value: string;
  cost_basis: string;
  roi: string;
  date: string;
  payee: string;
  notes: string;
  fee: string;
  page: string;
  no_transactions: string;
  portfolio_total: string;
  overall_roi: string;
}

export interface ReportData {
  date_range_start: string;
  date_range_end: string;
  currency_symbol: string;
  generation_date: string;
  labels: ReportLabels;
  summary: ReportSummary;
  account_balances: ReportAccountBalance[];
  net_worth_points: ReportDataPoint[];
  monthly_income_expenses: ReportMonthlyData[];
  expense_categories: ReportCategoryAmount[];
  income_categories: ReportCategoryAmount[];
  cash_flow: ReportCashFlow;
  portfolio: ReportPortfolio | null;
  accounts_transactions: ReportAccountTransactions[];
}

export interface ExchangeRatePoint {
  date: string;
  price: number;
}

export interface ExchangeRateSeries {
  map: Record<string, number>;
  list: ExchangeRatePoint[];
}

export interface ReportComputeInput {
  accounts: Account[];
  transactions: Transaction[];
  startDate: string;
  endDate: string;
  appCurrency: string;
  exchangeRates: Record<string, ExchangeRateSeries>;
  quotes: StockQuote[];
  labels: ReportLabels;
}
