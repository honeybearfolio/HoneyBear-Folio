import { invoke } from "@tauri-apps/api/core";

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
  apply_scheduled_occurrence: (args?: RustArgs): Promise<unknown> =>
    callRust("apply_scheduled_occurrence", args),
  check_currency_availability: (args?: RustArgs): Promise<unknown> =>
    callRust("check_currency_availability", args),

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
  calculate_deterministic_projection: (args?: RustArgs): Promise<unknown> =>
    callRust("calculate_deterministic_projection", args),
  run_monte_carlo_simulation: (args?: RustArgs): Promise<unknown> =>
    callRust("run_monte_carlo_simulation", args),
  compute_report_data: (args?: RustArgs): Promise<unknown> =>
    callRust("compute_report_data", args),
  create_account: (args?: RustArgs): Promise<unknown> =>
    callRust("create_account", args),
  create_session: (args?: RustArgs): Promise<unknown> =>
    callRust("create_session", args),
  create_investment_transaction: (args?: RustArgs): Promise<unknown> =>
    callRust("create_investment_transaction", args),
  create_rule: (args?: RustArgs): Promise<unknown> =>
    callRust("create_rule", args),
  create_scheduled_transaction: (args?: RustArgs): Promise<unknown> =>
    callRust("create_scheduled_transaction", args),
  create_transaction: (args?: RustArgs): Promise<unknown> =>
    callRust("create_transaction", args),
  delete_account: (args?: RustArgs): Promise<unknown> =>
    callRust("delete_account", args),
  delete_custom_exchange_rate: (args?: RustArgs): Promise<unknown> =>
    callRust("delete_custom_exchange_rate", args),
  delete_rule: (args?: RustArgs): Promise<unknown> =>
    callRust("delete_rule", args),
  delete_scheduled_transaction: (args?: RustArgs): Promise<unknown> =>
    callRust("delete_scheduled_transaction", args),
  delete_transaction: (args?: RustArgs): Promise<unknown> =>
    callRust("delete_transaction", args),
  generate_pdf_report: (args?: RustArgs): Promise<unknown> =>
    callRust("generate_pdf_report", args),
  open_session: (args?: RustArgs): Promise<unknown> =>
    callRust("open_session", args),
  remove_recent_session: (args?: RustArgs): Promise<unknown> =>
    callRust("remove_recent_session", args),
  rename_session: (args?: RustArgs): Promise<unknown> =>
    callRust("rename_session", args),
  get_accounts: (args?: RustArgs): Promise<unknown> =>
    callRust("get_accounts", args),
  get_active_session: (): Promise<unknown> => callRust("get_active_session"),
  get_all_exchange_rates: (args?: RustArgs): Promise<unknown> =>
    callRust("get_all_exchange_rates", args),
  get_all_transactions: (args?: RustArgs): Promise<unknown> =>
    callRust("get_all_transactions", args),
  get_categories: (args?: RustArgs): Promise<unknown> =>
    callRust("get_categories", args),
  get_custom_exchange_rate: (args?: RustArgs): Promise<unknown> =>
    callRust("get_custom_exchange_rate", args),
  get_daily_stock_prices: (args?: RustArgs): Promise<unknown> =>
    callRust("get_daily_stock_prices", args),
  get_db_path_command: (args?: RustArgs): Promise<unknown> =>
    callRust("get_db_path_command", args),
  get_payees: (args?: RustArgs): Promise<unknown> =>
    callRust("get_payees", args),
  get_pending_occurrences: (args?: RustArgs): Promise<unknown> =>
    callRust("get_pending_occurrences", args),
  get_recent_sessions: (): Promise<unknown> => callRust("get_recent_sessions"),
  get_rules: (args?: RustArgs): Promise<unknown> => callRust("get_rules", args),
  get_scheduled_transactions: (args?: RustArgs): Promise<unknown> =>
    callRust("get_scheduled_transactions", args),
  get_stock_quotes: (args?: RustArgs): Promise<unknown> =>
    callRust("get_stock_quotes", args),
  get_system_theme: (args?: RustArgs): Promise<unknown> =>
    callRust("get_system_theme", args),
  get_transactions: (args?: RustArgs): Promise<unknown> =>
    callRust("get_transactions", args),
  read_xlsx: (args?: RustArgs): Promise<unknown> => callRust("read_xlsx", args),
  rename_account: (args?: RustArgs): Promise<unknown> =>
    callRust("rename_account", args),
  reset_db_path: (args?: RustArgs): Promise<unknown> =>
    callRust("reset_db_path", args),
  search_ticker: (args?: RustArgs): Promise<unknown> =>
    callRust("search_ticker", args),
  set_custom_exchange_rate: (args?: RustArgs): Promise<unknown> =>
    callRust("set_custom_exchange_rate", args),
  set_db_path: (args?: RustArgs): Promise<unknown> =>
    callRust("set_db_path", args),
  skip_scheduled_occurrence: (args?: RustArgs): Promise<unknown> =>
    callRust("skip_scheduled_occurrence", args),
  update_account: (args?: RustArgs): Promise<unknown> =>
    callRust("update_account", args),
  update_daily_stock_prices: (args?: RustArgs): Promise<unknown> =>
    callRust("update_daily_stock_prices", args),
  update_investment_transaction: (args?: RustArgs): Promise<unknown> =>
    callRust("update_investment_transaction", args),
  update_rule: (args?: RustArgs): Promise<unknown> =>
    callRust("update_rule", args),
  update_rules_order: (args?: RustArgs): Promise<unknown> =>
    callRust("update_rules_order", args),
  update_scheduled_transaction: (args?: RustArgs): Promise<unknown> =>
    callRust("update_scheduled_transaction", args),
  update_transaction: (args?: RustArgs): Promise<unknown> =>
    callRust("update_transaction", args),
  write_xlsx: (args?: RustArgs): Promise<unknown> =>
    callRust("write_xlsx", args),

  // LLM / Chat
  llm_chat: (args?: RustArgs): Promise<unknown> => callRust("llm_chat", args),
  cancel_llm_chat: (args?: RustArgs): Promise<unknown> =>
    callRust("cancel_llm_chat", args),
  get_llm_settings: (): Promise<unknown> => callRust("get_llm_settings"),
  set_llm_settings: (args?: RustArgs): Promise<unknown> =>
    callRust("set_llm_settings", args),
  list_ollama_models: (): Promise<unknown> => callRust("list_ollama_models"),
  check_ollama_connection: (): Promise<unknown> =>
    callRust("check_ollama_connection"),
  get_conversations: (): Promise<unknown> => callRust("get_conversations"),
  get_conversation_messages: (args?: RustArgs): Promise<unknown> =>
    callRust("get_conversation_messages", args),
  create_conversation: (args?: RustArgs): Promise<unknown> =>
    callRust("create_conversation", args),
  delete_conversation: (args?: RustArgs): Promise<unknown> =>
    callRust("delete_conversation", args),
  rename_conversation: (args?: RustArgs): Promise<unknown> =>
    callRust("rename_conversation", args),
  delete_all_conversations: (): Promise<unknown> =>
    callRust("delete_all_conversations"),
};
