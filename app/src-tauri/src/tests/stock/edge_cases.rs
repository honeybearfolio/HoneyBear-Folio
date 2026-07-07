use super::common::setup_db;
use httpmock::Method::GET;
use httpmock::MockServer;

#[tokio::test]
async fn test_empty_tickers_returns_empty_quotes() {
    let (_dir, db_path) = setup_db();
    let client = reqwest::Client::builder().build().unwrap();
    let quotes = crate::get_stock_quotes_with_client_and_db(
        client,
        "http://example.com".to_string(),
        &db_path,
        vec![],
    )
    .await
    .unwrap();
    assert!(quotes.is_empty());
}

#[tokio::test]
async fn test_update_daily_stock_prices_empty_tickers_is_noop() {
    let (_dir, db_path) = setup_db();
    let client = reqwest::Client::builder().build().unwrap();
    crate::core::markets::update_daily_stock_prices_with_client_and_base(
        &db_path,
        &client,
        "http://example.com",
        vec![],
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn test_check_currency_availability_usd_is_always_true() {
    let (_dir, db_path) = setup_db();
    let client = reqwest::Client::builder().build().unwrap();
    let available = crate::core::markets::check_currency_availability_with_client_and_db(
        client,
        "http://example.com".to_string(),
        &db_path,
        "USD".to_string(),
    )
    .await
    .unwrap();
    assert!(available);
}

#[tokio::test]
async fn test_check_currency_availability_with_mock_server() {
    let (_dir, db_path) = setup_db();
    let server = MockServer::start();

    server.mock(|when, then| {
        when.method(GET).path("/v8/finance/chart/EURUSD=X");
        then.status(200)
            .header("content-type", "application/json")
            .body(r#"{"chart": {"result": [{"meta": {"symbol": "EURUSD=X", "regularMarketPrice": 1.08, "chartPreviousClose": 1.07}}]}}"#);
    });

    let client = reqwest::Client::builder().build().unwrap();
    let available = crate::core::markets::check_currency_availability_with_client_and_db(
        client,
        server.base_url(),
        &db_path,
        "EUR".to_string(),
    )
    .await
    .unwrap();
    assert!(available);
}

#[tokio::test]
async fn test_check_currency_unavailable_when_no_quote() {
    let (_dir, db_path) = setup_db();
    let server = MockServer::start();

    server.mock(|when, then| {
        when.method(GET).path("/v8/finance/chart/XYZUSD=X");
        then.status(404);
    });

    let client = reqwest::Client::builder().build().unwrap();
    let available = crate::core::markets::check_currency_availability_with_client_and_db(
        client,
        server.base_url(),
        &db_path,
        "XYZ".to_string(),
    )
    .await
    .unwrap();
    assert!(!available);
}

#[tokio::test]
async fn test_get_stock_quotes_http_error_returns_empty_without_db() {
    let (_dir, db_path) = setup_db();
    let server = MockServer::start();

    server.mock(|when, then| {
        when.method(GET).path("/v8/finance/chart/BAD");
        then.status(500);
    });

    let client = reqwest::Client::builder().build().unwrap();
    let quotes = crate::get_stock_quotes_with_client_and_db(
        client,
        server.base_url(),
        &db_path,
        vec!["BAD".to_string()],
    )
    .await
    .unwrap();
    assert!(quotes.is_empty());
}

#[tokio::test]
async fn test_search_ticker_empty_results() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET)
            .path("/v1/finance/search")
            .query_param("q", "ZZZZZ");
        then.status(200)
            .header("content-type", "application/json")
            .body(r#"{"quotes":[]}"#);
    });

    let client = reqwest::Client::builder().build().unwrap();
    let res = crate::search_ticker_with_client(client, server.base_url(), "ZZZZZ".to_string())
        .await
        .unwrap();
    assert!(res.is_empty());
}
