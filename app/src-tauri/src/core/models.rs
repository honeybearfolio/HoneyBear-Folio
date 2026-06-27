use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooQuote {
    pub symbol: String,
    #[serde(rename = "regularMarketPrice")]
    pub price: f64,
    #[serde(rename = "regularMarketChangePercent")]
    pub change_percent: f64,
    pub currency: Option<String>,
    #[serde(rename = "quoteType")]
    pub quote_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooChartMeta {
    pub symbol: String,
    #[serde(rename = "regularMarketPrice")]
    pub regular_market_price: Option<f64>,
    #[serde(rename = "chartPreviousClose")]
    pub chart_previous_close: Option<f64>,
    #[serde(rename = "previousClose")]
    pub previous_close: Option<f64>,
    pub currency: Option<String>,
    #[serde(rename = "instrumentType")]
    pub instrument_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooChartQuote {
    pub close: Option<Vec<Option<f64>>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooChartIndicators {
    pub quote: Option<Vec<YahooChartQuote>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooChartResult {
    pub meta: YahooChartMeta,
    pub timestamp: Option<Vec<i64>>,
    pub indicators: Option<YahooChartIndicators>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooChartBody {
    pub result: Option<Vec<YahooChartResult>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooChartResponse {
    pub chart: YahooChartBody,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooSearchQuote {
    pub symbol: String,
    pub shortname: Option<String>,
    pub longname: Option<String>,
    pub exchange: Option<String>,
    #[serde(rename = "typeDisp")]
    pub type_disp: Option<String>,
    pub currency: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YahooSearchResponse {
    pub quotes: Vec<YahooSearchQuote>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Account {
    pub id: i32,
    pub name: String,
    pub balance: f64,
    pub currency: Option<String>,
    #[serde(default = "default_exchange_rate")]
    pub exchange_rate: f64,
}

/// Returns the default exchange rate value of `1.0`.
#[must_use]
pub fn default_exchange_rate() -> f64 {
    1.0
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Transaction {
    pub id: i32,
    pub account_id: i32,
    pub date: String,
    pub payee: String,
    pub notes: Option<String>,
    pub category: Option<String>,
    pub amount: f64,
    pub ticker: Option<String>,
    pub shares: Option<f64>,
    pub price_per_share: Option<f64>,
    pub fee: Option<f64>,
    pub currency: Option<String>,
}

/// A single condition within a rule
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct RuleCondition {
    pub field: String,
    pub operator: String, // equals, contains, starts_with, ends_with, greater_than, less_than, matches_regex, not_matches_regex
    pub value: String,
    #[serde(default)]
    pub negated: bool, // NOT operator
}

/// A single action within a rule
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct RuleAction {
    pub field: String,
    pub value: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Rule {
    pub id: i32,
    pub priority: i32,
    // Legacy fields (kept for backward compatibility during migration)
    pub match_field: String,
    pub match_pattern: String,
    pub action_field: String,
    pub action_value: String,
    // New fields for compound conditions and multiple actions
    #[serde(default)]
    pub logic: String, // "and" or "or" - how conditions are combined
    #[serde(default)]
    pub conditions: Vec<RuleCondition>,
    #[serde(default)]
    pub actions: Vec<RuleAction>,
}

#[derive(Debug)]
pub struct AccountsSummary {
    pub accounts: Vec<Account>,
    pub raw_data: Vec<(i32, String, f64)>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct AppSettings {
    pub db_path: Option<String>,
    #[serde(default)]
    pub recent_dbs: Vec<RecentDb>,
    #[serde(default)]
    pub ollama_url: Option<String>,
    #[serde(default)]
    pub ollama_model: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RecentDb {
    pub path: String,
    pub name: String,
    pub last_opened: String,
    #[serde(default)]
    pub file_exists: bool,
    #[serde(default)]
    pub file_size: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DailyPrice {
    pub date: String,
    pub price: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ScheduledTransaction {
    pub id: i32,
    pub account_id: i32,
    pub payee: String,
    pub amount: f64,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub currency: Option<String>,
    pub recurrence_type: String, // "every_n", "day_of_week", "ordinal_weekday"
    pub interval_value: Option<i32>, // e.g. 2 (for "every 2 weeks")
    pub interval_unit: Option<String>, // "day", "week", "month", "year"
    pub days_of_week: Option<Vec<u32>>, // e.g. [1,3] for Mon/Wed (0=Sun..6=Sat)
    pub ordinal: Option<i32>,    // 1-5 or -1 for last
    pub weekday: Option<u32>,    // 0=Sun..6=Sat
    pub start_date: String,      // "YYYY-MM-DD"
    pub end_date: Option<String>,
    pub max_occurrences: Option<i32>,
    pub occurrences_count: i32,
    pub last_applied_date: Option<String>,
    pub enabled: bool,
    pub transaction_type: String, // "regular" or "investment"
    pub ticker: Option<String>,
    pub shares: Option<f64>,
    pub price_per_share: Option<f64>,
    pub fee: Option<f64>,
    pub is_buy: Option<bool>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ScheduledOccurrence {
    pub scheduled_tx_id: i32,
    pub date: String,
    pub status: String, // "upcoming" or "missed"
    pub account_id: i32,
    pub payee: String,
    pub amount: f64,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub currency: Option<String>,
    pub account_name: Option<String>,
    pub transaction_type: String,
    pub ticker: Option<String>,
    pub shares: Option<f64>,
    pub price_per_share: Option<f64>,
    pub fee: Option<f64>,
    pub is_buy: Option<bool>,
}

// ── Asset tracking data structures ───────────────────────────────────

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Asset {
    pub id: i32,
    pub name: String,
    pub category: String,
    pub currency: Option<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AssetValuation {
    pub id: i32,
    pub asset_id: i32,
    pub date: String,
    pub value: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AssetWithLatestValue {
    pub id: i32,
    pub name: String,
    pub category: String,
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub latest_value: Option<f64>,
    pub latest_date: Option<String>,
    #[serde(default = "default_exchange_rate")]
    pub exchange_rate: f64,
}

// ── PDF Report data structures ──────────────────────────────────────

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportSummary {
    pub net_worth: f64,
    pub total_income: f64,
    pub total_expenses: f64,
    pub net_savings: f64,
    pub savings_rate: f64,
    pub account_count: usize,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportAccountBalance {
    pub name: String,
    pub currency: String,
    pub currency_symbol: String,
    pub cash_balance: f64,
    pub market_value: f64,
    pub total: f64,
    #[serde(default = "default_exchange_rate")]
    pub exchange_rate: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportDataPoint {
    pub label: String,
    pub value: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportMonthlyData {
    pub label: String,
    pub income: f64,
    pub expenses: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportCategoryAmount {
    pub category: String,
    pub amount: f64,
    pub percentage: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportCashFlow {
    pub total_income: f64,
    pub total_expenses: f64,
    pub total_investments: f64,
    pub surplus_or_deficit: f64,
    pub expense_categories: Vec<ReportCategoryAmount>,
    pub investment_categories: Vec<ReportCategoryAmount>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportHolding {
    pub ticker: String,
    pub shares: f64,
    pub price: f64,
    pub current_value: f64,
    pub cost_basis: f64,
    pub roi: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportPortfolio {
    pub total_value: f64,
    pub total_cost_basis: f64,
    pub overall_roi: f64,
    pub holdings: Vec<ReportHolding>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportTransaction {
    pub date: String,
    pub payee: String,
    pub category: String,
    pub amount: f64,
    pub notes: String,
    pub ticker: String,
    pub shares: f64,
    pub price_per_share: f64,
    pub fee: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportAccountTransactions {
    pub account_name: String,
    pub currency: String,
    pub currency_symbol: String,
    #[serde(default = "default_exchange_rate")]
    pub exchange_rate: f64,
    pub transactions: Vec<ReportTransaction>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportLabels {
    pub title: String,
    pub financial_summary: String,
    pub net_worth_evolution: String,
    pub income_vs_expenses: String,
    pub expense_breakdown: String,
    pub income_breakdown: String,
    pub cash_flow_summary: String,
    pub investment_holdings: String,
    pub transactions_title: String,
    pub net_worth: String,
    pub total_income: String,
    pub total_expenses: String,
    pub net_savings: String,
    pub savings_rate: String,
    pub accounts: String,
    pub account: String,
    pub currency: String,
    pub cash_balance: String,
    pub market_value: String,
    pub total: String,
    pub category: String,
    pub amount: String,
    pub percentage: String,
    pub month: String,
    pub income: String,
    pub expenses: String,
    pub net: String,
    pub investments: String,
    pub surplus: String,
    pub deficit: String,
    pub ticker: String,
    pub shares: String,
    pub price: String,
    pub value: String,
    pub cost_basis: String,
    pub roi: String,
    pub date: String,
    pub payee: String,
    pub notes: String,
    pub fee: String,
    pub page: String,
    pub no_transactions: String,
    pub portfolio_total: String,
    pub overall_roi: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ReportData {
    pub date_range_start: String,
    pub date_range_end: String,
    pub currency_symbol: String,
    pub generation_date: String,
    pub labels: ReportLabels,
    pub summary: ReportSummary,
    pub account_balances: Vec<ReportAccountBalance>,
    pub net_worth_points: Vec<ReportDataPoint>,
    pub monthly_income_expenses: Vec<ReportMonthlyData>,
    pub expense_categories: Vec<ReportCategoryAmount>,
    pub income_categories: Vec<ReportCategoryAmount>,
    pub cash_flow: ReportCashFlow,
    pub portfolio: Option<ReportPortfolio>,
    pub accounts_transactions: Vec<ReportAccountTransactions>,
}
