use crate::models::{Account, Transaction, YahooQuote};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Holding {
    pub ticker: String,
    pub shares: f64,
    pub cost_basis: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HoldingWithQuote {
    pub ticker: String,
    pub shares: f64,
    pub cost_basis: f64,
    pub price: f64,
    pub current_value: f64,
    pub roi: f64,
    pub change_percent: f64,
    pub quote_type: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioTotals {
    pub total_value: f64,
    pub total_cost_basis: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HoldingsResult {
    pub current_holdings: Vec<Holding>,
    pub first_trade_date: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeterministicProjectionInput {
    pub current_net_worth: f64,
    pub annual_savings: f64,
    pub annual_expenses: f64,
    pub expected_return: f64,
    pub inflation: f64,
    pub withdrawal_rate: f64,
    #[serde(default = "default_max_years")]
    pub max_years: i32,
}

fn default_max_years() -> i32 {
    50
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeterministicProjectionOutput {
    pub fire_number: f64,
    pub years_to_fire: Option<i32>,
    pub projection_data: Vec<f64>,
    pub never_reached: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MonteCarloInput {
    pub current_net_worth: f64,
    pub annual_savings: f64,
    pub annual_expenses: f64,
    pub expected_return: f64,
    pub inflation: f64,
    pub volatility: f64,
    pub current_age: i32,
    pub retirement_age: i32,
    pub retirement_duration: i32,
    #[serde(default = "default_sim_count")]
    pub simulation_count: i32,
}

fn default_sim_count() -> i32 {
    1000
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MonteCarloPercentiles {
    pub p10: Vec<f64>,
    pub p25: Vec<f64>,
    pub p50: Vec<f64>,
    pub p75: Vec<f64>,
    pub p90: Vec<f64>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MonteCarloOutput {
    pub success_rate: f64,
    pub percentiles: MonteCarloPercentiles,
    pub years_to_retirement: i32,
    pub total_years: i32,
    pub simulation_count: i32,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeRatePoint {
    pub date: String,
    pub price: f64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeRateSeries {
    pub map: HashMap<String, f64>,
    pub list: Vec<ExchangeRatePoint>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReportComputeInput {
    pub accounts: Vec<Account>,
    pub transactions: Vec<Transaction>,
    pub start_date: String,
    pub end_date: String,
    pub app_currency: String,
    pub exchange_rates: HashMap<String, ExchangeRateSeries>,
    pub quotes: Vec<YahooQuote>,
    pub labels: Value,
}

fn to_numeric(value: &Value) -> Option<f64> {
    match value {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    }
}

/// Computes total net worth by summing each account's balance plus its market value,
/// multiplied by the account's exchange rate, plus any tracked assets not tied to accounts.
#[must_use]
pub fn compute_net_worth_logic(
    accounts: &[Account],
    market_values: &HashMap<String, Value>,
    total_assets_value: Option<f64>,
) -> f64 {
    let accounts_total: f64 = accounts
        .iter()
        .map(|acc| {
            let balance = acc.balance;
            let market_value = market_values
                .get(&acc.id.to_string())
                .and_then(to_numeric)
                .unwrap_or(0.0);
            (balance + market_value) * acc.exchange_rate
        })
        .sum();

    let extra = total_assets_value
        .filter(|value| value.is_finite())
        .unwrap_or(0.0);
    accounts_total + extra
}

/// Extracts stock holdings from transactions, computing total shares and cost basis per ticker.
/// Transactions are processed chronologically; sells reduce shares using average cost basis.
#[must_use]
pub fn build_holdings_from_transactions_logic(transactions: &[Transaction]) -> HoldingsResult {
    let mut txs = transactions.to_vec();
    txs.sort_by(|a, b| a.date.cmp(&b.date));

    let mut first_trade_date: Option<String> = None;
    let mut holding_map: HashMap<String, Holding> = HashMap::new();

    for tx in txs {
        let ticker = match tx.ticker {
            Some(t) if !t.is_empty() => t,
            _ => continue,
        };
        let shares = match tx.shares {
            Some(s) if s != 0.0 => s,
            _ => continue,
        };

        if first_trade_date.is_none() {
            first_trade_date = Some(tx.date.clone());
        }

        let entry = holding_map.entry(ticker.clone()).or_insert(Holding {
            ticker,
            shares: 0.0,
            cost_basis: 0.0,
        });

        if shares > 0.0 {
            entry.shares += shares;
            entry.cost_basis += tx.price_per_share.unwrap_or(0.0) * shares + tx.fee.unwrap_or(0.0);
        } else {
            let avg_cost = if entry.shares > 0.0 {
                entry.cost_basis / entry.shares
            } else {
                0.0
            };
            let sold = shares.abs();
            entry.shares -= sold;
            entry.cost_basis -= sold * avg_cost;
        }
    }

    let current_holdings = holding_map
        .into_values()
        .filter(|h| h.shares > 0.0001)
        .collect::<Vec<_>>();

    HoldingsResult {
        current_holdings,
        first_trade_date,
    }
}

/// Merges holdings with stock quotes to compute current value and ROI for each holding.
/// Results are sorted by current value in descending order.
#[must_use]
pub fn merge_holdings_with_quotes_logic(
    holdings: &[Holding],
    quotes: &[YahooQuote],
) -> Vec<HoldingWithQuote> {
    let mut merged = holdings
        .iter()
        .map(|h| {
            let quote = quotes
                .iter()
                .find(|q| q.symbol.eq_ignore_ascii_case(&h.ticker));
            let price = quote.map_or(0.0, |q| q.price);
            let current_value = h.shares * price;
            let roi = if h.cost_basis > 0.0 {
                ((current_value - h.cost_basis) / h.cost_basis) * 100.0
            } else {
                0.0
            };

            HoldingWithQuote {
                ticker: h.ticker.clone(),
                shares: h.shares,
                cost_basis: h.cost_basis,
                price,
                current_value,
                roi,
                change_percent: quote.map_or(0.0, |q| q.change_percent),
                quote_type: quote.and_then(|q| q.quote_type.clone()),
            }
        })
        .collect::<Vec<_>>();

    merged.sort_by(|a, b| {
        b.current_value
            .partial_cmp(&a.current_value)
            .unwrap_or(Ordering::Equal)
    });
    merged
}

/// Calculates total portfolio value and total cost basis from enriched holdings.
#[must_use]
pub fn compute_portfolio_totals_logic(holdings: &[HoldingWithQuote]) -> PortfolioTotals {
    PortfolioTotals {
        total_value: holdings.iter().map(|h| h.current_value).sum(),
        total_cost_basis: holdings.iter().map(|h| h.cost_basis).sum(),
    }
}

/// Computes the market value of holdings per account from transactions and current quotes.
/// Returns a map of account ID to total market value.
#[must_use]
pub fn compute_net_worth_market_values_logic(
    transactions: &[Transaction],
    quotes: &[YahooQuote],
) -> HashMap<String, f64> {
    let mut account_holdings: HashMap<i32, HashMap<String, f64>> = HashMap::new();
    for tx in transactions {
        let ticker = match &tx.ticker {
            Some(t) if !t.is_empty() => t.clone(),
            _ => continue,
        };
        let shares = match tx.shares {
            Some(s) if s != 0.0 => s,
            _ => continue,
        };

        let by_account = account_holdings.entry(tx.account_id).or_default();
        *by_account.entry(ticker).or_insert(0.0) += shares;
    }

    let quote_map = quotes
        .iter()
        .map(|q| (q.symbol.to_uppercase(), q.price))
        .collect::<HashMap<_, _>>();

    let mut result = HashMap::new();
    for (account_id, holdings) in account_holdings {
        let mut total = 0.0;
        for (ticker, shares) in holdings {
            if shares > 0.0001 {
                let price = quote_map
                    .get(&ticker.to_uppercase())
                    .copied()
                    .unwrap_or(0.0);
                total += shares * price;
            }
        }
        result.insert(account_id.to_string(), total);
    }

    result
}

fn random_normal(mean: f64, std_dev: f64) -> f64 {
    let u1: f64 = rand::random::<f64>().max(f64::MIN_POSITIVE);
    let u2: f64 = rand::random::<f64>();
    let z0 = (-2.0_f64 * u1.ln()).sqrt() * (2.0_f64 * std::f64::consts::PI * u2).cos();
    z0 * std_dev + mean
}

/// Projects FIRE number and years to financial independence using deterministic real-return growth.
#[must_use]
pub fn calculate_deterministic_projection_logic(
    input: &DeterministicProjectionInput,
) -> DeterministicProjectionOutput {
    let real_withdrawal_rate =
        (1.0 + input.withdrawal_rate / 100.0) / (1.0 + input.inflation / 100.0) - 1.0;
    let fire_number = if real_withdrawal_rate <= 0.0 {
        f64::INFINITY
    } else {
        (input.annual_expenses / real_withdrawal_rate).round()
    };

    let real_return = (input.expected_return - input.inflation) / 100.0;
    let mut balance = input.current_net_worth;
    let mut projection_data = vec![balance];
    let mut years_to_fire = None;

    for year in 1..=input.max_years {
        balance = balance + balance * real_return + input.annual_savings;
        projection_data.push(balance);
        if years_to_fire.is_none() && balance >= fire_number {
            years_to_fire = Some(year);
        }
    }

    DeterministicProjectionOutput {
        fire_number,
        years_to_fire,
        never_reached: years_to_fire.is_none(),
        projection_data,
    }
}

/// Runs Monte Carlo simulations for retirement scenarios, returning percentile bands and success rate.
#[must_use]
pub fn run_monte_carlo_simulation_logic(input: &MonteCarloInput) -> MonteCarloOutput {
    let years_to_retirement = (input.retirement_age - input.current_age).max(0);
    let total_years = years_to_retirement + input.retirement_duration;
    let real_return = input.expected_return - input.inflation;

    let mut all_balances: Vec<Vec<f64>> = Vec::new();
    let mut success_count = 0;

    for _ in 0..input.simulation_count {
        let mut balances = vec![input.current_net_worth];
        let mut balance = input.current_net_worth;

        for _ in 1..=years_to_retirement {
            let year_return = random_normal(real_return, input.volatility) / 100.0;
            balance = balance * (1.0 + year_return) + input.annual_savings;
            balances.push(balance);
        }

        let mut retirement_expenses = input.annual_expenses;
        let mut success = true;

        for _ in 1..=input.retirement_duration {
            let year_return = random_normal(real_return, input.volatility) / 100.0;
            balance = balance * (1.0 + year_return) - retirement_expenses;
            retirement_expenses *= 1.0 + input.inflation / 100.0;
            balances.push(balance);

            if balance <= 0.0 {
                success = false;
                break;
            }
        }

        if success {
            success_count += 1;
            while balances.len() < (total_years + 1) as usize {
                balances.push(balance.max(0.0));
            }
        } else {
            while balances.len() < (total_years + 1) as usize {
                balances.push(0.0);
            }
        }

        all_balances.push(balances);
    }

    let mut p10 = Vec::new();
    let mut p25 = Vec::new();
    let mut p50 = Vec::new();
    let mut p75 = Vec::new();
    let mut p90 = Vec::new();

    for year in 0..=total_years as usize {
        let mut values = all_balances
            .iter()
            .map(|row| *row.get(year).unwrap_or(&0.0))
            .collect::<Vec<_>>();
        values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));

        let percentile = |arr: &[f64], p: f64| -> f64 {
            let idx = ((p / 100.0) * arr.len() as f64).floor() as usize;
            arr[idx.min(arr.len().saturating_sub(1))]
        };

        p10.push(percentile(&values, 10.0));
        p25.push(percentile(&values, 25.0));
        p50.push(percentile(&values, 50.0));
        p75.push(percentile(&values, 75.0));
        p90.push(percentile(&values, 90.0));
    }

    MonteCarloOutput {
        success_rate: (f64::from(success_count) / f64::from(input.simulation_count)) * 100.0,
        percentiles: MonteCarloPercentiles {
            p10,
            p25,
            p50,
            p75,
            p90,
        },
        years_to_retirement,
        total_years,
        simulation_count: input.simulation_count,
    }
}

fn get_rate(exchange_rates: &HashMap<String, ExchangeRateSeries>, pair: &str, date: &str) -> f64 {
    if let Some(data) = exchange_rates.get(pair) {
        if let Some(rate) = data.map.get(date) {
            return *rate;
        }
        let mut best = None;
        for p in &data.list {
            if p.date.as_str() <= date {
                best = Some(p.price);
            }
        }
        return best.unwrap_or(1.0);
    }
    1.0
}

/// Aggregates all financial data into a comprehensive report with income, expenses,
/// savings rate, portfolio summary, category breakdowns, and monthly trends.
#[must_use]
pub fn compute_report_data_logic(input: &ReportComputeInput) -> Value {
    let mut account_map = HashMap::new();
    for a in &input.accounts {
        account_map.insert(a.id, a.clone());
    }

    let filtered = input
        .transactions
        .iter()
        .filter(|t| t.date >= input.start_date && t.date <= input.end_date)
        .cloned()
        .collect::<Vec<_>>();

    let market_values = compute_net_worth_market_values_logic(&input.transactions, &input.quotes);
    let net_worth = compute_net_worth_logic(
        &input.accounts,
        &market_values
            .iter()
            .map(|(k, v)| (k.clone(), json!(v)))
            .collect(),
        None,
    );

    let to_app_currency = |amount: f64, account_id: i32, date: &str| -> f64 {
        let acc_currency = account_map
            .get(&account_id)
            .and_then(|a| a.currency.clone())
            .unwrap_or_else(|| input.app_currency.clone());
        if acc_currency == input.app_currency {
            amount
        } else {
            let pair = format!("{}{}=X", acc_currency, input.app_currency);
            amount * get_rate(&input.exchange_rates, &pair, date)
        }
    };

    let mut total_income = 0.0;
    let mut total_expenses = 0.0;
    for t in &filtered {
        if t.category.as_deref() == Some("Transfer") || t.ticker.is_some() {
            continue;
        }
        let converted = to_app_currency(t.amount, t.account_id, &t.date);
        if converted > 0.0 {
            total_income += converted;
        } else {
            total_expenses += converted.abs();
        }
    }

    let net_savings = total_income - total_expenses;
    let savings_rate = if total_income > 0.0 {
        (net_savings / total_income) * 100.0
    } else {
        0.0
    };

    let holdings = build_holdings_from_transactions_logic(&input.transactions);
    let final_holdings =
        merge_holdings_with_quotes_logic(&holdings.current_holdings, &input.quotes);
    let totals = compute_portfolio_totals_logic(&final_holdings);

    let portfolio = if final_holdings.is_empty() {
        Value::Null
    } else {
        let overall_roi = if totals.total_cost_basis > 0.0 {
            ((totals.total_value - totals.total_cost_basis) / totals.total_cost_basis) * 100.0
        } else {
            0.0
        };
        json!({
            "total_value": totals.total_value,
            "total_cost_basis": totals.total_cost_basis,
            "overall_roi": overall_roi,
            "holdings": final_holdings.iter().map(|h| json!({
                "ticker": h.ticker,
                "shares": h.shares,
                "price": h.price,
                "current_value": h.current_value,
                "cost_basis": h.cost_basis,
                "roi": h.roi
            })).collect::<Vec<_>>()
        })
    };

    let account_balances = input
        .accounts
        .iter()
        .map(|acc| {
            let market = market_values
                .get(&acc.id.to_string())
                .copied()
                .unwrap_or(0.0);
            let acc_currency = acc
                .currency
                .clone()
                .unwrap_or_else(|| input.app_currency.clone());
            json!({
                "name": acc.name,
                "currency": acc_currency,
                "currency_symbol": acc_currency,
                "cash_balance": acc.balance,
                "market_value": market,
                "total": acc.balance + market,
                "exchange_rate": acc.exchange_rate
            })
        })
        .filter(|v| {
            (v.get("cash_balance")
                .and_then(serde_json::Value::as_f64)
                .unwrap_or(0.0))
            .abs()
                > 0.0
                || (v
                    .get("market_value")
                    .and_then(serde_json::Value::as_f64)
                    .unwrap_or(0.0))
                .abs()
                    > 0.0
        })
        .collect::<Vec<_>>();

    let mut accounts_transactions = Vec::new();
    for acc in &input.accounts {
        let mut txs = filtered
            .iter()
            .filter(|t| t.account_id == acc.id)
            .cloned()
            .collect::<Vec<_>>();
        txs.sort_by(|a, b| a.date.cmp(&b.date));
        if txs.is_empty() {
            continue;
        }

        let acc_currency = acc
            .currency
            .clone()
            .unwrap_or_else(|| input.app_currency.clone());
        accounts_transactions.push(json!({
            "account_name": acc.name,
            "currency": acc_currency,
            "currency_symbol": acc_currency,
            "exchange_rate": acc.exchange_rate,
            "transactions": txs.iter().map(|t| json!({
                "date": t.date,
                "payee": t.payee,
                "category": t.category.clone().unwrap_or_default(),
                "amount": t.amount,
                "notes": t.notes.clone().unwrap_or_default(),
                "ticker": t.ticker.clone().unwrap_or_default(),
                "shares": t.shares.unwrap_or(0.0),
                "price_per_share": t.price_per_share.unwrap_or(0.0),
                "fee": t.fee.unwrap_or(0.0)
            })).collect::<Vec<_>>()
        }));
    }

    let mut monthly_map: HashMap<String, (f64, f64)> = HashMap::new();
    for t in &filtered {
        if t.category.as_deref() == Some("Transfer") || t.ticker.is_some() {
            continue;
        }
        let converted = to_app_currency(t.amount, t.account_id, &t.date);
        let key = t.date.chars().take(7).collect::<String>();
        let entry = monthly_map.entry(key).or_insert((0.0, 0.0));
        if converted > 0.0 {
            entry.0 += converted;
        } else {
            entry.1 += converted.abs();
        }
    }

    let mut monthly_income_expenses = monthly_map
        .into_iter()
        .map(|(k, (income, expenses))| json!({"label": k, "income": income, "expenses": expenses}))
        .collect::<Vec<_>>();
    monthly_income_expenses.sort_by(|a, b| {
        a.get("label")
            .and_then(|x| x.as_str())
            .cmp(&b.get("label").and_then(|x| x.as_str()))
    });

    let mut category_totals_expense: HashMap<String, f64> = HashMap::new();
    let mut category_totals_income: HashMap<String, f64> = HashMap::new();
    for t in &filtered {
        if t.category.as_deref() == Some("Transfer") || t.ticker.is_some() {
            continue;
        }
        let converted = to_app_currency(t.amount, t.account_id, &t.date);
        let cat = t
            .category
            .clone()
            .unwrap_or_else(|| "Uncategorized".to_string());
        if converted < 0.0 {
            *category_totals_expense.entry(cat).or_insert(0.0) += converted.abs();
        } else if converted > 0.0 {
            *category_totals_income.entry(cat).or_insert(0.0) += converted;
        }
    }

    let expense_total: f64 = category_totals_expense.values().sum();
    let income_total: f64 = category_totals_income.values().sum();

    let mut expense_categories = category_totals_expense
        .into_iter()
        .map(|(category, amount)| {
            json!({
                "category": category,
                "amount": amount,
                "percentage": if expense_total > 0.0 { (amount / expense_total) * 100.0 } else { 0.0 }
            })
        })
        .collect::<Vec<_>>();
    expense_categories.sort_by(|a, b| {
        b.get("amount")
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(0.0)
            .partial_cmp(
                &a.get("amount")
                    .and_then(serde_json::Value::as_f64)
                    .unwrap_or(0.0),
            )
            .unwrap_or(Ordering::Equal)
    });

    let mut income_categories = category_totals_income
        .into_iter()
        .map(|(category, amount)| {
            json!({
                "category": category,
                "amount": amount,
                "percentage": if income_total > 0.0 { (amount / income_total) * 100.0 } else { 0.0 }
            })
        })
        .collect::<Vec<_>>();
    income_categories.sort_by(|a, b| {
        b.get("amount")
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(0.0)
            .partial_cmp(
                &a.get("amount")
                    .and_then(serde_json::Value::as_f64)
                    .unwrap_or(0.0),
            )
            .unwrap_or(Ordering::Equal)
    });

    let net_worth_points = vec![
        json!({"label": input.start_date, "value": net_worth}),
        json!({"label": input.end_date, "value": net_worth}),
    ];

    let mut investment_categories: HashMap<String, f64> = HashMap::new();
    let mut expense_non_investment: HashMap<String, f64> = HashMap::new();
    let mut total_expense_abs = 0.0;
    let mut total_investments = 0.0;

    for t in &filtered {
        if t.category.as_deref() == Some("Transfer") {
            continue;
        }
        let converted = to_app_currency(t.amount, t.account_id, &t.date);
        if converted >= 0.0 {
            continue;
        }
        let cat = t
            .category
            .clone()
            .unwrap_or_else(|| "Uncategorized".to_string());
        let abs = converted.abs();
        total_expense_abs += abs;
        let lc = cat.to_lowercase();
        let is_invest = lc.contains("invest")
            || lc.contains("savings")
            || lc.contains("brokerage")
            || lc.contains("deposit");
        if is_invest {
            *investment_categories.entry(cat).or_insert(0.0) += abs;
            total_investments += abs;
        } else {
            *expense_non_investment.entry(cat).or_insert(0.0) += abs;
        }
    }

    let expense_categories_cf = expense_non_investment
        .into_iter()
        .map(|(category, amount)| json!({"category": category, "amount": amount, "percentage": if total_expense_abs > 0.0 { (amount / total_expense_abs) * 100.0 } else { 0.0 }}))
        .collect::<Vec<_>>();
    let invest_categories_cf = investment_categories
        .into_iter()
        .map(|(category, amount)| json!({"category": category, "amount": amount, "percentage": if total_expense_abs > 0.0 { (amount / total_expense_abs) * 100.0 } else { 0.0 }}))
        .collect::<Vec<_>>();

    json!({
        "date_range_start": input.start_date,
        "date_range_end": input.end_date,
        "currency_symbol": input.app_currency,
        "generation_date": chrono::Utc::now().date_naive().to_string(),
        "labels": input.labels,
        "summary": {
            "net_worth": net_worth,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_savings": net_savings,
            "savings_rate": savings_rate,
            "account_count": input.accounts.len()
        },
        "account_balances": account_balances,
        "net_worth_points": net_worth_points,
        "monthly_income_expenses": monthly_income_expenses,
        "expense_categories": expense_categories,
        "income_categories": income_categories,
        "cash_flow": {
            "total_income": total_income,
            "total_expenses": total_expense_abs - total_investments,
            "total_investments": total_investments,
            "surplus_or_deficit": total_income - total_expense_abs,
            "expense_categories": expense_categories_cf,
            "investment_categories": invest_categories_cf
        },
        "portfolio": portfolio,
        "accounts_transactions": accounts_transactions
    })
}

/// Tauri command: computes net worth.
#[tauri::command]
pub fn compute_net_worth(
    accounts: Vec<Account>,
    market_values: HashMap<String, Value>,
    total_assets_value: Option<f64>,
) -> Result<f64, String> {
    Ok(compute_net_worth_logic(
        &accounts,
        &market_values,
        total_assets_value,
    ))
}

/// Tauri command: builds holdings from transactions.
#[tauri::command]
pub fn build_holdings_from_transactions(
    transactions: Vec<Transaction>,
) -> Result<HoldingsResult, String> {
    Ok(build_holdings_from_transactions_logic(&transactions))
}

/// Tauri command: merges holdings with quotes.
#[tauri::command]
pub fn merge_holdings_with_quotes(
    holdings: Vec<Holding>,
    quotes: Vec<YahooQuote>,
) -> Result<Vec<HoldingWithQuote>, String> {
    Ok(merge_holdings_with_quotes_logic(&holdings, &quotes))
}

/// Tauri command: computes portfolio totals.
#[tauri::command]
pub fn compute_portfolio_totals(
    holdings: Vec<HoldingWithQuote>,
) -> Result<PortfolioTotals, String> {
    Ok(compute_portfolio_totals_logic(&holdings))
}

/// Tauri command: computes market values per account.
#[tauri::command]
pub fn compute_net_worth_market_values(
    transactions: Vec<Transaction>,
    quotes: Vec<YahooQuote>,
) -> Result<HashMap<String, f64>, String> {
    Ok(compute_net_worth_market_values_logic(
        &transactions,
        &quotes,
    ))
}

/// Tauri command: calculates deterministic FIRE projection.
#[tauri::command]
pub fn calculate_deterministic_projection(
    input: DeterministicProjectionInput,
) -> Result<DeterministicProjectionOutput, String> {
    Ok(calculate_deterministic_projection_logic(&input))
}

/// Tauri command: runs Monte Carlo retirement simulation.
#[tauri::command]
pub fn run_monte_carlo_simulation(input: MonteCarloInput) -> Result<MonteCarloOutput, String> {
    Ok(run_monte_carlo_simulation_logic(&input))
}

/// Tauri command: computes full financial report data.
#[tauri::command]
pub fn compute_report_data(input: ReportComputeInput) -> Result<Value, String> {
    Ok(compute_report_data_logic(&input))
}

/// Extracts unique ticker symbols from a slice of transactions.
#[must_use]
pub fn collect_tickers(transactions: &[Transaction]) -> Vec<String> {
    let mut set = HashSet::new();
    for tx in transactions {
        if let Some(ticker) = &tx.ticker {
            if !ticker.is_empty() {
                set.insert(ticker.clone());
            }
        }
    }
    set.into_iter().collect()
}
