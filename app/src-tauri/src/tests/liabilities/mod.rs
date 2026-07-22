use crate::core::liabilities::{
    create_liability_db, create_liability_valuation_db, delete_liability_db,
    delete_liability_valuation_db, get_liabilities_db, get_liability_valuations_db,
    get_total_liabilities_value_db, update_liability_db, update_liability_valuation_db,
};
use crate::tests::common::setup_db;

#[test]
fn test_create_and_get_liability() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Mortgage".to_string(),
        "mortgage".to_string(),
        Some("USD".to_string()),
        Some("Primary home loan".to_string()),
    )
    .unwrap();

    let liabilities = get_liabilities_db(&db_path, Some("USD")).unwrap();
    assert_eq!(liabilities.len(), 1);
    assert_eq!(liabilities[0].name, "Mortgage");
    assert_eq!(liabilities[0].category, "mortgage");
    assert_eq!(liabilities[0].currency, Some("USD".to_string()));
    assert_eq!(liabilities[0].notes, Some("Primary home loan".to_string()));
    assert!(liabilities[0].latest_value.is_none());
    assert!(liabilities[0].latest_date.is_none());
}

#[test]
fn test_update_liability() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Car Loan".to_string(),
        "auto_loan".to_string(),
        None,
        None,
    )
    .unwrap();
    let liabilities = get_liabilities_db(&db_path, None).unwrap();
    let id = liabilities[0].id;

    update_liability_db(
        &db_path,
        id,
        "Auto Loan".to_string(),
        "auto_loan".to_string(),
        Some("USD".to_string()),
        Some("Tesla financing".to_string()),
    )
    .unwrap();

    let liabilities = get_liabilities_db(&db_path, None).unwrap();
    assert_eq!(liabilities[0].name, "Auto Loan");
    assert_eq!(liabilities[0].notes, Some("Tesla financing".to_string()));
}

#[test]
fn test_delete_liability() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Credit Card".to_string(),
        "credit_card".to_string(),
        None,
        None,
    )
    .unwrap();
    let liabilities = get_liabilities_db(&db_path, None).unwrap();
    let id = liabilities[0].id;

    delete_liability_db(&db_path, id).unwrap();
    let liabilities = get_liabilities_db(&db_path, None).unwrap();
    assert_eq!(liabilities.len(), 0);
}

#[test]
fn test_create_and_get_liability_valuations() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Mortgage".to_string(),
        "mortgage".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let liabilities = get_liabilities_db(&db_path, None).unwrap();
    let liability_id = liabilities[0].id;

    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 250000.0)
        .unwrap();
    create_liability_valuation_db(&db_path, liability_id, "2024-06-01".to_string(), 240000.0)
        .unwrap();

    let valuations = get_liability_valuations_db(&db_path, liability_id).unwrap();
    assert_eq!(valuations.len(), 2);
    assert_eq!(valuations[0].date, "2024-06-01");
    assert_eq!(valuations[0].value, 240000.0);
    assert_eq!(valuations[1].date, "2024-01-01");
    assert_eq!(valuations[1].value, 250000.0);
}

#[test]
fn test_update_liability_valuation() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Student Loan".to_string(),
        "student_loan".to_string(),
        None,
        None,
    )
    .unwrap();
    let liability_id = get_liabilities_db(&db_path, None).unwrap()[0].id;

    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 30000.0)
        .unwrap();
    let valuations = get_liability_valuations_db(&db_path, liability_id).unwrap();
    let val_id = valuations[0].id;

    update_liability_valuation_db(&db_path, val_id, "2024-02-01".to_string(), 28000.0).unwrap();

    let valuations = get_liability_valuations_db(&db_path, liability_id).unwrap();
    assert_eq!(valuations[0].date, "2024-02-01");
    assert_eq!(valuations[0].value, 28000.0);
}

#[test]
fn test_delete_liability_valuation() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Personal Loan".to_string(),
        "personal_loan".to_string(),
        None,
        None,
    )
    .unwrap();
    let liability_id = get_liabilities_db(&db_path, None).unwrap()[0].id;

    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 5000.0)
        .unwrap();
    let val_id = get_liability_valuations_db(&db_path, liability_id).unwrap()[0].id;

    delete_liability_valuation_db(&db_path, val_id).unwrap();
    let valuations = get_liability_valuations_db(&db_path, liability_id).unwrap();
    assert_eq!(valuations.len(), 0);
}

#[test]
fn test_get_total_liabilities_value() {
    let (_dir, db_path) = setup_db();

    create_liability_db(
        &db_path,
        "Mortgage".to_string(),
        "mortgage".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    create_liability_db(
        &db_path,
        "Car Loan".to_string(),
        "auto_loan".to_string(),
        Some("EUR".to_string()),
        None,
    )
    .unwrap();

    let liabilities = get_liabilities_db(&db_path, None).unwrap();
    let mortgage_id = liabilities
        .iter()
        .find(|l| l.name == "Mortgage")
        .unwrap()
        .id;
    let car_id = liabilities
        .iter()
        .find(|l| l.name == "Car Loan")
        .unwrap()
        .id;

    create_liability_valuation_db(&db_path, mortgage_id, "2024-01-01".to_string(), 200000.0)
        .unwrap();
    create_liability_valuation_db(&db_path, mortgage_id, "2024-06-01".to_string(), 195000.0)
        .unwrap();
    create_liability_valuation_db(&db_path, car_id, "2024-03-01".to_string(), 15000.0).unwrap();

    let total = get_total_liabilities_value_db(&db_path, None).unwrap();
    assert!((total - 210000.0).abs() < 0.01);

    let total = get_total_liabilities_value_db(&db_path, Some("USD")).unwrap();
    assert!((total - 210000.0).abs() < 0.01);
}

#[test]
fn test_liability_with_latest_value() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Credit Card".to_string(),
        "credit_card".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let liability_id = get_liabilities_db(&db_path, None).unwrap()[0].id;

    let liabilities = get_liabilities_db(&db_path, None).unwrap();
    assert!(liabilities[0].latest_value.is_none());

    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 2000.0)
        .unwrap();
    create_liability_valuation_db(&db_path, liability_id, "2024-06-01".to_string(), 1500.0)
        .unwrap();

    let liabilities = get_liabilities_db(&db_path, Some("USD")).unwrap();
    assert_eq!(liabilities[0].latest_value, Some(1500.0));
    assert_eq!(liabilities[0].latest_date, Some("2024-06-01".to_string()));
}

#[test]
fn test_delete_liability_cascades_valuations() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Mortgage".to_string(),
        "mortgage".to_string(),
        None,
        None,
    )
    .unwrap();
    let liability_id = get_liabilities_db(&db_path, None).unwrap()[0].id;

    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 200000.0)
        .unwrap();
    create_liability_valuation_db(&db_path, liability_id, "2024-06-01".to_string(), 195000.0)
        .unwrap();

    let valuations = get_liability_valuations_db(&db_path, liability_id).unwrap();
    assert_eq!(valuations.len(), 2);

    delete_liability_db(&db_path, liability_id).unwrap();

    let valuations = get_liability_valuations_db(&db_path, liability_id).unwrap();
    assert_eq!(valuations.len(), 0);
}

#[test]
fn test_create_liability_rejects_empty_name() {
    let (_dir, db_path) = setup_db();
    let err = create_liability_db(&db_path, "   ".to_string(), "other".to_string(), None, None)
        .unwrap_err();
    assert!(err.contains("empty"));
}

#[test]
fn test_get_liabilities_applies_custom_exchange_rate_for_target() {
    let (_dir, db_path) = setup_db();
    crate::set_custom_exchange_rate_db(&db_path, "EUR".to_string(), 1.2).unwrap();
    create_liability_db(
        &db_path,
        "EU Mortgage".to_string(),
        "mortgage".to_string(),
        Some("EUR".to_string()),
        None,
    )
    .unwrap();
    let liability_id = get_liabilities_db(&db_path, None).unwrap()[0].id;
    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 100000.0)
        .unwrap();

    let liabilities = get_liabilities_db(&db_path, Some("USD")).unwrap();
    assert_eq!(liabilities[0].exchange_rate, 1.2);
}

#[test]
fn test_update_liability_rejects_empty_name_and_missing_id() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "Loan".to_string(),
        "other".to_string(),
        None,
        None,
    )
    .unwrap();
    let id = get_liabilities_db(&db_path, None).unwrap()[0].id;

    let err = update_liability_db(
        &db_path,
        id,
        "  ".to_string(),
        "other".to_string(),
        None,
        None,
    )
    .unwrap_err();
    assert!(err.contains("empty"));

    let err = update_liability_db(
        &db_path,
        9999,
        "New".to_string(),
        "other".to_string(),
        None,
        None,
    )
    .unwrap_err();
    assert!(err.contains("not found"));
}

#[test]
fn test_delete_missing_liability_errors() {
    let (_dir, db_path) = setup_db();
    let err = delete_liability_db(&db_path, 9999).unwrap_err();
    assert!(err.contains("not found"));
}

#[test]
fn test_get_liability_valuations_empty_for_unknown_liability() {
    let (_dir, db_path) = setup_db();
    let valuations = get_liability_valuations_db(&db_path, 9999).unwrap();
    assert!(valuations.is_empty());
}

#[test]
fn test_get_liabilities_same_target_currency_has_unit_exchange_rate() {
    let (_dir, db_path) = setup_db();
    create_liability_db(
        &db_path,
        "EU Loan".to_string(),
        "personal_loan".to_string(),
        Some("EUR".to_string()),
        None,
    )
    .unwrap();
    let liabilities = get_liabilities_db(&db_path, Some("EUR")).unwrap();
    assert_eq!(liabilities[0].exchange_rate, 1.0);
}

#[test]
fn test_liability_valuation_update_and_delete_not_found() {
    let (_dir, db_path) = setup_db();
    let err =
        update_liability_valuation_db(&db_path, 9999, "2024-01-01".to_string(), 1.0).unwrap_err();
    assert!(err.contains("not found"));
    let err = delete_liability_valuation_db(&db_path, 9999).unwrap_err();
    assert!(err.contains("not found"));
}

#[test]
fn test_get_total_liabilities_value_applies_exchange_rate() {
    let (_dir, db_path) = setup_db();
    crate::set_custom_exchange_rate_db(&db_path, "EUR".to_string(), 1.25).unwrap();
    create_liability_db(
        &db_path,
        "EU Mortgage".to_string(),
        "mortgage".to_string(),
        Some("EUR".to_string()),
        None,
    )
    .unwrap();
    let liability_id = get_liabilities_db(&db_path, None).unwrap()[0].id;
    create_liability_valuation_db(&db_path, liability_id, "2024-01-01".to_string(), 100000.0)
        .unwrap();

    let total = get_total_liabilities_value_db(&db_path, Some("USD")).unwrap();
    assert!((total - 125000.0).abs() < 0.01);
}
