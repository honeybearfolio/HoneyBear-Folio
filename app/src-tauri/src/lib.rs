mod core;
pub use crate::core::{
    accounts, assets, calculations, db_init, io, llm, markets, models, pdf, rules, scheduled,
    session, transactions, utils,
};

pub use crate::models::{
    Account, AppSettings, DailyPrice, RecentDb, Rule, ScheduledOccurrence, ScheduledTransaction,
    Transaction, YahooChartResponse, YahooQuote, YahooSearchQuote, YahooSearchResponse,
};

// Re-export utility helpers used by tests
pub use crate::utils::{
    calculate_account_balances, get_custom_exchange_rate_db,
    get_system_theme as get_system_theme_fn, set_custom_exchange_rate_db,
};

// Re-export transactions helpers
pub use crate::transactions::{get_categories_db, get_payees_db};

pub use crate::transactions::{
    create_investment_transaction_db,
    // re-export module helpers for tests
    create_transaction_db,
    delete_transaction_db,
    get_all_transactions_db,
    get_transactions_db,
    update_investment_transaction_db,
    update_transaction_db,
    CreateInvestmentTransactionArgs,
    CreateTransactionArgs,
    UpdateInvestmentTransactionArgs,
    UpdateTransactionArgs,
};

// Re-export accounts helpers used by tests
pub use crate::accounts::{
    create_account_db, delete_account_db, get_accounts_db, get_accounts_summary_db,
    rename_account_db, update_account_db,
};

// Re-export rules helpers used by tests
pub use crate::rules::{
    create_rule_db, delete_rule_db, get_rules_db, update_rule_db, update_rules_order_db,
};

// Re-export scheduled helpers used by tests
pub use crate::scheduled::{
    apply_scheduled_occurrence_db, compute_occurrences, create_scheduled_transaction_db,
    delete_scheduled_transaction_db, get_pending_occurrences_db, get_scheduled_transactions_db,
    skip_scheduled_occurrence_db, update_scheduled_transaction_db, CreateScheduledTransactionArgs,
    UpdateScheduledTransactionArgs,
};

// Re-export assets helpers used by tests
pub use crate::assets::{
    create_asset_db, create_valuation_db, delete_asset_db, delete_valuation_db, get_assets_db,
    get_total_assets_value_db, get_valuations_db, update_asset_db, update_valuation_db,
};

// Re-export markets helpers used by tests
pub use crate::markets::{
    get_daily_stock_prices_from_path, get_stock_quotes_with_client_and_db,
    search_ticker_with_client, update_daily_stock_prices_with_client_and_base,
};

// Test-only helpers
#[cfg(test)]
pub(crate) use crate::tests::test_helpers::{
    create_account_in_dir, create_transaction_in_dir, get_db_path_for_dir, init_db_at_path,
    read_settings_from_dir, write_settings_to_dir,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Migrate: if there's an active db_path but it's not in recent_dbs yet,
            // add it so existing users see their session in the picker.
            if let Ok(mut settings) = db_init::read_settings(app.handle()) {
                if let Some(ref path) = settings.db_path.clone() {
                    if !settings.recent_dbs.iter().any(|r| r.path == *path) {
                        session::upsert_recent_public(&mut settings, path, None);
                        let _ = db_init::write_settings(app.handle(), &settings);
                    }
                }
            }

            // Only initialize the DB if an active session is configured.
            // If no db_path is set (fresh install), the frontend will show the
            // session picker and call create_session / open_session which runs init_db.
            let has_session = db_init::read_settings(app.handle())
                .map(|s| s.db_path.is_some())
                .unwrap_or(false);
            if has_session {
                db_init::init_db(app.handle())?;
            }

            #[cfg(target_os = "linux")]
            {
                use tauri::Emitter;
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    use std::time::Duration;
                    let mut last =
                        utils::get_system_theme().unwrap_or_else(|_| "light".to_string());
                    loop {
                        std::thread::sleep(Duration::from_secs(2));
                        let current =
                            utils::get_system_theme().unwrap_or_else(|_| "light".to_string());
                        if current != last {
                            last = current.clone();
                            let _ = handle.emit("system-theme-changed", current);
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            accounts::create_account,
            accounts::rename_account,
            accounts::update_account,
            accounts::delete_account,
            accounts::get_accounts,
            transactions::create_transaction,
            transactions::get_transactions,
            transactions::get_all_transactions,
            transactions::create_investment_transaction,
            transactions::update_transaction,
            io::read_xlsx,
            io::write_xlsx,
            transactions::update_investment_transaction,
            transactions::delete_transaction,
            transactions::get_payees,
            transactions::get_categories,
            markets::search_ticker,
            markets::get_stock_quotes,
            markets::update_daily_stock_prices,
            markets::get_daily_stock_prices,
            markets::check_currency_availability,
            db_init::set_db_path,
            db_init::reset_db_path,
            db_init::get_db_path_command,
            utils::get_system_theme,
            utils::set_custom_exchange_rate,
            utils::get_custom_exchange_rate,
            utils::get_all_exchange_rates,
            utils::delete_custom_exchange_rate,
            rules::get_rules,
            rules::create_rule,
            rules::update_rule,
            rules::delete_rule,
            rules::update_rules_order,
            scheduled::get_scheduled_transactions,
            scheduled::create_scheduled_transaction,
            scheduled::update_scheduled_transaction,
            scheduled::delete_scheduled_transaction,
            scheduled::get_pending_occurrences,
            scheduled::apply_scheduled_occurrence,
            scheduled::skip_scheduled_occurrence,
            calculations::compute_net_worth,
            calculations::build_holdings_from_transactions,
            calculations::merge_holdings_with_quotes,
            calculations::compute_portfolio_totals,
            calculations::compute_net_worth_market_values,
            calculations::calculate_deterministic_projection,
            calculations::run_monte_carlo_simulation,
            calculations::compute_report_data,
            pdf::generate_pdf_report,
            session::get_recent_sessions,
            session::get_active_session,
            session::create_session,
            session::open_session,
            session::remove_recent_session,
            session::rename_session,
            llm::get_llm_settings,
            llm::set_llm_settings,
            llm::list_ollama_models,
            llm::check_ollama_connection,
            llm::get_conversations,
            llm::get_conversation_messages,
            llm::create_conversation,
            llm::delete_conversation,
            llm::rename_conversation,
            llm::delete_all_conversations,
            llm::llm_chat,
            llm::cancel_llm_chat,
            assets::create_asset,
            assets::get_assets,
            assets::update_asset,
            assets::delete_asset,
            assets::create_valuation,
            assets::get_valuations,
            assets::update_valuation,
            assets::delete_valuation,
            assets::get_total_assets_value,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests;
