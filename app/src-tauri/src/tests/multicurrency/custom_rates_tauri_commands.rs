use tempfile::tempdir;

#[test]
fn test_get_all_exchange_rates_command() {
    let dir = tempdir().unwrap();
    // Ensure the app's data dir resolves to our tempdir
    std::env::set_var("XDG_DATA_HOME", dir.path());

    // Build a minimal tauri App to obtain an AppHandle for the command
    let app = tauri::Builder::default()
        .build(tauri::generate_context!())
        .expect("failed to build tauri app");
    let handle = app.handle();

    // Prepare DB
    let db_path = crate::get_db_path_for_dir(dir.path()).unwrap();
    crate::init_db_at_path(&db_path).unwrap();

    // Insert some custom rates
    crate::set_custom_exchange_rate_db(&db_path, "EUR".to_string(), 1.234).unwrap();
    crate::set_custom_exchange_rate_db(&db_path, "JPY".to_string(), 0.0089).unwrap();

    // Call the tauri command wrapper
    let entries = crate::core::utils::get_all_exchange_rates(handle.clone())
        .expect("get_all_exchange_rates failed");

    // Convert to a map for easy assertions
    let mut m = std::collections::HashMap::new();
    for e in entries {
        m.insert(e.currency, (e.rate, e.is_custom));
    }

    assert_eq!(m.get("EUR").map(|(r, c)| (*r, *c)), Some((1.234, true)));
    assert_eq!(m.get("JPY").map(|(r, c)| (*r, *c)), Some((0.0089, true)));

    // Cleanup
    std::env::remove_var("XDG_DATA_HOME");
}

#[test]
fn test_delete_custom_exchange_rate_command() {
    let dir = tempdir().unwrap();
    std::env::set_var("XDG_DATA_HOME", dir.path());

    let app = tauri::Builder::default()
        .build(tauri::generate_context!())
        .expect("failed to build tauri app");
    let handle = app.handle();

    let db_path = crate::get_db_path_for_dir(dir.path()).unwrap();
    crate::init_db_at_path(&db_path).unwrap();

    crate::set_custom_exchange_rate_db(&db_path, "EUR".to_string(), 1.5).unwrap();

    // Sanity check the rate exists
    let got = crate::get_custom_exchange_rate_db(&db_path, "EUR".to_string()).unwrap();
    assert_eq!(got, Some(1.5));

    // Call the tauri delete command
    crate::core::utils::delete_custom_exchange_rate(handle.clone(), "EUR".to_string())
        .expect("delete_custom_exchange_rate failed");

    // Ensure it was removed from DB
    let got2 = crate::get_custom_exchange_rate_db(&db_path, "EUR".to_string()).unwrap();
    assert_eq!(got2, None);

    std::env::remove_var("XDG_DATA_HOME");
}
