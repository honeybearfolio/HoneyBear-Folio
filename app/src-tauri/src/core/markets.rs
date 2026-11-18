use crate::models::{DailyPrice, YahooChartResponse, YahooQuote, YahooSearchQuote};
use chrono::{NaiveDate, TimeZone, Utc};
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// Searches Yahoo Finance for ticker symbols matching the given query.
pub async fn search_ticker_with_client(
    client: reqwest::Client,
    base_url: String,
    query: String,
) -> Result<Vec<YahooSearchQuote>, String> {
    let url = format!("{base_url}/v1/finance/search?q={query}");
    let res = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    let response: crate::models::YahooSearchResponse =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;

    Ok(response.quotes)
}

/// Searches for tickers and enriches results with currency information from quotes.
#[tauri::command]
pub async fn search_ticker(
    app_handle: tauri::AppHandle,
    query: String,
) -> Result<Vec<YahooSearchQuote>, String> {
    // 1. Get initial search results
    let mut quotes = search_ticker_with_client(
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?,
        "https://query1.finance.yahoo.com".to_string(),
        query,
    )
    .await?;

    if quotes.is_empty() {
        return Ok(quotes);
    }

    // 2. Fetch full quotes to get currencies for these symbols
    let tickers: Vec<String> = quotes.iter().map(|q| q.symbol.clone()).collect();
    let full_quotes = get_stock_quotes(app_handle, tickers)
        .await
        .unwrap_or_default();

    // 3. Merge currency info back into search results
    for q in &mut quotes {
        if let Some(fq) = full_quotes.iter().find(|f| f.symbol == q.symbol) {
            q.currency = fq.currency.clone();
        }
    }

    Ok(quotes)
}

/// Fetches current stock quotes for the given list of ticker symbols.
#[tauri::command]
pub async fn get_stock_quotes(
    app_handle: tauri::AppHandle,
    tickers: Vec<String>,
) -> Result<Vec<YahooQuote>, String> {
    get_stock_quotes_with_client(
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?,
        "https://query1.finance.yahoo.com".to_string(),
        app_handle,
        tickers,
    )
    .await
}

/// Queries the Yahoo Finance API for stock quotes, fetching tickers in parallel batches.
pub async fn get_stock_quotes_with_client(
    client: reqwest::Client,
    base_url: String,
    app_handle: tauri::AppHandle,
    tickers: Vec<String>,
) -> Result<Vec<YahooQuote>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_stock_quotes_with_client_and_db(client, base_url, db_path.as_path(), tickers).await
}

/// Fetches stock quotes from Yahoo Finance and caches them in the database.
pub async fn get_stock_quotes_with_client_and_db(
    client: reqwest::Client,
    base_url: String,
    db_path: &std::path::Path,
    tickers: Vec<String>,
) -> Result<Vec<YahooQuote>, String> {
    if tickers.is_empty() {
        return Ok(Vec::new());
    }

    let mut tasks = Vec::new();

    for ticker in &tickers {
        let ticker = ticker.clone();
        let client = client.clone();
        let base_url = base_url.clone();
        tasks.push(tokio::spawn(async move {
            let url = format!("{}/v8/finance/chart/{}?interval=1d&range=1d", base_url.trim_end_matches('/'), ticker);
            let res = client.get(&url)
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .send()
                .await;

            match res {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let text_res = resp.text().await;
                        match text_res {
                            Ok(text) => {
                                let json: Result<YahooChartResponse, _> = serde_json::from_str(&text);
                                match json {
                                    Ok(data) => {
                                        if let Some(results) = data.chart.result {
                                            if let Some(item) = results.first() {
                                                let price = item.meta.regular_market_price.unwrap_or(0.0);
                                                let prev = item.meta.chart_previous_close
                                                    .or(item.meta.previous_close)
                                                    .unwrap_or(price);

                                                let change_percent = if prev == 0.0 {
                                                    0.0
                                                } else {
                                                    ((price - prev) / prev) * 100.0
                                                };
                                                return Some(YahooQuote {
                                                    symbol: item.meta.symbol.clone(),
                                                    price,
                                                    change_percent,
                                                    currency: item.meta.currency.clone(),
                                                    quote_type: item.meta.instrument_type.clone(),
                                                });
                                            }
                                        }
                                    },
                                    Err(err) => {
                                        let description = err.to_string();
                                        log::warn!(
                                            "Failed to parse JSON for {ticker}: {description}"
                                        );
                                    }
                                }
                            },
                            Err(err) => {
                                let description = err.to_string();
                                log::warn!("Failed to get text for {ticker}: {description}");
                            }
                        }
                    } else {
                        log::warn!("Request failed for {}: {}", ticker, resp.status());
                    }
                },
                Err(err) => {
                    let description = err.to_string();
                    log::warn!("Request error for {ticker}: {description}");
                }
            }
            None
        }));
    }

    let mut quotes = Vec::new();
    for task in tasks {
        if let Ok(Some(quote)) = task.await {
            quotes.push(quote);
        }
    }

    // Update DB with new quotes
    let quote_prices: Vec<(String, f64)> =
        quotes.iter().map(|q| (q.symbol.clone(), q.price)).collect();
    crate::db_locked!(db_path, {
        let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        {
            let mut stmt = tx.prepare("INSERT OR REPLACE INTO stock_prices (ticker, price, last_updated) VALUES (?1, ?2, datetime('now'))").map_err(|e| e.to_string())?;
            for (symbol, price) in &quote_prices {
                stmt.execute(params![symbol, price])
                    .map_err(|e| e.to_string())?;
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    })?;

    // If we missed some tickers, try to fetch from DB
    let found_symbols: Vec<String> = quotes.iter().map(|q| q.symbol.clone()).collect();
    let missing_tickers: Vec<String> = tickers
        .into_iter()
        .filter(|t| !found_symbols.iter().any(|s| s.eq_ignore_ascii_case(t)))
        .collect();

    if !missing_tickers.is_empty() {
        let additional: Vec<YahooQuote> = crate::db_locked!(db_path, {
            let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
            let placeholders: String = missing_tickers
                .iter()
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(",");
            let query = format!(
                "SELECT ticker, price FROM stock_prices WHERE ticker COLLATE NOCASE IN ({placeholders})"
            );
            let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

            let rows = stmt
                .query_map(rusqlite::params_from_iter(missing_tickers.iter()), |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
                })
                .map_err(|e| e.to_string())?;

            let mut additional = Vec::new();
            for row in rows {
                let (symbol, price) = row.map_err(|e| e.to_string())?;
                additional.push(YahooQuote {
                    symbol,
                    price,
                    change_percent: 0.0,
                    currency: None,
                    quote_type: None,
                });
            }

            Ok::<Vec<YahooQuote>, String>(additional)
        })?;
        quotes.extend(additional);
    }

    Ok(quotes)
}

struct DailyPriceRow {
    ticker: String,
    date: String,
    price: f64,
}

struct DailyHistoryRequest {
    ticker: String,
    start_timestamp: i64,
}

fn unique_tickers(tickers: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for ticker in tickers {
        if seen.insert(ticker.clone()) {
            unique.push(ticker.clone());
        }
    }
    unique
}

fn last_daily_price_dates(
    db_path: &Path,
    tickers: &[String],
) -> Result<HashMap<String, String>, String> {
    let mut dates = HashMap::new();
    if tickers.is_empty() {
        return Ok(dates);
    }
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        for chunk in tickers.chunks(200) {
            let placeholders = chunk.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!(
                "SELECT ticker, MAX(date) FROM daily_stock_prices WHERE ticker IN ({placeholders}) GROUP BY ticker"
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(rusqlite::params_from_iter(chunk.iter()), |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .map_err(|e| e.to_string())?;
            for row in rows {
                let (ticker, date) = row.map_err(|e| e.to_string())?;
                dates.insert(ticker, date);
            }
        }
        Ok::<(), String>(())
    })?;
    Ok(dates)
}

/// `None` when stored history already covers today, or the next bar would start in the future.
fn history_start(
    last_date: Option<&str>,
    today: &str,
    end_timestamp: i64,
) -> Result<Option<i64>, String> {
    let Some(date_str) = last_date else {
        return Ok(Some(end_timestamp - 10 * 365 * 24 * 60 * 60));
    };
    if date_str >= today {
        return Ok(None);
    }
    let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let next_day = date.succ_opt().ok_or_else(|| "Invalid date".to_string())?;
    let start = next_day
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| "Invalid date".to_string())?
        .and_utc()
        .timestamp();
    if start >= end_timestamp {
        return Ok(None);
    }
    Ok(Some(start))
}

fn pending_history_requests(
    tickers: &[String],
    last_dates: &HashMap<String, String>,
    today: &str,
    end_timestamp: i64,
) -> Result<Vec<DailyHistoryRequest>, String> {
    let mut pending = Vec::new();
    for ticker in tickers {
        let start_timestamp = history_start(
            last_dates.get(ticker).map(String::as_str),
            today,
            end_timestamp,
        )?;
        let Some(start_timestamp) = start_timestamp else {
            continue;
        };
        pending.push(DailyHistoryRequest {
            ticker: ticker.clone(),
            start_timestamp,
        });
    }
    Ok(pending)
}

fn rows_from_chart(ticker: &str, json: &YahooChartResponse) -> Vec<DailyPriceRow> {
    let mut rows = Vec::new();
    let Some(result) = json.chart.result.as_ref() else {
        return rows;
    };
    let Some(chart) = result.first() else {
        return rows;
    };
    let (Some(timestamps), Some(indicators)) = (&chart.timestamp, &chart.indicators) else {
        return rows;
    };
    let Some(quotes) = indicators.quote.as_ref() else {
        return rows;
    };
    let Some(quote) = quotes.first() else {
        return rows;
    };
    let Some(closes) = quote.close.as_ref() else {
        return rows;
    };
    for (index, timestamp) in timestamps.iter().enumerate() {
        let Some(price) = closes.get(index).copied().flatten() else {
            continue;
        };
        let Some(date) = Utc.timestamp_opt(*timestamp, 0).single() else {
            continue;
        };
        rows.push(DailyPriceRow {
            ticker: ticker.to_string(),
            date: date.format("%Y-%m-%d").to_string(),
            price,
        });
    }
    rows
}

async fn fetch_daily_rows(
    client: reqwest::Client,
    base_url: String,
    ticker: String,
    start_timestamp: i64,
    end_timestamp: i64,
) -> Result<Vec<DailyPriceRow>, String> {
    let url = format!(
        "{base_url}/v8/finance/chart/{ticker}?period1={start_timestamp}&period2={end_timestamp}&interval=1d"
    );
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        log::warn!(
            "Failed to fetch history for {ticker}: {}",
            response.status()
        );
        return Ok(Vec::new());
    }
    let text = response.text().await.map_err(|e| e.to_string())?;
    let json: YahooChartResponse = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(rows_from_chart(&ticker, &json))
}

fn insert_daily_prices(db_path: &Path, rows: &[DailyPriceRow]) -> Result<(), String> {
    if rows.is_empty() {
        return Ok(());
    }
    crate::db_locked!(db_path, {
        let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        {
            let mut stmt = tx
                .prepare(
                    "INSERT OR REPLACE INTO daily_stock_prices (ticker, date, price) VALUES (?1, ?2, ?3)",
                )
                .map_err(|e| e.to_string())?;
            for row in rows {
                stmt.execute(params![row.ticker, row.date, row.price])
                    .map_err(|e| e.to_string())?;
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    })?;
    Ok(())
}

/// Updates daily stock price history in the database from Yahoo Finance data.
///
/// Tickers whose newest stored bar is already today are left untouched. The rest are
/// downloaded together, then written in one transaction.
pub async fn update_daily_stock_prices_with_client_and_base(
    db_path: &std::path::Path,
    client: &reqwest::Client,
    base_url: &str,
    tickers: Vec<String>,
) -> Result<(), String> {
    let tickers = unique_tickers(&tickers);
    if tickers.is_empty() {
        return Ok(());
    }

    let today = Utc::now().format("%Y-%m-%d").to_string();
    let end_timestamp = Utc::now().timestamp();
    let last_dates = last_daily_price_dates(db_path, &tickers)?;
    let pending = pending_history_requests(&tickers, &last_dates, &today, end_timestamp)?;
    if pending.is_empty() {
        return Ok(());
    }

    let mut tasks = Vec::with_capacity(pending.len());
    for request in pending {
        let client = client.clone();
        let base_url = base_url.to_string();
        tasks.push(tokio::spawn(async move {
            fetch_daily_rows(
                client,
                base_url,
                request.ticker,
                request.start_timestamp,
                end_timestamp,
            )
            .await
        }));
    }

    let mut rows = Vec::new();
    let mut error = None;
    for task in tasks {
        match task.await {
            Ok(Ok(fetched)) => rows.extend(fetched),
            Ok(Err(message)) => {
                if error.is_none() {
                    error = Some(message);
                }
            }
            Err(join_error) => {
                log::warn!("Daily price task failed: {join_error}");
            }
        }
    }
    insert_daily_prices(db_path, &rows)?;
    if let Some(message) = error {
        return Err(message);
    }
    Ok(())
}

/// Updates daily stock prices from Yahoo Finance for the given tickers.
#[tauri::command]
pub async fn update_daily_stock_prices(
    app_handle: tauri::AppHandle,
    tickers: Vec<String>,
) -> Result<(), String> {
    // Allow overriding base URL via env var for testing
    let base_url = std::env::var("YAHOO_BASE_URL")
        .unwrap_or_else(|_| "https://query1.finance.yahoo.com".to_string());
    let db_path = crate::db_init::get_db_path(&app_handle)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    update_daily_stock_prices_with_client_and_base(
        std::path::Path::new(&db_path),
        &client,
        &base_url,
        tickers,
    )
    .await
}

/// Reads daily price history for a ticker from the database at the given path.
pub fn get_daily_stock_prices_from_path(
    db_path: &std::path::Path,
    ticker: String,
) -> Result<Vec<DailyPrice>, String> {
    crate::db_locked!(db_path, {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT date, price FROM daily_stock_prices WHERE ticker = ?1 ORDER BY date ASC",
            )
            .map_err(|e| e.to_string())?;

        let prices = stmt
            .query_map(params![ticker], |row| {
                Ok(DailyPrice {
                    date: row.get(0)?,
                    price: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(prices)
    })
}

/// Retrieves daily price history for a given ticker symbol.
#[tauri::command]
pub fn get_daily_stock_prices(
    app_handle: tauri::AppHandle,
    ticker: String,
) -> Result<Vec<DailyPrice>, String> {
    let db_path = crate::db_init::get_db_path(&app_handle)?;
    get_daily_stock_prices_from_path(std::path::Path::new(&db_path), ticker)
}

/// Verifies whether a currency pair is available on Yahoo Finance.
pub async fn check_currency_availability_with_client_and_db(
    client: reqwest::Client,
    base_url: String,
    db_path: &std::path::Path,
    currency: String,
) -> Result<bool, String> {
    if currency == "USD" {
        return Ok(true);
    }

    let ticker = format!("{currency}USD=X");
    let quotes =
        get_stock_quotes_with_client_and_db(client, base_url, db_path, vec![ticker]).await?;

    Ok(!quotes.is_empty())
}

/// Verifies whether a currency pair is available on Yahoo Finance.
#[tauri::command]
pub async fn check_currency_availability(
    app_handle: tauri::AppHandle,
    currency: String,
) -> Result<bool, String> {
    if currency == "USD" {
        return Ok(true);
    }

    let db_path = crate::db_init::get_db_path(&app_handle)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    check_currency_availability_with_client_and_db(
        client,
        "https://query1.finance.yahoo.com".to_string(),
        db_path.as_path(),
        currency,
    )
    .await
}
