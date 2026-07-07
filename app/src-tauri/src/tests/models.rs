#[test]
fn test_default_exchange_rate() {
    assert_eq!(crate::models::default_exchange_rate(), 1.0);
}

#[test]
fn test_account_deserializes_default_exchange_rate() {
    let json = r#"{"id":1,"name":"Test","balance":100.0}"#;
    let account: crate::Account = serde_json::from_str(json).unwrap();
    assert_eq!(account.exchange_rate, 1.0);
}
