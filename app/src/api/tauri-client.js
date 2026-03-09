import { invoke } from "@tauri-apps/api/core";

export function callRust(command, args) {
  if (args === undefined) {
    return invoke(command);
  }
  return invoke(command, args);
}

export const rust = {
  apply_scheduled_occurrence: (args) => callRust("apply_scheduled_occurrence", args),
  check_currency_availability: (args) => callRust("check_currency_availability", args),
  create_account: (args) => callRust("create_account", args),
  create_investment_transaction: (args) => callRust("create_investment_transaction", args),
  create_rule: (args) => callRust("create_rule", args),
  create_scheduled_transaction: (args) => callRust("create_scheduled_transaction", args),
  create_transaction: (args) => callRust("create_transaction", args),
  delete_account: (args) => callRust("delete_account", args),
  delete_custom_exchange_rate: (args) => callRust("delete_custom_exchange_rate", args),
  delete_rule: (args) => callRust("delete_rule", args),
  delete_scheduled_transaction: (args) => callRust("delete_scheduled_transaction", args),
  delete_transaction: (args) => callRust("delete_transaction", args),
  generate_pdf_report: (args) => callRust("generate_pdf_report", args),
  get_accounts: (args) => callRust("get_accounts", args),
  get_all_exchange_rates: (args) => callRust("get_all_exchange_rates", args),
  get_all_transactions: (args) => callRust("get_all_transactions", args),
  get_categories: (args) => callRust("get_categories", args),
  get_custom_exchange_rate: (args) => callRust("get_custom_exchange_rate", args),
  get_daily_stock_prices: (args) => callRust("get_daily_stock_prices", args),
  get_db_path_command: (args) => callRust("get_db_path_command", args),
  get_payees: (args) => callRust("get_payees", args),
  get_pending_occurrences: (args) => callRust("get_pending_occurrences", args),
  get_rules: (args) => callRust("get_rules", args),
  get_scheduled_transactions: (args) => callRust("get_scheduled_transactions", args),
  get_stock_quotes: (args) => callRust("get_stock_quotes", args),
  get_system_theme: (args) => callRust("get_system_theme", args),
  get_transactions: (args) => callRust("get_transactions", args),
  read_xlsx: (args) => callRust("read_xlsx", args),
  rename_account: (args) => callRust("rename_account", args),
  reset_db_path: (args) => callRust("reset_db_path", args),
  search_ticker: (args) => callRust("search_ticker", args),
  set_custom_exchange_rate: (args) => callRust("set_custom_exchange_rate", args),
  set_db_path: (args) => callRust("set_db_path", args),
  skip_scheduled_occurrence: (args) => callRust("skip_scheduled_occurrence", args),
  update_account: (args) => callRust("update_account", args),
  update_daily_stock_prices: (args) => callRust("update_daily_stock_prices", args),
  update_investment_transaction: (args) => callRust("update_investment_transaction", args),
  update_rule: (args) => callRust("update_rule", args),
  update_rules_order: (args) => callRust("update_rules_order", args),
  update_scheduled_transaction: (args) => callRust("update_scheduled_transaction", args),
  update_transaction: (args) => callRust("update_transaction", args),
  write_xlsx: (args) => callRust("write_xlsx", args),
};
