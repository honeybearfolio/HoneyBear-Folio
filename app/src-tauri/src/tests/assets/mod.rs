use crate::core::assets::{
    create_asset_db, create_valuation_db, delete_asset_db, delete_valuation_db, get_assets_db,
    get_total_assets_value_db, get_valuations_db, update_asset_db, update_valuation_db,
};
use crate::tests::common::setup_db;

#[test]
fn test_create_and_get_asset() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "House".to_string(),
        "real_estate".to_string(),
        Some("USD".to_string()),
        Some("Primary residence".to_string()),
    )
    .unwrap();

    let assets = get_assets_db(&db_path, Some("USD")).unwrap();
    assert_eq!(assets.len(), 1);
    assert_eq!(assets[0].name, "House");
    assert_eq!(assets[0].category, "real_estate");
    assert_eq!(assets[0].currency, Some("USD".to_string()));
    assert_eq!(assets[0].notes, Some("Primary residence".to_string()));
    assert!(assets[0].latest_value.is_none());
    assert!(assets[0].latest_date.is_none());
}

#[test]
fn test_update_asset() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "Car".to_string(),
        "vehicle".to_string(),
        None,
        None,
    )
    .unwrap();
    let assets = get_assets_db(&db_path, None).unwrap();
    let id = assets[0].id;

    update_asset_db(
        &db_path,
        id,
        "Tesla Model 3".to_string(),
        "vehicle".to_string(),
        Some("USD".to_string()),
        Some("My EV".to_string()),
    )
    .unwrap();

    let assets = get_assets_db(&db_path, None).unwrap();
    assert_eq!(assets[0].name, "Tesla Model 3");
    assert_eq!(assets[0].notes, Some("My EV".to_string()));
}

#[test]
fn test_delete_asset() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "Ring".to_string(),
        "jewelry".to_string(),
        None,
        None,
    )
    .unwrap();
    let assets = get_assets_db(&db_path, None).unwrap();
    let id = assets[0].id;

    delete_asset_db(&db_path, id).unwrap();
    let assets = get_assets_db(&db_path, None).unwrap();
    assert_eq!(assets.len(), 0);
}

#[test]
fn test_create_and_get_valuations() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "House".to_string(),
        "real_estate".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let assets = get_assets_db(&db_path, None).unwrap();
    let asset_id = assets[0].id;

    create_valuation_db(&db_path, asset_id, "2024-01-01".to_string(), 300000.0).unwrap();
    create_valuation_db(&db_path, asset_id, "2024-06-01".to_string(), 320000.0).unwrap();

    let valuations = get_valuations_db(&db_path, asset_id).unwrap();
    assert_eq!(valuations.len(), 2);
    // Should be ordered by date descending
    assert_eq!(valuations[0].date, "2024-06-01");
    assert_eq!(valuations[0].value, 320000.0);
    assert_eq!(valuations[1].date, "2024-01-01");
    assert_eq!(valuations[1].value, 300000.0);
}

#[test]
fn test_update_valuation() {
    let (_dir, db_path) = setup_db();
    create_asset_db(&db_path, "Art".to_string(), "art".to_string(), None, None).unwrap();
    let asset_id = get_assets_db(&db_path, None).unwrap()[0].id;

    create_valuation_db(&db_path, asset_id, "2024-01-01".to_string(), 5000.0).unwrap();
    let valuations = get_valuations_db(&db_path, asset_id).unwrap();
    let val_id = valuations[0].id;

    update_valuation_db(&db_path, val_id, "2024-02-01".to_string(), 6000.0).unwrap();

    let valuations = get_valuations_db(&db_path, asset_id).unwrap();
    assert_eq!(valuations[0].date, "2024-02-01");
    assert_eq!(valuations[0].value, 6000.0);
}

#[test]
fn test_delete_valuation() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "Watch".to_string(),
        "jewelry".to_string(),
        None,
        None,
    )
    .unwrap();
    let asset_id = get_assets_db(&db_path, None).unwrap()[0].id;

    create_valuation_db(&db_path, asset_id, "2024-01-01".to_string(), 10000.0).unwrap();
    let val_id = get_valuations_db(&db_path, asset_id).unwrap()[0].id;

    delete_valuation_db(&db_path, val_id).unwrap();
    let valuations = get_valuations_db(&db_path, asset_id).unwrap();
    assert_eq!(valuations.len(), 0);
}

#[test]
fn test_get_total_assets_value() {
    let (_dir, db_path) = setup_db();

    create_asset_db(
        &db_path,
        "House".to_string(),
        "real_estate".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    create_asset_db(
        &db_path,
        "Car".to_string(),
        "vehicle".to_string(),
        Some("EUR".to_string()),
        None,
    )
    .unwrap();

    let assets = get_assets_db(&db_path, None).unwrap();
    let house_id = assets.iter().find(|a| a.name == "House").unwrap().id;
    let car_id = assets.iter().find(|a| a.name == "Car").unwrap().id;

    create_valuation_db(&db_path, house_id, "2024-01-01".to_string(), 300000.0).unwrap();
    create_valuation_db(&db_path, house_id, "2024-06-01".to_string(), 320000.0).unwrap();
    create_valuation_db(&db_path, car_id, "2024-03-01".to_string(), 25000.0).unwrap();

    // Without target currency, exchange rates are all 1.0
    let total = get_total_assets_value_db(&db_path, None).unwrap();
    assert!((total - 345000.0).abs() < 0.01);

    // With target currency USD (no custom exchange rates in DB yet)
    let total = get_total_assets_value_db(&db_path, Some("USD")).unwrap();
    assert!((total - 345000.0).abs() < 0.01);
}

#[test]
fn test_asset_with_latest_value() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "Painting".to_string(),
        "art".to_string(),
        Some("USD".to_string()),
        None,
    )
    .unwrap();
    let asset_id = get_assets_db(&db_path, None).unwrap()[0].id;

    // Before any valuations, latest should be None
    let assets = get_assets_db(&db_path, None).unwrap();
    assert!(assets[0].latest_value.is_none());

    // Add valuations
    create_valuation_db(&db_path, asset_id, "2024-01-01".to_string(), 5000.0).unwrap();
    create_valuation_db(&db_path, asset_id, "2024-06-01".to_string(), 7500.0).unwrap();

    // Latest should reflect most recent
    let assets = get_assets_db(&db_path, Some("USD")).unwrap();
    assert_eq!(assets[0].latest_value, Some(7500.0));
    assert_eq!(assets[0].latest_date, Some("2024-06-01".to_string()));
}

#[test]
fn test_delete_asset_cascades_valuations() {
    let (_dir, db_path) = setup_db();
    create_asset_db(
        &db_path,
        "House".to_string(),
        "real_estate".to_string(),
        None,
        None,
    )
    .unwrap();
    let asset_id = get_assets_db(&db_path, None).unwrap()[0].id;

    create_valuation_db(&db_path, asset_id, "2024-01-01".to_string(), 300000.0).unwrap();
    create_valuation_db(&db_path, asset_id, "2024-06-01".to_string(), 320000.0).unwrap();

    let valuations = get_valuations_db(&db_path, asset_id).unwrap();
    assert_eq!(valuations.len(), 2);

    delete_asset_db(&db_path, asset_id).unwrap();

    let valuations = get_valuations_db(&db_path, asset_id).unwrap();
    assert_eq!(valuations.len(), 0);
}
