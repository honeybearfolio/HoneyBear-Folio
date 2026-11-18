use crate::models::Transaction;
use rusqlite::{params, types::ToSql, Connection, OptionalExtension};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransactionArgs {
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

/// Adds `delta` to the per-currency total for `account_id`.
///
/// Runs on the caller's connection so it commits with the ledger write. `None`
/// is the bucket for a NULL transaction currency, stored as `''`.
pub(crate) fn adjust_account_currency_total(
    conn: &Connection,
    account_id: i32,
    currency: Option<&str>,
    delta: f64,
) -> Result<(), String> {
    let key = currency.unwrap_or("");
    conn.execute(
        "INSERT INTO account_currency_totals (account_id, currency, total)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(account_id, currency) DO UPDATE SET total = total + excluded.total",
        params![account_id, key, delta],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Moves a ledger amount between account/currency buckets.
fn apply_account_currency_total_change(
    conn: &Connection,
    old_account_id: i32,
    old_currency: Option<&str>,
    old_amount: f64,
    new_account_id: i32,
    new_currency: Option<&str>,
    new_amount: f64,
) -> Result<(), String> {
    let same_bucket = old_account_id == new_account_id
        && old_currency.unwrap_or("") == new_currency.unwrap_or("");
    if same_bucket {
        adjust_account_currency_total(conn, new_account_id, new_currency, new_amount - old_amount)
    } else {
        adjust_account_currency_total(conn, old_account_id, old_currency, -old_amount)?;
        adjust_account_currency_total(conn, new_account_id, new_currency, new_amount)
    }
}

/// Creates a transaction, applying rules and auto-detecting transfers between accounts.
/// If the payee matches another account name, a linked counter-transaction is created.
pub fn create_transaction_db(
    db_path: &PathBuf,
    args: CreateTransactionArgs,
) -> Result<Transaction, String> {
    crate::db_locked!(db_path, {
        let mut conn = crate::db_init::open_db(db_path)?;

        // Apply rules before starting transaction
        let rules = crate::rules::get_rules_db(db_path).unwrap_or_default();
        let mut temp_tx = Transaction {
            id: 0,
            account_id: args.account_id,
            date: args.date.clone(),
            payee: args.payee.clone(),
            notes: args.notes.clone(),
            category: args.category.clone(),
            amount: args.amount,
            ticker: args.ticker.clone(),
            shares: args.shares,
            price_per_share: args.price_per_share,
            fee: args.fee,
            currency: args.currency.clone(),
        };
        crate::rules::apply_rules_to_transaction(&mut temp_tx, &rules);

        let final_payee = temp_tx.payee;
        let final_notes = temp_tx.notes;
        let final_category_from_rules = temp_tx.category;

        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Check if payee matches another account for Transfer detection
        let target_account_info: Option<i32> = tx
            .query_row(
                "SELECT id FROM accounts WHERE name = ?1 AND id != ?2",
                params![final_payee, args.account_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let final_category = if target_account_info.is_some() {
            Some("Transfer".to_string())
        } else {
            final_category_from_rules
        };

        tx.execute(
        "INSERT INTO transactions (account_id, date, payee, notes, category, amount, ticker, shares, price_per_share, fee, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![args.account_id, args.date, final_payee, final_notes, final_category, args.amount, args.ticker, args.shares, args.price_per_share, args.fee, args.currency],
    ).map_err(|e| e.to_string())?;

        let id = tx.last_insert_rowid() as i32;

        tx.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![args.amount, args.account_id],
        )
        .map_err(|e| e.to_string())?;

        adjust_account_currency_total(&tx, args.account_id, args.currency.as_deref(), args.amount)?;

        if let Some(target_id) = target_account_info {
            // Get source account name for the target transaction's payee
            let source_name: String = tx
                .query_row(
                    "SELECT name FROM accounts WHERE id = ?1",
                    params![args.account_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;

            // Insert target transaction
            tx.execute(
            "INSERT INTO transactions (account_id, date, payee, notes, category, amount) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![target_id, args.date, source_name, args.notes, "Transfer", -args.amount],
        ).map_err(|e| e.to_string())?;

            // Capture inserted target transaction id and link both transactions for future sync
            let target_tx_id = tx.last_insert_rowid() as i32;
            tx.execute(
                "UPDATE transactions SET linked_tx_id = ?1 WHERE id = ?2",
                params![target_tx_id, id],
            )
            .map_err(|e| e.to_string())?;
            tx.execute(
                "UPDATE transactions SET linked_tx_id = ?1 WHERE id = ?2",
                params![id, target_tx_id],
            )
            .map_err(|e| e.to_string())?;

            // Update target account balance
            tx.execute(
                "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
                params![-args.amount, target_id],
            )
            .map_err(|e| e.to_string())?;

            // The counterpart row omits currency, so it stays in the NULL bucket.
            adjust_account_currency_total(&tx, target_id, None, -args.amount)?;
        }

        tx.commit().map_err(|e| e.to_string())?;

        Ok(Transaction {
            id,
            account_id: args.account_id,
            date: args.date,
            payee: final_payee,
            notes: final_notes,
            category: final_category,
            amount: args.amount,
            ticker: args.ticker,
            shares: args.shares,
            price_per_share: args.price_per_share,
            fee: args.fee,
            currency: args.currency,
        })
    })
}

/// One keyset page of the register, or the full match when `limit` is omitted.
///
/// The cursor is the last row's `(date, id)`. When the sort column is not
/// `date`, `cursor_sort` carries that column's value so the next page can
/// continue `ORDER BY <column>, id` without rereading earlier rows.
#[derive(Debug, Clone, Default)]
pub struct TransactionListQuery {
    pub account_id: Option<i32>,
    /// Skip transactions on archived accounts (`get_all_transactions`).
    pub exclude_archived: bool,
    pub search: Option<String>,
    /// Exact category match. The search text still matches category as a substring.
    pub category: Option<String>,
    pub limit: Option<i64>,
    pub cursor_date: Option<String>,
    pub cursor_id: Option<i32>,
    pub cursor_sort: Option<String>,
    pub sort_key: Option<String>,
    pub sort_dir: Option<String>,
}

/// Retrieves all transactions for a specific account, ordered by date descending.
pub fn get_transactions_db(db_path: &Path, account_id: i32) -> Result<Vec<Transaction>, String> {
    query_transactions_db(
        db_path,
        &TransactionListQuery {
            account_id: Some(account_id),
            ..TransactionListQuery::default()
        },
    )
}

/// Returns transactions of all active accounts, ordered by date descending; transactions of archived accounts are skipped.
pub fn get_all_transactions_db(db_path: &Path) -> Result<Vec<Transaction>, String> {
    query_transactions_db(
        db_path,
        &TransactionListQuery {
            exclude_archived: true,
            ..TransactionListQuery::default()
        },
    )
}

pub fn query_transactions_db(
    db_path: &Path,
    query: &TransactionListQuery,
) -> Result<Vec<Transaction>, String> {
    let built = build_transaction_list_sql(query)?;
    crate::db_locked!(db_path, {
        let conn = crate::db_init::open_db(db_path)?;
        let mut stmt = conn.prepare(&built.sql).map_err(|e| e.to_string())?;
        let refs: Vec<&dyn ToSql> = built.params.iter().map(|p| p as &dyn ToSql).collect();
        let transaction_iter = stmt
            .query_map(rusqlite::params_from_iter(refs), read_transaction)
            .map_err(|e| e.to_string())?;

        let mut transactions = Vec::new();
        for transaction in transaction_iter {
            transactions.push(transaction.map_err(|e| e.to_string())?);
        }
        Ok(transactions)
    })
}

struct TransactionListSql {
    sql: String,
    params: Vec<SqlParam>,
}

enum SqlParam {
    Int(i32),
    Big(i64),
    Real(f64),
    Text(String),
}

impl ToSql for SqlParam {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        match self {
            Self::Int(value) => value.to_sql(),
            Self::Big(value) => value.to_sql(),
            Self::Real(value) => value.to_sql(),
            Self::Text(value) => value.to_sql(),
        }
    }
}

#[derive(Clone, Copy)]
enum SortColumn {
    Date,
    Payee,
    Category,
    Notes,
    Amount,
    Shares,
    PricePerShare,
    Fee,
    Ticker,
    AccountName,
}

#[derive(Clone, Copy)]
enum SortDirection {
    Asc,
    Desc,
}

impl SortColumn {
    fn parse(key: Option<&str>) -> Result<Self, String> {
        match nonempty(key) {
            None | Some("date") => Ok(Self::Date),
            Some("payee") => Ok(Self::Payee),
            Some("category") => Ok(Self::Category),
            Some("notes") => Ok(Self::Notes),
            Some("amount") => Ok(Self::Amount),
            Some("shares") => Ok(Self::Shares),
            Some("price_per_share") => Ok(Self::PricePerShare),
            Some("fee") => Ok(Self::Fee),
            Some("ticker") => Ok(Self::Ticker),
            Some("account_name") => Ok(Self::AccountName),
            Some(other) => Err(format!("unsupported transaction sort column: {other}")),
        }
    }

    /// Expression placed in `ORDER BY` and on the left side of the keyset comparison.
    fn order_expr(self) -> &'static str {
        match self {
            Self::Date => "t.date",
            Self::Payee => "LOWER(t.payee)",
            Self::Category => "LOWER(IFNULL(t.category, ''))",
            Self::Notes => "LOWER(IFNULL(t.notes, ''))",
            Self::Amount => "IFNULL(t.amount, 0)",
            Self::Shares => "IFNULL(t.shares, 0)",
            Self::PricePerShare => "IFNULL(t.price_per_share, 0)",
            Self::Fee => "IFNULL(t.fee, 0)",
            Self::Ticker => "LOWER(IFNULL(t.ticker, ''))",
            Self::AccountName => "LOWER(IFNULL(a.name, ''))",
        }
    }

    /// How the bound cursor value is written. Text is lowercased so it matches `order_expr`.
    fn cursor_expr(self) -> &'static str {
        match self {
            Self::Payee | Self::Category | Self::Notes | Self::Ticker | Self::AccountName => {
                "LOWER(?)"
            }
            _ => "?",
        }
    }

    fn numeric(self) -> bool {
        matches!(
            self,
            Self::Amount | Self::Shares | Self::PricePerShare | Self::Fee
        )
    }

    fn needs_account(self) -> bool {
        matches!(self, Self::AccountName)
    }
}

fn nonempty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|text| !text.is_empty())
}

fn parse_sort(query: &TransactionListQuery) -> Result<(SortColumn, SortDirection), String> {
    let column = SortColumn::parse(query.sort_key.as_deref())?;
    let direction = match nonempty(query.sort_dir.as_deref()) {
        None => {
            if nonempty(query.sort_key.as_deref()).is_none() {
                // Register default: newest row first, highest id on a shared date.
                SortDirection::Desc
            } else {
                SortDirection::Asc
            }
        }
        Some("ascending" | "asc") => SortDirection::Asc,
        Some("descending" | "desc") => SortDirection::Desc,
        Some(other) => {
            return Err(format!("unsupported transaction sort direction: {other}"));
        }
    };
    Ok((column, direction))
}

fn build_transaction_list_sql(query: &TransactionListQuery) -> Result<TransactionListSql, String> {
    let (column, direction) = parse_sort(query)?;
    let mut params: Vec<SqlParam> = Vec::new();
    let mut clauses: Vec<String> = Vec::new();

    if query.exclude_archived {
        clauses
            .push("t.account_id NOT IN (SELECT id FROM accounts WHERE archived = 1)".to_string());
    }
    if let Some(account_id) = query.account_id {
        clauses.push("t.account_id = ?".to_string());
        params.push(SqlParam::Int(account_id));
    }
    if let Some(category) = nonempty(query.category.as_deref()) {
        clauses.push("t.category = ?".to_string());
        params.push(SqlParam::Text(category.to_string()));
    }
    if let Some(search) = nonempty(query.search.as_deref()) {
        // Same fields the register searched in memory: date, payee, category, notes, amount.
        clauses.push(
            "(INSTR(LOWER(t.date), LOWER(?)) > 0 \
              OR INSTR(LOWER(t.payee), LOWER(?)) > 0 \
              OR INSTR(LOWER(IFNULL(t.category, '')), LOWER(?)) > 0 \
              OR INSTR(LOWER(IFNULL(t.notes, '')), LOWER(?)) > 0 \
              OR INSTR(CASE WHEN t.amount = CAST(t.amount AS INTEGER) \
                            THEN CAST(CAST(t.amount AS INTEGER) AS TEXT) \
                            ELSE CAST(t.amount AS TEXT) END, ?) > 0)"
                .to_string(),
        );
        for _ in 0..5 {
            params.push(SqlParam::Text(search.to_string()));
        }
    }
    if query.cursor_date.is_some() || query.cursor_id.is_some() || query.cursor_sort.is_some() {
        let cursor_date = nonempty(query.cursor_date.as_deref())
            .ok_or_else(|| "transaction page cursor requires date and id".to_string())?;
        let cursor_id = query
            .cursor_id
            .ok_or_else(|| "transaction page cursor requires date and id".to_string())?;
        let cmp = match direction {
            SortDirection::Asc => ">",
            SortDirection::Desc => "<",
        };
        let order_expr = column.order_expr();
        let cursor_expr = column.cursor_expr();
        clauses.push(format!(
            "({order_expr} {cmp} {cursor_expr} OR ({order_expr} = {cursor_expr} AND t.id {cmp} ?))"
        ));
        match column {
            SortColumn::Date => {
                params.push(SqlParam::Text(cursor_date.to_string()));
                params.push(SqlParam::Text(cursor_date.to_string()));
            }
            _ if column.numeric() => {
                let raw = query
                    .cursor_sort
                    .as_deref()
                    .ok_or_else(|| "transaction page cursor requires the sort value".to_string())?;
                let value = raw
                    .parse::<f64>()
                    .map_err(|_| format!("invalid numeric transaction cursor: {raw}"))?;
                params.push(SqlParam::Real(value));
                params.push(SqlParam::Real(value));
            }
            _ => {
                let raw = query
                    .cursor_sort
                    .as_deref()
                    .ok_or_else(|| "transaction page cursor requires the sort value".to_string())?;
                params.push(SqlParam::Text(raw.to_string()));
                params.push(SqlParam::Text(raw.to_string()));
            }
        }
        params.push(SqlParam::Int(cursor_id));
    }

    let mut limit_sql = String::new();
    if let Some(limit) = query.limit {
        if limit <= 0 {
            return Err("transaction page limit must be positive".to_string());
        }
        limit_sql = " LIMIT ?".to_string();
        params.push(SqlParam::Big(limit));
    }

    let join = if column.needs_account() {
        " LEFT JOIN accounts a ON a.id = t.account_id"
    } else {
        ""
    };
    let where_sql = if clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", clauses.join(" AND "))
    };
    let dir = match direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    };
    let expr = column.order_expr();
    let sql = format!(
        "SELECT t.id, t.account_id, t.date, t.payee, t.notes, t.category, t.amount, \
         t.ticker, t.shares, t.price_per_share, t.fee, t.currency \
         FROM transactions t{join}{where_sql} ORDER BY {expr} {dir}, t.id {dir}{limit_sql}"
    );
    Ok(TransactionListSql { sql, params })
}

fn read_transaction(row: &rusqlite::Row<'_>) -> rusqlite::Result<Transaction> {
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
}

/// Net shares per account and ticker.
///
/// Rows without a ticker are ignored. Transactions on archived accounts are
/// omitted, matching `get_all_transactions_db`, so sidebar and goal market
/// values stay limited to active accounts.
pub fn get_account_holdings_db(
    db_path: &Path,
) -> Result<HashMap<String, HashMap<String, f64>>, String> {
    crate::db_locked!(db_path, {
        let conn = crate::db_init::open_db(db_path)?;

        let mut stmt = conn
            .prepare(
                "SELECT account_id, ticker, SUM(shares) FROM transactions WHERE ticker IS NOT NULL AND account_id NOT IN (SELECT id FROM accounts WHERE archived = 1) GROUP BY account_id, ticker",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, i32>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<f64>>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut holdings: HashMap<String, HashMap<String, f64>> = HashMap::new();
        for row in rows {
            let (account_id, ticker, shares) = row.map_err(|e| e.to_string())?;
            let Some(shares) = shares else {
                continue;
            };
            holdings
                .entry(account_id.to_string())
                .or_default()
                .insert(ticker, shares);
        }

        Ok(holdings)
    })
}

// Payees and categories helpers moved from `lib.rs` here
/// Returns a sorted list of distinct payee names from all transactions.
pub fn get_payees_db(db_path: &Path) -> Result<Vec<String>, String> {
    crate::db_locked!(db_path, {
        let conn = crate::db_init::open_db(db_path)?;

        let mut stmt = conn
            .prepare("SELECT DISTINCT payee FROM transactions ORDER BY payee")
            .map_err(|e| e.to_string())?;
        let payee_iter = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        let mut payees = Vec::new();
        for payee in payee_iter {
            payees.push(payee.map_err(|e| e.to_string())?);
        }

        Ok(payees)
    })
}

/// Returns a sorted list of distinct category names, excluding "Transfer".
pub fn get_categories_db(db_path: &Path) -> Result<Vec<String>, String> {
    crate::db_locked!(db_path, {
        let conn = crate::db_init::open_db(db_path)?;

        let mut stmt = conn.prepare("SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL AND category != 'Transfer' ORDER BY category").map_err(|e| e.to_string())?;
        let cat_iter = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        let mut categories = Vec::new();
        for cat in cat_iter {
            categories.push(cat.map_err(|e| e.to_string())?);
        }

        Ok(categories)
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvestmentTransactionArgs {
    pub account_id: i32,
    pub date: String,
    pub ticker: String,
    pub shares: f64,
    pub price_per_share: f64,
    pub fee: f64,
    pub is_buy: bool,
    pub currency: Option<String>,
    pub payee: Option<String>,
    pub notes: Option<String>,
    pub category: Option<String>,
}

/// Creates an investment transaction (buy/sell), applying rules and updating account balance.
pub fn create_investment_transaction_db(
    db_path: &PathBuf,
    args: CreateInvestmentTransactionArgs,
) -> Result<Transaction, String> {
    crate::db_locked!(db_path, {
        let CreateInvestmentTransactionArgs {
            account_id,
            date,
            ticker,
            shares,
            price_per_share,
            fee,
            is_buy,
            currency,
            payee,
            notes,
            category,
        } = args;

        let mut conn = crate::db_init::open_db(db_path)?;

        // Apply rules
        let rules = crate::rules::get_rules_db(db_path).unwrap_or_default();
        let is_buy_local = is_buy; // avoid move issues
        let mut temp_tx = Transaction {
            id: 0,
            account_id,
            date: date.clone(),
            payee: payee.unwrap_or_else(|| {
                if is_buy_local {
                    "Buy".to_string()
                } else {
                    "Sell".to_string()
                }
            }),
            notes: notes.or_else(|| {
                Some(format!(
                    "{} {} shares of {}",
                    if is_buy_local { "Bought" } else { "Sold" },
                    shares,
                    ticker
                ))
            }),
            category: category.or_else(|| Some("Investment".to_string())),
            amount: if is_buy_local {
                -(shares * price_per_share + fee)
            } else {
                shares * price_per_share - fee
            },
            ticker: Some(ticker.clone()),
            shares: Some(if is_buy_local { shares } else { -shares }),
            price_per_share: Some(price_per_share),
            fee: Some(fee),
            currency: currency.clone(),
        };
        crate::rules::apply_rules_to_transaction(&mut temp_tx, &rules);

        let final_payee = temp_tx.payee;
        let final_notes = temp_tx.notes;
        let final_category = temp_tx.category;

        let tx = conn.transaction().map_err(|e| e.to_string())?;

        let total_price = shares * price_per_share;
        let amount = if is_buy {
            -(total_price + fee)
        } else {
            total_price - fee
        };

        let investment_shares = if is_buy { shares } else { -shares };

        tx.execute(
        "INSERT INTO transactions (account_id, date, payee, notes, category, amount, ticker, shares, price_per_share, fee, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            account_id,
            date,
            final_payee,
            final_notes,
            final_category,
            amount,
            ticker,
            investment_shares,
            price_per_share,
            fee,
            currency
        ],
    ).map_err(|e| e.to_string())?;

        let id = tx.last_insert_rowid() as i32;

        tx.execute(
            "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
            params![amount, account_id],
        )
        .map_err(|e| e.to_string())?;

        adjust_account_currency_total(&tx, account_id, currency.as_deref(), amount)?;

        tx.commit().map_err(|e| e.to_string())?;

        Ok(Transaction {
            id,
            account_id,
            date,
            payee: final_payee,
            notes: final_notes,
            category: final_category,
            amount,
            ticker: Some(ticker),
            shares: Some(investment_shares),
            price_per_share: Some(price_per_share),
            fee: Some(fee),
            currency,
        })
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTransactionArgs {
    pub id: i32,
    pub account_id: i32,
    pub date: String,
    pub payee: String,
    pub notes: Option<String>,
    pub category: Option<String>,
    pub amount: f64,
    pub currency: Option<String>,
}

/// Updates an existing transaction and adjusts account balances accordingly.
/// Also syncs any linked transfer counter-transaction.
pub fn update_transaction_db(
    db_path: &Path,
    args: UpdateTransactionArgs,
) -> Result<Transaction, String> {
    crate::db_locked!(db_path, {
        let UpdateTransactionArgs {
            id,
            account_id,
            date,
            payee,
            notes,
            category,
            amount,
            currency,
        } = args;

        let mut conn = crate::db_init::open_db(db_path)?;

        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Get old amount, account, and currency before the row changes.
        let (old_amount, old_account_id, old_currency): (f64, i32, Option<String>) = tx
            .query_row(
                "SELECT amount, account_id, currency FROM transactions WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| e.to_string())?;

        // Update transaction including account_id to support moving between accounts
        tx.execute(
        "UPDATE transactions SET account_id = ?1, date = ?2, payee = ?3, notes = ?4, category = ?5, amount = ?6, currency = ?7 WHERE id = ?8",
        params![account_id, date, payee, notes, category, amount, currency, id],
    ).map_err(|e| e.to_string())?;

        if old_account_id == account_id {
            let diff = amount - old_amount;
            if diff.abs() > f64::EPSILON {
                tx.execute(
                    "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
                    params![diff, account_id],
                )
                .map_err(|e| e.to_string())?;
            }
        } else {
            // Moving transaction between accounts: revert old account and apply to new account
            tx.execute(
                "UPDATE accounts SET balance = balance - ?1 WHERE id = ?2",
                params![old_amount, old_account_id],
            )
            .map_err(|e| e.to_string())?;

            tx.execute(
                "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
                params![amount, account_id],
            )
            .map_err(|e| e.to_string())?;
        }

        apply_account_currency_total_change(
            &tx,
            old_account_id,
            old_currency.as_deref(),
            old_amount,
            account_id,
            currency.as_deref(),
            amount,
        )?;

        // Try to find and update corresponding transfer transaction if any
        let mut counterpart_id_opt: Option<i32> = tx
            .query_row(
                "SELECT linked_tx_id FROM transactions WHERE id = ?1",
                params![id],
                |row| row.get::<_, Option<i32>>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .flatten();

        if counterpart_id_opt.is_none() {
            if let Some(ref n) = notes {
                // fallback: find by exact notes match
                if let Some((found_id, _found_amount, _found_acc)) = tx
                .query_row(
                    "SELECT id, amount, account_id FROM transactions WHERE notes = ?1 AND category = 'Transfer' AND id != ?2 LIMIT 1",
                    params![n, id],
                    |row| Ok((row.get::<_, i32>(0)?, row.get::<_, f64>(1)?, row.get::<_, i32>(2)?)),
                )
                .optional()
                .map_err(|e| e.to_string())?
            {
                counterpart_id_opt = Some(found_id);
                // set linkage for future operations
                tx.execute(
                    "UPDATE transactions SET linked_tx_id = ?1 WHERE id = ?2",
                    params![found_id, id],
                )
                .map_err(|e| e.to_string())?;
                tx.execute(
                    "UPDATE transactions SET linked_tx_id = ?1 WHERE id = ?2",
                    params![id, found_id],
                )
                .map_err(|e| e.to_string())?;
            }
            }
        }

        if let Some(counterpart_id) = counterpart_id_opt {
            // Get old amount, account, and currency for counterpart
            if let Some((old_ctr_amount, ctr_account_id, old_ctr_currency)) = tx
                .query_row(
                    "SELECT amount, account_id, currency FROM transactions WHERE id = ?1",
                    params![counterpart_id],
                    |row| {
                        Ok((
                            row.get::<_, f64>(0)?,
                            row.get::<_, i32>(1)?,
                            row.get::<_, Option<String>>(2)?,
                        ))
                    },
                )
                .optional()
                .map_err(|e| e.to_string())?
            {
                let new_ctr_amount = -amount;
                let ctr_diff = new_ctr_amount - old_ctr_amount;

                // Determine payee for counterpart (source account name)
                let source_name: String = tx
                    .query_row(
                        "SELECT name FROM accounts WHERE id = ?1",
                        params![account_id],
                        |row| row.get(0),
                    )
                    .map_err(|e| e.to_string())?;

                tx.execute(
                "UPDATE transactions SET date = ?1, payee = ?2, notes = ?3, category = ?4, amount = ?5, currency = ?6 WHERE id = ?7",
                params![date, source_name, notes, "Transfer", new_ctr_amount, currency, counterpart_id],
            )
            .map_err(|e| e.to_string())?;

                if ctr_diff.abs() > f64::EPSILON {
                    tx.execute(
                        "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
                        params![ctr_diff, ctr_account_id],
                    )
                    .map_err(|e| e.to_string())?;
                }

                apply_account_currency_total_change(
                    &tx,
                    ctr_account_id,
                    old_ctr_currency.as_deref(),
                    old_ctr_amount,
                    ctr_account_id,
                    currency.as_deref(),
                    new_ctr_amount,
                )?;
            }
        }

        tx.commit().map_err(|e| e.to_string())?;

        Ok(Transaction {
            id,
            account_id,
            date,
            payee,
            notes,
            category,
            amount,
            ticker: None,
            shares: None,
            price_per_share: None,
            fee: None,
            currency,
        })
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvestmentTransactionArgs {
    pub id: i32,
    pub account_id: i32,
    pub date: String,
    pub ticker: String,
    pub shares: f64,
    pub price_per_share: f64,
    pub fee: f64,
    pub is_buy: bool,
    pub notes: Option<String>,
    pub currency: Option<String>,
}

/// Updates an investment transaction and adjusts account balances accordingly.
pub fn update_investment_transaction_db(
    db_path: &Path,
    args: UpdateInvestmentTransactionArgs,
) -> Result<Transaction, String> {
    crate::db_locked!(db_path, {
        let UpdateInvestmentTransactionArgs {
            id,
            account_id,
            date,
            ticker,
            shares,
            price_per_share,
            fee,
            is_buy,
            notes,
            currency,
        } = args;

        let mut conn = crate::db_init::open_db(db_path)?;

        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Get old amount, account, and currency before the row changes.
        let (old_amount, old_account_id, old_currency): (f64, i32, Option<String>) = tx
            .query_row(
                "SELECT amount, account_id, currency FROM transactions WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| e.to_string())?;

        let total_price = shares * price_per_share;

        // Investment Transaction Amount
        // Buy: Money leaves -> -(Total + Fee)
        // Sell: Money enters -> (Total - Fee)
        let amount = if is_buy {
            -(total_price + fee)
        } else {
            total_price - fee
        };

        let investment_shares = if is_buy { shares } else { -shares };

        let final_notes = notes.unwrap_or_else(|| {
            format!(
                "{} {} shares of {}",
                if is_buy { "Bought" } else { "Sold" },
                shares,
                ticker
            )
        });

        tx.execute(
            "UPDATE transactions SET
            account_id = ?1,
            date = ?2,
            payee = ?3,
            notes = ?4,
            category = ?5,
            amount = ?6,
            ticker = ?7,
            shares = ?8,
            price_per_share = ?9,
            fee = ?10,
            currency = ?11
         WHERE id = ?12",
            params![
                account_id,
                date,
                if is_buy { "Buy" } else { "Sell" },
                final_notes,
                "Investment",
                amount,
                ticker,
                investment_shares,
                price_per_share,
                fee,
                currency,
                id
            ],
        )
        .map_err(|e| e.to_string())?;

        let diff = amount - old_amount;
        if old_account_id == account_id {
            if diff.abs() > f64::EPSILON {
                tx.execute(
                    "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
                    params![diff, account_id],
                )
                .map_err(|e| e.to_string())?;
            }
        } else {
            // Move transaction between accounts
            tx.execute(
                "UPDATE accounts SET balance = balance - ?1 WHERE id = ?2",
                params![old_amount, old_account_id],
            )
            .map_err(|e| e.to_string())?;

            tx.execute(
                "UPDATE accounts SET balance = balance + ?1 WHERE id = ?2",
                params![amount, account_id],
            )
            .map_err(|e| e.to_string())?;
        }

        apply_account_currency_total_change(
            &tx,
            old_account_id,
            old_currency.as_deref(),
            old_amount,
            account_id,
            currency.as_deref(),
            amount,
        )?;

        tx.commit().map_err(|e| e.to_string())?;

        Ok(Transaction {
            id,
            account_id,
            date,
            payee: if is_buy {
                "Buy".to_string()
            } else {
                "Sell".to_string()
            },
            notes: Some(final_notes),
            category: Some("Investment".to_string()),
            amount,
            ticker: Some(ticker),
            shares: Some(investment_shares),
            price_per_share: Some(price_per_share),
            fee: Some(fee),
            currency,
        })
    })
}

/// Deletes a transaction, reverts its account balance, and removes any linked transfer counterpart.
pub fn delete_transaction_db(db_path: &Path, id: i32) -> Result<(), String> {
    crate::db_locked!(db_path, {
        let mut conn = crate::db_init::open_db(db_path)?;

        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Get amount, account, currency, notes and linked_tx_id (if any)
        let (amount, account_id, currency, notes, linked): (
            f64,
            i32,
            Option<String>,
            Option<String>,
            Option<i32>,
        ) = tx
            .query_row(
                "SELECT amount, account_id, currency, notes, linked_tx_id FROM transactions WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .map_err(|e| e.to_string())?;

        // Delete the requested transaction
        tx.execute("DELETE FROM transactions WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;

        tx.execute(
            "UPDATE accounts SET balance = balance - ?1 WHERE id = ?2",
            params![amount, account_id],
        )
        .map_err(|e| e.to_string())?;

        adjust_account_currency_total(&tx, account_id, currency.as_deref(), -amount)?;

        // If there's a linked counterpart, delete it and update its account balance
        if let Some(linked_id) = linked {
            if let Some((ctr_amount, ctr_account_id, ctr_currency)) = tx
                .query_row(
                    "SELECT amount, account_id, currency FROM transactions WHERE id = ?1",
                    params![linked_id],
                    |row| {
                        Ok((
                            row.get::<_, f64>(0)?,
                            row.get::<_, i32>(1)?,
                            row.get::<_, Option<String>>(2)?,
                        ))
                    },
                )
                .optional()
                .map_err(|e| e.to_string())?
            {
                tx.execute("DELETE FROM transactions WHERE id = ?1", params![linked_id])
                    .map_err(|e| e.to_string())?;

                tx.execute(
                    "UPDATE accounts SET balance = balance - ?1 WHERE id = ?2",
                    params![ctr_amount, ctr_account_id],
                )
                .map_err(|e| e.to_string())?;

                adjust_account_currency_total(
                    &tx,
                    ctr_account_id,
                    ctr_currency.as_deref(),
                    -ctr_amount,
                )?;
            }
        } else if let Some(ref n) = notes {
            // fallback: try to find counterpart by notes
            if let Some((found_id, ctr_amount, ctr_account_id, ctr_currency)) = tx
            .query_row(
                "SELECT id, amount, account_id, currency FROM transactions WHERE notes = ?1 AND category = 'Transfer' LIMIT 1",
                params![n],
                |row| Ok((row.get::<_, i32>(0)?, row.get::<_, f64>(1)?, row.get::<_, i32>(2)?, row.get::<_, Option<String>>(3)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?
        {
            tx.execute("DELETE FROM transactions WHERE id = ?1", params![found_id])
                .map_err(|e| e.to_string())?;

            tx.execute(
                "UPDATE accounts SET balance = balance - ?1 WHERE id = ?2",
                params![ctr_amount, ctr_account_id],
            )
            .map_err(|e| e.to_string())?;

            adjust_account_currency_total(&tx, ctr_account_id, ctr_currency.as_deref(), -ctr_amount)?;
        }
        }

        tx.commit().map_err(|e| e.to_string())?;

        Ok(())
    })
}

/// Tauri command: creates a new transaction.
#[tauri::command]
pub fn create_transaction(
    app_handle: AppHandle,
    args: CreateTransactionArgs,
) -> Result<Transaction, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    create_transaction_db(&db_path, args)
}

/// Tauri command: one page of transactions for a specific account.
#[allow(clippy::too_many_arguments)]
///
/// `limit` and the `(cursor_date, cursor_id)` cursor are optional. Omitting
/// `limit` still returns every row for that account.
#[tauri::command]
pub fn get_transactions(
    app_handle: AppHandle,
    account_id: i32,
    limit: Option<i64>,
    cursor_date: Option<String>,
    cursor_id: Option<i32>,
    cursor_sort: Option<String>,
    search: Option<String>,
    category: Option<String>,
    sort_key: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<Transaction>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id: Some(account_id),
            exclude_archived: false,
            search,
            category,
            limit,
            cursor_date,
            cursor_id,
            cursor_sort,
            sort_key,
            sort_dir,
        },
    )
}

/// Tauri command: one page of transactions across active accounts.
#[allow(clippy::too_many_arguments)]
///
/// `account_id` narrows the page to one account. Omitting `limit` still
/// returns every matching row.
#[tauri::command]
pub fn get_all_transactions(
    app_handle: AppHandle,
    account_id: Option<i32>,
    limit: Option<i64>,
    cursor_date: Option<String>,
    cursor_id: Option<i32>,
    cursor_sort: Option<String>,
    search: Option<String>,
    category: Option<String>,
    sort_key: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<Transaction>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    query_transactions_db(
        &db_path,
        &TransactionListQuery {
            account_id,
            exclude_archived: true,
            search,
            category,
            limit,
            cursor_date,
            cursor_id,
            cursor_sort,
            sort_key,
            sort_dir,
        },
    )
}

/// Tauri command: returns net shares grouped by account and ticker.
#[tauri::command]
pub fn get_account_holdings(
    app_handle: AppHandle,
) -> Result<HashMap<String, HashMap<String, f64>>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_account_holdings_db(&db_path)
}

/// Tauri command: creates a new investment transaction.
#[tauri::command]
pub fn create_investment_transaction(
    app_handle: AppHandle,
    args: CreateInvestmentTransactionArgs,
) -> Result<Transaction, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    create_investment_transaction_db(&db_path, args)
}

/// Tauri command: updates an existing transaction.
#[tauri::command]
pub fn update_transaction(
    app_handle: AppHandle,
    args: UpdateTransactionArgs,
) -> Result<Transaction, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    update_transaction_db(&db_path, args)
}

/// Tauri command: updates an existing investment transaction.
#[tauri::command]
pub fn update_investment_transaction(
    app_handle: AppHandle,
    args: UpdateInvestmentTransactionArgs,
) -> Result<Transaction, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    update_investment_transaction_db(&db_path, args)
}

/// Tauri command: deletes a transaction by ID.
#[tauri::command]
pub fn delete_transaction(app_handle: AppHandle, id: i32) -> Result<(), String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    delete_transaction_db(&db_path, id)
}

/// Tauri command: returns distinct payee names.
#[tauri::command]
pub fn get_payees(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_payees_db(&db_path)
}

/// Tauri command: returns distinct category names.
#[tauri::command]
pub fn get_categories(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_categories_db(&db_path)
}
