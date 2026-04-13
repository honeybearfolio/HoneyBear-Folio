import { invoke } from "@tauri-apps/api/core";
import type {
  Account,
  ChatMessage,
  Conversation,
  DailyPrice,
  ExchangeRate,
  LlmSettings,
  MonteCarloResult,
  OllamaModel,
  PendingOccurrence,
  ProjectionResult,
  RuleRecord,
  ScheduleRecord,
  Session,
  StockQuote,
  TickerSuggestion,
  Transaction,
  XlsxReadResult,
  XlsxSheet,
} from "./types";

type RustArgs = Record<string, unknown>;

export function callRust<T = unknown>(
  command: string,
  args?: RustArgs,
): Promise<T> {
  if (args === undefined) {
    return invoke<T>(command);
  }
  return invoke<T>(command, args);
}

export const rust = {
  // ---------------------------------------------------------------------------
  // Scheduled occurrences
  // ---------------------------------------------------------------------------

  apply_scheduled_occurrence: (args: {
    scheduledTxId: string | number;
    applyDate: string;
  }): Promise<void> => callRust("apply_scheduled_occurrence", args),

  skip_scheduled_occurrence: (args: {
    scheduledTxId: string | number;
    skipDate: string;
  }): Promise<void> => callRust("skip_scheduled_occurrence", args),

  get_pending_occurrences: (args: {
    accountId: string | number | null;
  }): Promise<PendingOccurrence[]> => callRust("get_pending_occurrences", args),

  // ---------------------------------------------------------------------------
  // Currency & exchange rates
  // ---------------------------------------------------------------------------

  check_currency_availability: (args: { currency: string }): Promise<boolean> =>
    callRust("check_currency_availability", args),

  get_all_exchange_rates: (args: {
    appCurrency: string;
  }): Promise<ExchangeRate[]> => callRust("get_all_exchange_rates", args),

  get_custom_exchange_rate: (args: {
    currency: string;
  }): Promise<number | null> => callRust("get_custom_exchange_rate", args),

  set_custom_exchange_rate: (args: {
    currency: string;
    rate: number;
  }): Promise<void> => callRust("set_custom_exchange_rate", args),

  delete_custom_exchange_rate: (args: { currency: string }): Promise<void> =>
    callRust("delete_custom_exchange_rate", args),

  // ---------------------------------------------------------------------------
  // Rust-side compute helpers
  // ---------------------------------------------------------------------------

  compute_net_worth: (args?: RustArgs): Promise<unknown> =>
    callRust("compute_net_worth", args),

  build_holdings_from_transactions: (args?: RustArgs): Promise<unknown> =>
    callRust("build_holdings_from_transactions", args),

  merge_holdings_with_quotes: (args?: RustArgs): Promise<unknown> =>
    callRust("merge_holdings_with_quotes", args),

  compute_portfolio_totals: (args?: RustArgs): Promise<unknown> =>
    callRust("compute_portfolio_totals", args),

  compute_net_worth_market_values: (args?: RustArgs): Promise<unknown> =>
    callRust("compute_net_worth_market_values", args),

  // ---------------------------------------------------------------------------
  // FIRE projections
  // ---------------------------------------------------------------------------

  calculate_deterministic_projection: (args: {
    input: Record<string, unknown>;
  }): Promise<ProjectionResult> =>
    callRust("calculate_deterministic_projection", args),

  run_monte_carlo_simulation: (args: {
    input: Record<string, unknown>;
  }): Promise<MonteCarloResult> => callRust("run_monte_carlo_simulation", args),

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------

  compute_report_data: (args: {
    input: Record<string, unknown>;
  }): Promise<unknown> => callRust("compute_report_data", args),

  generate_pdf_report: (args: {
    filePath: string;
    data: unknown;
  }): Promise<void> => callRust("generate_pdf_report", args),

  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------

  create_account: (args: {
    name: string;
    balance?: number;
    kind?: string;
    currency?: string | null;
    initialTransaction?: {
      payee: string;
      notes: string;
      category: string;
    };
  }): Promise<Account> => callRust("create_account", args),

  get_accounts: (args?: { targetCurrency?: string }): Promise<Account[]> =>
    callRust("get_accounts", args),

  rename_account: (args: {
    id: string | number;
    newName: string;
  }): Promise<void> => callRust("rename_account", args),

  update_account: (args: {
    id: string | number;
    name: string;
    currency?: string | null;
  }): Promise<void> => callRust("update_account", args),

  delete_account: (args: { id: string | number }): Promise<void> =>
    callRust("delete_account", args),

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  create_session: (args: { path: string }): Promise<Session> =>
    callRust("create_session", args),

  open_session: (args: { path: string }): Promise<Session> =>
    callRust("open_session", args),

  get_active_session: (): Promise<Session | null> =>
    callRust("get_active_session"),

  get_recent_sessions: (): Promise<Session[]> =>
    callRust("get_recent_sessions"),

  remove_recent_session: (args: { path: string }): Promise<void> =>
    callRust("remove_recent_session", args),

  rename_session: (args: { path: string; newName: string }): Promise<void> =>
    callRust("rename_session", args),

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  create_transaction: (args: {
    args: Record<string, unknown>;
  }): Promise<void> => callRust("create_transaction", args),

  create_investment_transaction: (args: {
    args: Record<string, unknown>;
  }): Promise<void> => callRust("create_investment_transaction", args),

  get_transactions: (args: {
    accountId: string | number;
  }): Promise<Transaction[]> => callRust("get_transactions", args),

  get_all_transactions: (): Promise<Transaction[]> =>
    callRust("get_all_transactions"),

  update_transaction: (args: {
    args: Record<string, unknown>;
  }): Promise<void> => callRust("update_transaction", args),

  update_investment_transaction: (args: {
    args: Record<string, unknown>;
  }): Promise<void> => callRust("update_investment_transaction", args),

  delete_transaction: (args: { id: string | number }): Promise<void> =>
    callRust("delete_transaction", args),

  // ---------------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------------

  create_rule: (args: { args: Record<string, unknown> }): Promise<void> =>
    callRust("create_rule", args),

  get_rules: (): Promise<RuleRecord[]> => callRust("get_rules"),

  update_rule: (args: { args: Record<string, unknown> }): Promise<void> =>
    callRust("update_rule", args),

  update_rules_order: (args: { ruleIds: number[] }): Promise<void> =>
    callRust("update_rules_order", args),

  delete_rule: (args: { id: number }): Promise<void> =>
    callRust("delete_rule", args),

  // ---------------------------------------------------------------------------
  // Scheduled transactions
  // ---------------------------------------------------------------------------

  create_scheduled_transaction: (args: {
    args: Record<string, unknown>;
  }): Promise<void> => callRust("create_scheduled_transaction", args),

  get_scheduled_transactions: (): Promise<ScheduleRecord[]> =>
    callRust("get_scheduled_transactions"),

  update_scheduled_transaction: (args: {
    args: Record<string, unknown>;
  }): Promise<void> => callRust("update_scheduled_transaction", args),

  delete_scheduled_transaction: (args: { id: number }): Promise<void> =>
    callRust("delete_scheduled_transaction", args),

  // ---------------------------------------------------------------------------
  // Stock quotes & daily prices
  // ---------------------------------------------------------------------------

  get_stock_quotes: (args: { tickers: string[] }): Promise<StockQuote[]> =>
    callRust("get_stock_quotes", args),

  get_daily_stock_prices: (args: { ticker: string }): Promise<DailyPrice[]> =>
    callRust("get_daily_stock_prices", args),

  update_daily_stock_prices: (args: { tickers: unknown[] }): Promise<void> =>
    callRust("update_daily_stock_prices", args),

  search_ticker: (args: { query: string }): Promise<TickerSuggestion[]> =>
    callRust("search_ticker", args),

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------

  get_categories: (): Promise<string[]> => callRust("get_categories"),

  get_payees: (): Promise<string[]> => callRust("get_payees"),

  get_system_theme: (): Promise<string> => callRust("get_system_theme"),

  // ---------------------------------------------------------------------------
  // Database path
  // ---------------------------------------------------------------------------

  get_db_path_command: (): Promise<string> => callRust("get_db_path_command"),

  set_db_path: (args: { path: string }): Promise<void> =>
    callRust("set_db_path", args),

  reset_db_path: (): Promise<void> => callRust("reset_db_path"),

  // ---------------------------------------------------------------------------
  // XLSX import/export
  // ---------------------------------------------------------------------------

  read_xlsx: (args: { data: number[] }): Promise<XlsxReadResult> =>
    callRust("read_xlsx", args),

  write_xlsx: (args: {
    filePath: string;
    sheets: XlsxSheet[];
  }): Promise<void> => callRust("write_xlsx", args),

  // ---------------------------------------------------------------------------
  // LLM / Chat
  // ---------------------------------------------------------------------------

  llm_chat: (args: {
    conversationId: string;
    userMessage: string;
    think?: boolean;
  }): Promise<void> => callRust("llm_chat", args),

  cancel_llm_chat: (args: { conversationId: string }): Promise<void> =>
    callRust("cancel_llm_chat", args),

  get_llm_settings: (): Promise<LlmSettings> => callRust("get_llm_settings"),

  set_llm_settings: (args: {
    ollamaUrl: string;
    ollamaModel: string;
  }): Promise<void> => callRust("set_llm_settings", args),

  list_ollama_models: (): Promise<OllamaModel[]> =>
    callRust("list_ollama_models"),

  check_ollama_connection: (): Promise<boolean> =>
    callRust("check_ollama_connection"),

  get_conversations: (): Promise<Conversation[]> =>
    callRust("get_conversations"),

  get_conversation_messages: (args: {
    conversationId: string;
  }): Promise<ChatMessage[]> => callRust("get_conversation_messages", args),

  create_conversation: (args: { title: string }): Promise<Conversation> =>
    callRust("create_conversation", args),

  delete_conversation: (args: { conversationId: string }): Promise<void> =>
    callRust("delete_conversation", args),

  rename_conversation: (args: {
    conversationId: string;
    title: string;
  }): Promise<void> => callRust("rename_conversation", args),

  delete_all_conversations: (): Promise<void> =>
    callRust("delete_all_conversations"),
};
