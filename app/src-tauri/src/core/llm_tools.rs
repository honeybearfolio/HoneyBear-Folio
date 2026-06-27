use crate::calculations::{
    build_holdings_from_transactions_logic, collect_tickers, compute_net_worth_logic,
    compute_net_worth_market_values_logic, compute_portfolio_totals_logic,
    merge_holdings_with_quotes_logic,
};
use crate::markets;
use crate::models::YahooQuote;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;

const YAHOO_BASE_URL: &str = "https://query1.finance.yahoo.com";

pub fn parse_target_currency(arguments: &Value) -> String {
    arguments
        .get("target_currency")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("USD")
        .to_string()
}

pub fn tool_get_assets(db_path: &PathBuf, arguments: &Value) -> Result<Value, String> {
    let target = parse_target_currency(arguments);
    let assets = crate::assets::get_assets_db(db_path, Some(&target))?;
    serde_json::to_value(&assets).map_err(|e| e.to_string())
}

pub fn tool_get_asset_valuations(db_path: &PathBuf, arguments: &Value) -> Result<Value, String> {
    let asset_id = arguments
        .get("asset_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "asset_id is required".to_string())? as i32;
    let valuations = crate::assets::get_valuations_db(db_path, asset_id)?;
    serde_json::to_value(&valuations).map_err(|e| e.to_string())
}

pub fn tool_get_total_assets_value(db_path: &PathBuf, arguments: &Value) -> Result<Value, String> {
    let target = parse_target_currency(arguments);
    let total = crate::assets::get_total_assets_value_db(db_path, Some(&target))?;
    Ok(json!({
        "target_currency": target,
        "total_value": total,
    }))
}

/// Reads cached stock prices from the database (used when network quotes are unavailable).
pub fn get_cached_quotes_db(
    db_path: &PathBuf,
    tickers: &[String],
) -> Result<Vec<YahooQuote>, String> {
    if tickers.is_empty() {
        return Ok(Vec::new());
    }

    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let placeholders: String = tickers.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let query = format!(
            "SELECT ticker, price FROM stock_prices WHERE ticker COLLATE NOCASE IN ({placeholders})"
        );
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(tickers.iter()), |row| {
                Ok(YahooQuote {
                    symbol: row.get(0)?,
                    price: row.get(1)?,
                    change_percent: 0.0,
                    currency: None,
                    quote_type: None,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
}

async fn fetch_investment_quotes(
    client: &reqwest::Client,
    db_path: &PathBuf,
    tickers: Vec<String>,
) -> Result<Vec<YahooQuote>, String> {
    if tickers.is_empty() {
        return Ok(Vec::new());
    }

    match markets::get_stock_quotes_with_client_and_db(
        client.clone(),
        YAHOO_BASE_URL.to_string(),
        db_path,
        tickers.clone(),
    )
    .await
    {
        Ok(quotes) => Ok(quotes),
        Err(_) => get_cached_quotes_db(db_path, &tickers),
    }
}

fn market_values_to_json_map(market_values: HashMap<String, f64>) -> HashMap<String, Value> {
    market_values
        .into_iter()
        .map(|(k, v)| (k, json!(v)))
        .collect()
}

fn accounts_with_converted_balances(
    db_path: &PathBuf,
    target_currency: &str,
    fx_rates: &HashMap<String, f64>,
) -> Result<Vec<crate::models::Account>, String> {
    let summary = crate::accounts::get_accounts_summary_db(db_path, target_currency)?;
    let custom_rates = crate::utils::get_custom_rates_map(db_path)?;
    Ok(crate::utils::calculate_account_balances(
        summary.accounts,
        summary.raw_data,
        target_currency,
        fx_rates,
        &custom_rates,
    ))
}

/// Computes a net-worth snapshot using pre-fetched quotes (sync, testable without network).
pub fn compute_net_worth_snapshot_with_quotes(
    db_path: &PathBuf,
    target_currency: &str,
    quotes: &[YahooQuote],
) -> Result<Value, String> {
    let fx_rates: HashMap<String, f64> =
        quotes.iter().map(|q| (q.symbol.clone(), q.price)).collect();
    let accounts = accounts_with_converted_balances(db_path, target_currency, &fx_rates)?;
    let transactions = crate::transactions::get_all_transactions_db(db_path)?;
    let market_values_f64 = compute_net_worth_market_values_logic(&transactions, quotes);
    let market_values_map = market_values_to_json_map(market_values_f64);

    let accounts_total = compute_net_worth_logic(&accounts, &market_values_map, None);
    let tracked_assets_total =
        crate::assets::get_total_assets_value_db(db_path, Some(target_currency))?;

    let account_breakdown: Vec<Value> = accounts
        .iter()
        .map(|acc| {
            let market_value = market_values_map
                .get(&acc.id.to_string())
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let total = (acc.balance + market_value) * acc.exchange_rate;
            json!({
                "id": acc.id,
                "name": acc.name,
                "currency": acc.currency,
                "balance": acc.balance,
                "market_value": market_value,
                "exchange_rate": acc.exchange_rate,
                "total": total,
            })
        })
        .collect();

    let total_net_worth = accounts_total + tracked_assets_total;

    Ok(json!({
        "target_currency": target_currency,
        "accounts": account_breakdown,
        "accounts_and_investments_total": accounts_total,
        "tracked_assets_total": tracked_assets_total,
        "total_net_worth": total_net_worth,
    }))
}

pub async fn tool_get_net_worth(
    client: &reqwest::Client,
    db_path: &PathBuf,
    arguments: &Value,
) -> Result<Value, String> {
    let target = parse_target_currency(arguments);
    let transactions = crate::transactions::get_all_transactions_db(db_path)?;
    let tickers = collect_tickers(&transactions);
    let quotes = fetch_investment_quotes(client, db_path, tickers).await?;
    compute_net_worth_snapshot_with_quotes(db_path, &target, &quotes)
}

pub async fn tool_get_portfolio_holdings(
    client: &reqwest::Client,
    db_path: &PathBuf,
    arguments: &Value,
) -> Result<Value, String> {
    let target = parse_target_currency(arguments);
    let transactions = crate::transactions::get_all_transactions_db(db_path)?;
    let holdings_result = build_holdings_from_transactions_logic(&transactions);
    let tickers: Vec<String> = holdings_result
        .current_holdings
        .iter()
        .map(|h| h.ticker.clone())
        .collect();
    let quotes = fetch_investment_quotes(client, db_path, tickers).await?;
    let enriched = merge_holdings_with_quotes_logic(&holdings_result.current_holdings, &quotes);
    let totals = compute_portfolio_totals_logic(&enriched);

    Ok(json!({
        "target_currency": target,
        "first_trade_date": holdings_result.first_trade_date,
        "holdings": enriched,
        "totals": totals,
    }))
}

/// Read custom exchange rates directly from the database.
pub fn get_exchange_rates_db(db_path: &PathBuf) -> Result<Vec<Value>, String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT currency, rate FROM custom_exchange_rates")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let currency: String = row.get(0)?;
                let rate: f64 = row.get(1)?;
                Ok(json!({ "currency": currency, "rate": rate }))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
}

pub async fn execute_tool(
    client: &reqwest::Client,
    db_path: &PathBuf,
    tool_name: &str,
    arguments: &Value,
) -> Result<Value, String> {
    match tool_name {
        "get_accounts" => {
            let accounts = crate::accounts::get_accounts_db(db_path)?;
            serde_json::to_value(&accounts).map_err(|e| e.to_string())
        }
        "get_transactions" => {
            let all = crate::transactions::get_all_transactions_db(db_path)?;
            let account_id = arguments.get("account_id").and_then(|v| v.as_i64());
            let category = arguments
                .get("category")
                .and_then(|v| v.as_str())
                .map(|s| s.to_lowercase());
            let payee = arguments
                .get("payee")
                .and_then(|v| v.as_str())
                .map(|s| s.to_lowercase());
            let start_date = arguments.get("start_date").and_then(|v| v.as_str());
            let end_date = arguments.get("end_date").and_then(|v| v.as_str());
            let limit = arguments
                .get("limit")
                .and_then(|v| v.as_u64())
                .unwrap_or(100) as usize;

            let filtered: Vec<_> = all
                .into_iter()
                .filter(|t| {
                    if let Some(aid) = account_id {
                        if t.account_id as i64 != aid {
                            return false;
                        }
                    }
                    if let Some(ref cat) = category {
                        if t.category
                            .as_deref()
                            .map(|c| c.to_lowercase() != *cat)
                            .unwrap_or(true)
                        {
                            return false;
                        }
                    }
                    if let Some(ref p) = payee {
                        if !t.payee.to_lowercase().contains(p.as_str()) {
                            return false;
                        }
                    }
                    if let Some(sd) = start_date {
                        if t.date.as_str() < sd {
                            return false;
                        }
                    }
                    if let Some(ed) = end_date {
                        if t.date.as_str() > ed {
                            return false;
                        }
                    }
                    true
                })
                .take(limit)
                .collect();

            serde_json::to_value(&filtered).map_err(|e| e.to_string())
        }
        "get_categories" => {
            let cats = crate::transactions::get_categories_db(db_path)?;
            serde_json::to_value(&cats).map_err(|e| e.to_string())
        }
        "get_payees" => {
            let payees = crate::transactions::get_payees_db(db_path)?;
            serde_json::to_value(&payees).map_err(|e| e.to_string())
        }
        "get_scheduled_transactions" => {
            let sched = crate::scheduled::get_scheduled_transactions_db(db_path)?;
            serde_json::to_value(&sched).map_err(|e| e.to_string())
        }
        "get_rules" => {
            let rules = crate::rules::get_rules_db(db_path)?;
            serde_json::to_value(&rules).map_err(|e| e.to_string())
        }
        "get_exchange_rates" => {
            let rates = get_exchange_rates_db(db_path)?;
            serde_json::to_value(&rates).map_err(|e| e.to_string())
        }
        "get_assets" => tool_get_assets(db_path, arguments),
        "get_asset_valuations" => tool_get_asset_valuations(db_path, arguments),
        "get_total_assets_value" => tool_get_total_assets_value(db_path, arguments),
        "get_portfolio_holdings" => tool_get_portfolio_holdings(client, db_path, arguments).await,
        "get_net_worth" => tool_get_net_worth(client, db_path, arguments).await,
        _ => Err(format!("Unknown tool: {tool_name}")),
    }
}
