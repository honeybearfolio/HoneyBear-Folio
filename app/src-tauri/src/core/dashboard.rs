//! Dashboard aggregates. Chart series stay in-process; widget rules load only
//! the rows that match a SQL `WHERE` clause.

use crate::models::Transaction;
use chrono::{Datelike, NaiveDate};
use rusqlite::functions::FunctionFlags;
use rusqlite::types::ToSql;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardChartQuery {
    pub account_ids: Vec<i32>,
    /// Inclusive `YYYY-MM-DD`. Empty starts at the earliest transaction.
    pub start_date: String,
    /// Inclusive `YYYY-MM-DD`.
    pub end_date: String,
    pub app_currency: String,
    /// `day` or `month` buckets for income and expenses.
    pub bucket: String,
    /// Move the first point forward to the earliest transaction.
    #[serde(default = "default_clamp_start")]
    pub clamp_start: bool,
}

fn default_clamp_start() -> bool {
    true
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardAccountSeries {
    pub account_id: i32,
    pub currency: String,
    pub native: Vec<f64>,
    pub converted: Vec<f64>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardIncomeExpenseBucket {
    pub key: String,
    pub income: f64,
    pub expenses: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardCategoryTotal {
    pub category: String,
    pub amount: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardChartSeries {
    pub dates: Vec<String>,
    pub totals: Vec<f64>,
    pub accounts: Vec<DashboardAccountSeries>,
    pub income_expense: Vec<DashboardIncomeExpenseBucket>,
    pub categories: Vec<DashboardCategoryTotal>,
    /// Stock tickers and FX pairs the series priced from `daily_stock_prices`.
    pub tickers: Vec<String>,
    pub bucket: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct DashboardTransactionFilter {
    pub field: String,
    pub operator: String,
    pub value: String,
}

#[derive(Clone)]
struct LedgerAccount {
    id: i32,
    balance: f64,
    currency: String,
}

struct LedgerTx {
    account_id: i32,
    date: String,
    amount: f64,
    category: Option<String>,
    ticker: Option<String>,
    shares: Option<f64>,
    currency: Option<String>,
}

struct AccountWalk {
    cash: f64,
    holdings: HashMap<String, f64>,
    ticker_currency: HashMap<String, String>,
    txs: Vec<LedgerTx>,
    cursor: usize,
}

struct PriceBook {
    series: HashMap<String, Vec<(String, f64)>>,
}

enum SqlValue {
    Int(i32),
    Real(f64),
    Text(String),
}

impl ToSql for SqlValue {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        match self {
            Self::Int(value) => value.to_sql(),
            Self::Real(value) => value.to_sql(),
            Self::Text(value) => value.to_sql(),
        }
    }
}

fn empty_series(bucket: &str) -> DashboardChartSeries {
    DashboardChartSeries {
        dates: Vec::new(),
        totals: Vec::new(),
        accounts: Vec::new(),
        income_expense: Vec::new(),
        categories: Vec::new(),
        tickers: Vec::new(),
        bucket: normalize_bucket(bucket).to_string(),
    }
}

fn normalize_bucket(bucket: &str) -> &'static str {
    if bucket.trim().eq_ignore_ascii_case("day") {
        "day"
    } else {
        "month"
    }
}

fn parse_iso(value: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d")
        .map_err(|_| format!("invalid dashboard date: {value}"))
}

fn format_iso(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

fn each_date(start: NaiveDate, end: NaiveDate) -> Vec<NaiveDate> {
    let mut dates = Vec::new();
    let mut cursor = start;
    while cursor <= end {
        dates.push(cursor);
        match cursor.succ_opt() {
            Some(next) => cursor = next,
            None => break,
        }
    }
    dates
}

fn month_keys(start: NaiveDate, end: NaiveDate) -> Vec<String> {
    let mut keys = Vec::new();
    let mut year = start.year();
    let mut month = start.month();
    loop {
        keys.push(format!("{year:04}-{month:02}"));
        if year == end.year() && month == end.month() {
            break;
        }
        if month == 12 {
            year += 1;
            month = 1;
        } else {
            month += 1;
        }
    }
    keys
}

fn nonempty(value: Option<String>) -> Option<String> {
    value.filter(|text| !text.is_empty())
}

fn currency_of(value: Option<&str>, fallback: &str) -> String {
    match value {
        Some(text) if !text.is_empty() => text.to_string(),
        _ => fallback.to_string(),
    }
}

fn ticker_of(tx: &LedgerTx) -> Option<&str> {
    tx.ticker.as_deref().filter(|ticker| !ticker.is_empty())
}

fn counts_as_cash_flow(tx: &LedgerTx) -> bool {
    tx.category.as_deref() != Some("Transfer") && ticker_of(tx).is_none()
}

impl PriceBook {
    fn price(&self, ticker: &str, date: &str) -> f64 {
        let Some(list) = self.series.get(ticker) else {
            return 0.0;
        };
        match list.binary_search_by(|(probe, _)| probe.as_str().cmp(date)) {
            Ok(index) => list[index].1,
            Err(0) => 0.0,
            Err(index) => list[index - 1].1,
        }
    }

    /// Missing or zero FX quotes fall back to `1`, matching the dashboard charts.
    fn rate(&self, pair: &str, date: &str) -> f64 {
        let price = self.price(pair, date);
        if price.abs() <= f64::EPSILON {
            1.0
        } else {
            price
        }
    }
}

impl AccountWalk {
    fn advance(&mut self, date: &str) {
        while self.cursor < self.txs.len() && self.txs[self.cursor].date.as_str() <= date {
            let tx = &self.txs[self.cursor];
            self.cash += tx.amount;
            if let Some(ticker) = ticker_of(tx) {
                if let Some(shares) = tx.shares.filter(|shares| shares.abs() > f64::EPSILON) {
                    *self.holdings.entry(ticker.to_string()).or_insert(0.0) += shares;
                    if let Some(currency) = nonempty(tx.currency.clone()) {
                        self.ticker_currency.insert(ticker.to_string(), currency);
                    }
                }
            }
            self.cursor += 1;
        }
    }

    fn value(
        &self,
        book: &PriceBook,
        date: &str,
        account_currency: &str,
        app_currency: &str,
    ) -> (f64, f64) {
        let mut stock = 0.0;
        for (ticker, shares) in &self.holdings {
            if shares.abs() <= 0.0001 {
                continue;
            }
            let price = book.price(ticker, date);
            let ticker_currency = self
                .ticker_currency
                .get(ticker)
                .map_or(account_currency, String::as_str);
            let rate_to_account = if ticker_currency == account_currency {
                1.0
            } else {
                book.rate(&format!("{ticker_currency}{account_currency}=X"), date)
            };
            stock += shares * price * rate_to_account;
        }
        let native = self.cash + stock;
        let rate_to_app = if account_currency == app_currency {
            1.0
        } else {
            book.rate(&format!("{account_currency}{app_currency}=X"), date)
        };
        (native, native * rate_to_app)
    }
}

fn placeholders(count: usize) -> String {
    std::iter::repeat_n("?", count)
        .collect::<Vec<_>>()
        .join(",")
}

fn load_accounts(conn: &rusqlite::Connection, ids: &[i32]) -> Result<Vec<LedgerAccount>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let sql = format!(
        "SELECT id, balance, currency FROM accounts WHERE id IN ({})",
        placeholders(ids.len())
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<&dyn ToSql> = ids.iter().map(|id| id as &dyn ToSql).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut by_id = HashMap::new();
    for row in rows {
        let (id, balance, currency) = row.map_err(|e| e.to_string())?;
        by_id.insert(id, (balance, currency));
    }
    Ok(ids
        .iter()
        .filter_map(|id| {
            by_id.get(id).map(|(balance, currency)| LedgerAccount {
                id: *id,
                balance: *balance,
                currency: currency.clone().unwrap_or_default(),
            })
        })
        .collect())
}

fn load_transactions(conn: &rusqlite::Connection, ids: &[i32]) -> Result<Vec<LedgerTx>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let sql = format!(
        "SELECT account_id, date, amount, category, ticker, shares, currency \
         FROM transactions WHERE account_id IN ({}) ORDER BY date ASC, id ASC",
        placeholders(ids.len())
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<&dyn ToSql> = ids.iter().map(|id| id as &dyn ToSql).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok(LedgerTx {
                account_id: row.get(0)?,
                date: row.get(1)?,
                amount: row.get(2)?,
                category: row.get(3)?,
                ticker: row.get(4)?,
                shares: row.get(5)?,
                currency: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn load_prices(
    conn: &rusqlite::Connection,
    tickers: &BTreeSet<String>,
) -> Result<PriceBook, String> {
    let mut series: HashMap<String, Vec<(String, f64)>> = HashMap::new();
    if tickers.is_empty() {
        return Ok(PriceBook { series });
    }
    let ticker_list: Vec<&String> = tickers.iter().collect();
    for chunk in ticker_list.chunks(400) {
        let sql = format!(
            "SELECT ticker, date, price FROM daily_stock_prices WHERE ticker IN ({}) ORDER BY ticker, date",
            placeholders(chunk.len())
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let params: Vec<&dyn ToSql> = chunk.iter().map(|ticker| *ticker as &dyn ToSql).collect();
        let rows = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (ticker, date, price) = row.map_err(|e| e.to_string())?;
            series.entry(ticker).or_default().push((date, price));
        }
    }
    Ok(PriceBook { series })
}

fn collect_tickers(
    accounts: &[LedgerAccount],
    txs: &[LedgerTx],
    app_currency: &str,
) -> BTreeSet<String> {
    let mut tickers = BTreeSet::new();
    let currencies: HashMap<i32, String> = accounts
        .iter()
        .map(|account| {
            (
                account.id,
                currency_of(Some(account.currency.as_str()), app_currency),
            )
        })
        .collect();
    for account in accounts {
        let account_currency = currencies
            .get(&account.id)
            .map_or(app_currency, String::as_str);
        if account_currency != app_currency {
            tickers.insert(format!("{account_currency}{app_currency}=X"));
        }
    }
    for tx in txs {
        let account_currency = currencies
            .get(&tx.account_id)
            .map_or(app_currency, String::as_str);
        if let Some(ticker) = ticker_of(tx) {
            tickers.insert(ticker.to_string());
            let ticker_currency = currency_of(tx.currency.as_deref(), account_currency);
            if ticker_currency != account_currency {
                tickers.insert(format!("{ticker_currency}{account_currency}=X"));
            }
        }
    }
    tickers
}

fn resolve_window(
    query: &DashboardChartQuery,
    first_tx: Option<&str>,
) -> Result<Option<(NaiveDate, NaiveDate)>, String> {
    let end = parse_iso(&query.end_date)?;
    let mut start = if query.start_date.trim().is_empty() {
        match first_tx {
            Some(date) => parse_iso(date)?,
            None => return Ok(None),
        }
    } else {
        parse_iso(&query.start_date)?
    };
    if query.clamp_start {
        if let Some(date) = first_tx {
            let first = parse_iso(date)?;
            if first > start {
                start = first;
            }
        }
    }
    if start > end {
        return Ok(None);
    }
    Ok(Some((start, end)))
}

/// Net worth points, income/expense buckets, and category totals for the accounts
/// and date range. Rows stay in the database.
pub fn dashboard_chart_series_db(
    db_path: &Path,
    query: &DashboardChartQuery,
) -> Result<DashboardChartSeries, String> {
    let bucket = normalize_bucket(&query.bucket);
    if query.account_ids.is_empty() {
        return Ok(empty_series(bucket));
    }
    let app_currency = if query.app_currency.trim().is_empty() {
        "USD".to_string()
    } else {
        query.app_currency.trim().to_string()
    };

    crate::db_locked!(db_path, {
        let conn = crate::db_init::open_db(db_path)?;
        let accounts = load_accounts(&conn, &query.account_ids)?;
        if accounts.is_empty() {
            return Ok(empty_series(bucket));
        }
        let ids: Vec<i32> = accounts.iter().map(|account| account.id).collect();
        let txs = load_transactions(&conn, &ids)?;
        if txs.is_empty() {
            return Ok(empty_series(bucket));
        }
        let first_tx = txs.first().map(|tx| tx.date.as_str());
        let Some((start, end)) = resolve_window(query, first_tx)? else {
            return Ok(empty_series(bucket));
        };
        let tickers = collect_tickers(&accounts, &txs, &app_currency);
        let book = load_prices(&conn, &tickers)?;
        Ok(build_series(
            &accounts,
            &txs,
            &book,
            &tickers,
            (start, end),
            bucket,
            &app_currency,
        ))
    })
}

fn build_series(
    accounts: &[LedgerAccount],
    txs: &[LedgerTx],
    book: &PriceBook,
    tickers: &BTreeSet<String>,
    window: (NaiveDate, NaiveDate),
    bucket: &str,
    app_currency: &str,
) -> DashboardChartSeries {
    let (start, end) = window;
    let mut by_account: HashMap<i32, Vec<LedgerTx>> = HashMap::new();
    for tx in txs {
        by_account.entry(tx.account_id).or_default().push(LedgerTx {
            account_id: tx.account_id,
            date: tx.date.clone(),
            amount: tx.amount,
            category: tx.category.clone(),
            ticker: tx.ticker.clone(),
            shares: tx.shares,
            currency: tx.currency.clone(),
        });
    }

    let mut walks = Vec::with_capacity(accounts.len());
    let mut currencies = Vec::with_capacity(accounts.len());
    for account in accounts {
        let account_txs = by_account.remove(&account.id).unwrap_or_default();
        let posted: f64 = account_txs.iter().map(|tx| tx.amount).sum();
        let currency = currency_of(Some(account.currency.as_str()), app_currency);
        currencies.push(currency);
        walks.push(AccountWalk {
            cash: account.balance - posted,
            holdings: HashMap::new(),
            ticker_currency: HashMap::new(),
            txs: account_txs,
            cursor: 0,
        });
    }

    let dates = each_date(start, end);
    let mut date_labels = Vec::with_capacity(dates.len());
    let mut totals = Vec::with_capacity(dates.len());
    let mut native_cols = vec![Vec::with_capacity(dates.len()); accounts.len()];
    let mut converted_cols = vec![Vec::with_capacity(dates.len()); accounts.len()];

    for date in &dates {
        let label = format_iso(*date);
        let mut total = 0.0;
        for (index, walk) in walks.iter_mut().enumerate() {
            walk.advance(&label);
            let (native, converted) = walk.value(book, &label, &currencies[index], app_currency);
            native_cols[index].push(native);
            converted_cols[index].push(converted);
            total += converted;
        }
        date_labels.push(label);
        totals.push(total);
    }

    let account_series = accounts
        .iter()
        .enumerate()
        .map(|(index, account)| DashboardAccountSeries {
            account_id: account.id,
            currency: currencies[index].clone(),
            native: native_cols[index].clone(),
            converted: converted_cols[index].clone(),
        })
        .collect();

    let bucket_keys = if bucket == "day" {
        date_labels.clone()
    } else {
        month_keys(start, end)
    };
    let key_index: HashMap<String, usize> = bucket_keys
        .iter()
        .enumerate()
        .map(|(index, key)| (key.clone(), index))
        .collect();
    let mut income = vec![0.0; bucket_keys.len()];
    let mut expenses = vec![0.0; bucket_keys.len()];
    let mut categories: BTreeMap<String, f64> = BTreeMap::new();
    let start_label = format_iso(start);
    let end_label = format_iso(end);
    let currency_by_account: HashMap<i32, &str> = accounts
        .iter()
        .enumerate()
        .map(|(index, account)| (account.id, currencies[index].as_str()))
        .collect();

    for tx in txs {
        if !counts_as_cash_flow(tx) {
            continue;
        }
        let account_currency = currency_by_account
            .get(&tx.account_id)
            .copied()
            .unwrap_or(app_currency);
        let rate = if account_currency == app_currency {
            1.0
        } else {
            book.rate(&format!("{account_currency}{app_currency}=X"), &tx.date)
        };
        let converted = tx.amount * rate;
        let key = if bucket == "day" {
            tx.date.clone()
        } else {
            tx.date.chars().take(7).collect()
        };
        if let Some(index) = key_index.get(&key) {
            if converted > 0.0 {
                income[*index] += converted;
            } else {
                expenses[*index] += converted.abs();
            }
        }
        if tx.amount < 0.0
            && tx.date.as_str() >= start_label.as_str()
            && tx.date.as_str() <= end_label.as_str()
        {
            let category = tx.category.clone().unwrap_or_default();
            *categories.entry(category).or_insert(0.0) += converted.abs();
        }
    }

    let mut category_totals: Vec<DashboardCategoryTotal> = categories
        .into_iter()
        .map(|(category, amount)| DashboardCategoryTotal { category, amount })
        .collect();
    category_totals.sort_by(|left, right| {
        right
            .amount
            .partial_cmp(&left.amount)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.category.cmp(&right.category))
    });

    DashboardChartSeries {
        dates: date_labels,
        totals,
        accounts: account_series,
        income_expense: bucket_keys
            .into_iter()
            .enumerate()
            .map(|(index, key)| DashboardIncomeExpenseBucket {
                key,
                income: income[index],
                expenses: expenses[index],
            })
            .collect(),
        categories: category_totals,
        tickers: tickers.iter().cloned().collect(),
        bucket: bucket.to_string(),
    }
}

fn like_literal(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn number_text(column: &str) -> String {
    format!(
        "CASE WHEN {column} IS NULL THEN '' \
         WHEN {column} = CAST({column} AS INTEGER) THEN CAST(CAST({column} AS INTEGER) AS TEXT) \
         ELSE CAST({column} AS TEXT) END"
    )
}

fn text_expr(field: &str) -> Result<&'static str, String> {
    match field {
        "account" => Ok("IFNULL(a.name, '')"),
        "category" => Ok("IFNULL(t.category, '')"),
        "payee" => Ok("IFNULL(t.payee, '')"),
        "notes" => Ok("IFNULL(t.notes, '')"),
        "currency" => Ok("IFNULL(t.currency, IFNULL(a.currency, ''))"),
        "ticker" => Ok("IFNULL(t.ticker, '')"),
        "tags" => Ok("''"),
        "date" => Ok("t.date"),
        other => Err(format!("unsupported dashboard filter field: {other}")),
    }
}

fn numeric_column(field: &str) -> Option<(&'static str, bool)> {
    match field {
        "amount" => Some(("t.amount", false)),
        "fee" => Some(("t.fee", true)),
        "shares" => Some(("t.shares", true)),
        "price" => Some(("t.price_per_share", true)),
        _ => None,
    }
}

fn push_text_filter(
    clauses: &mut Vec<String>,
    params: &mut Vec<SqlValue>,
    expr: &str,
    operator: &str,
    value: &str,
) -> Result<(), String> {
    match operator {
        "equals" => {
            clauses.push(format!("{expr} = ?"));
            params.push(SqlValue::Text(value.to_string()));
        }
        "not_equals" => {
            clauses.push(format!("{expr} != ?"));
            params.push(SqlValue::Text(value.to_string()));
        }
        "contains" => {
            clauses.push(format!("INSTR(LOWER({expr}), LOWER(?)) > 0"));
            params.push(SqlValue::Text(value.to_string()));
        }
        "not_contains" => {
            clauses.push(format!("INSTR(LOWER({expr}), LOWER(?)) = 0"));
            params.push(SqlValue::Text(value.to_string()));
        }
        "starts_with" => {
            clauses.push(format!("LOWER({expr}) LIKE ? ESCAPE '\\'"));
            params.push(SqlValue::Text(format!(
                "{}%",
                like_literal(&value.to_lowercase())
            )));
        }
        "ends_with" => {
            clauses.push(format!("LOWER({expr}) LIKE ? ESCAPE '\\'"));
            params.push(SqlValue::Text(format!(
                "%{}",
                like_literal(&value.to_lowercase())
            )));
        }
        "is_empty" => clauses.push(format!("{expr} = ''")),
        "is_not_empty" => clauses.push(format!("{expr} != ''")),
        "matches_regex" => {
            clauses.push(format!("hb_regex({expr}, ?) = 1"));
            params.push(SqlValue::Text(value.to_string()));
        }
        "not_matches_regex" => {
            clauses.push(format!(
                "IFNULL(hb_regex({expr}, ?), 0) = 0 AND hb_regex({expr}, ?) IS NOT NULL"
            ));
            params.push(SqlValue::Text(value.to_string()));
            params.push(SqlValue::Text(value.to_string()));
        }
        other => return Err(format!("unsupported dashboard filter operator: {other}")),
    }
    Ok(())
}

fn push_numeric_filter(
    clauses: &mut Vec<String>,
    params: &mut Vec<SqlValue>,
    column: &str,
    nullable: bool,
    operator: &str,
    value: &str,
) -> Result<(), String> {
    match operator {
        "equals" | "not_equals" => {
            let expr = number_text(column);
            let cmp = if operator == "equals" { "=" } else { "!=" };
            clauses.push(format!("{expr} {cmp} ?"));
            params.push(SqlValue::Text(value.to_string()));
        }
        "greater_than" | "less_than" => {
            let Ok(number) = value.trim().parse::<f64>() else {
                clauses.push("0".to_string());
                return Ok(());
            };
            let cmp = if operator == "greater_than" { ">" } else { "<" };
            if nullable {
                clauses.push(format!("{column} IS NOT NULL AND {column} {cmp} ?"));
            } else {
                clauses.push(format!("{column} {cmp} ?"));
            }
            params.push(SqlValue::Real(number));
        }
        "is_empty" => {
            if nullable {
                clauses.push(format!("{column} IS NULL"));
            } else {
                clauses.push("0".to_string());
            }
        }
        "is_not_empty" => {
            if nullable {
                clauses.push(format!("{column} IS NOT NULL"));
            } else {
                clauses.push("1".to_string());
            }
        }
        other => return Err(format!("unsupported dashboard filter operator: {other}")),
    }
    Ok(())
}

fn push_filter(
    clauses: &mut Vec<String>,
    params: &mut Vec<SqlValue>,
    filter: &DashboardTransactionFilter,
) -> Result<(), String> {
    let field = filter.field.trim();
    let operator = filter.operator.trim();
    if field == "date" && (operator == "greater_than" || operator == "less_than") {
        if filter.value.is_empty() {
            clauses.push("0".to_string());
            return Ok(());
        }
        let cmp = if operator == "greater_than" { ">" } else { "<" };
        clauses.push(format!("t.date {cmp} ?"));
        params.push(SqlValue::Text(filter.value.clone()));
        return Ok(());
    }
    if let Some((column, nullable)) = numeric_column(field) {
        return push_numeric_filter(clauses, params, column, nullable, operator, &filter.value);
    }
    let expr = text_expr(field)?;
    push_text_filter(clauses, params, expr, operator, &filter.value)
}

fn register_regex(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.create_scalar_function(
        "hb_regex",
        2,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| {
            let text: String = ctx.get(0).unwrap_or_default();
            let pattern: String = ctx.get(1).unwrap_or_default();
            match regex::RegexBuilder::new(&pattern)
                .case_insensitive(true)
                .build()
            {
                Ok(re) => Ok(Some(re.is_match(&text))),
                Err(_) => Ok(None::<bool>),
            }
        },
    )
    .map_err(|e| e.to_string())
}

/// Transactions matching the account ids and widget rule filters.
/// An empty account list matches nothing instead of scanning the table.
pub fn query_dashboard_transactions_db(
    db_path: &Path,
    account_ids: &[i32],
    filters: &[DashboardTransactionFilter],
) -> Result<Vec<Transaction>, String> {
    if account_ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut clauses = vec![format!(
        "t.account_id IN ({})",
        placeholders(account_ids.len())
    )];
    let mut params: Vec<SqlValue> = account_ids.iter().copied().map(SqlValue::Int).collect();
    for filter in filters {
        push_filter(&mut clauses, &mut params, filter)?;
    }
    let sql = format!(
        "SELECT t.id, t.account_id, t.date, t.payee, t.notes, t.category, t.amount, \
         t.ticker, t.shares, t.price_per_share, t.fee, t.currency \
         FROM transactions t JOIN accounts a ON a.id = t.account_id \
         WHERE {} ORDER BY t.date ASC, t.id ASC",
        clauses.join(" AND ")
    );

    crate::db_locked!(db_path, {
        let conn = crate::db_init::open_db(db_path)?;
        register_regex(&conn)?;
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let refs: Vec<&dyn ToSql> = params.iter().map(|value| value as &dyn ToSql).collect();
        let rows = stmt
            .query_map(rusqlite::params_from_iter(refs), |row| {
                Ok(Transaction {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    date: row.get(2)?,
                    payee: row.get(3)?,
                    notes: row.get(4)?,
                    category: row.get(5)?,
                    amount: row.get(6)?,
                    ticker: row.get(7)?,
                    shares: row.get(8)?,
                    price_per_share: row.get(9)?,
                    fee: row.get(10)?,
                    currency: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    })
}

/// Tauri command: series for the standard dashboard charts.
#[tauri::command]
pub fn get_dashboard_chart_series(
    app_handle: AppHandle,
    query: DashboardChartQuery,
) -> Result<DashboardChartSeries, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    dashboard_chart_series_db(&db_path, &query)
}

/// Tauri command: rows for widgets whose rule filters cannot be aggregated.
#[tauri::command]
pub fn query_dashboard_transactions(
    app_handle: AppHandle,
    account_ids: Vec<i32>,
    filters: Vec<DashboardTransactionFilter>,
) -> Result<Vec<Transaction>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    query_dashboard_transactions_db(&db_path, &account_ids, &filters)
}
