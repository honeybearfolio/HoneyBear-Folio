use tempfile::tempdir;

#[test]
fn test_settings_with_recent_dbs_roundtrip() {
    let dir = tempdir().unwrap();
    let dir_path = dir.path().to_path_buf();

    let s = crate::AppSettings {
        db_path: Some("/active.db".to_string()),
        recent_dbs: vec![
            crate::RecentDb {
                path: "/active.db".to_string(),
                name: "Active".to_string(),
                last_opened: "2026-01-01T00:00:00Z".to_string(),
                file_exists: true,
                file_size: 1024,
            },
            crate::RecentDb {
                path: "/other.db".to_string(),
                name: "Other".to_string(),
                last_opened: "2025-12-01T00:00:00Z".to_string(),
                file_exists: false,
                file_size: 0,
            },
        ],
        ..Default::default()
    };
    crate::write_settings_to_dir(&dir_path, &s).unwrap();

    let s2 = crate::read_settings_from_dir(&dir_path).unwrap();
    assert_eq!(s2.db_path.as_deref(), Some("/active.db"));
    assert_eq!(s2.recent_dbs.len(), 2);
    assert_eq!(s2.recent_dbs[0].name, "Active");
    assert_eq!(s2.recent_dbs[1].name, "Other");
}

#[test]
fn test_backward_compatible_settings_without_recent_dbs() {
    let dir = tempdir().unwrap();
    let dir_path = dir.path().to_path_buf();

    // Write a settings.json that has no recent_dbs field (old format)
    let json = r#"{ "db_path": "/legacy.db" }"#;
    std::fs::write(dir_path.join("settings.json"), json).unwrap();

    let s = crate::read_settings_from_dir(&dir_path).unwrap();
    assert_eq!(s.db_path.as_deref(), Some("/legacy.db"));
    assert!(s.recent_dbs.is_empty());
}

#[test]
fn test_settings_with_empty_recent_dbs() {
    let dir = tempdir().unwrap();
    let dir_path = dir.path().to_path_buf();

    let s = crate::AppSettings {
        db_path: None,
        recent_dbs: vec![],
        ..Default::default()
    };
    crate::write_settings_to_dir(&dir_path, &s).unwrap();

    let s2 = crate::read_settings_from_dir(&dir_path).unwrap();
    assert!(s2.db_path.is_none());
    assert!(s2.recent_dbs.is_empty());
}

#[test]
fn test_init_db_at_new_session_path() {
    let dir = tempdir().unwrap();
    let session_path = dir.path().join("sessions").join("test_session.db");

    // Creating a new session should init the DB schema
    crate::init_db_at_path(&session_path).unwrap();

    // Verify the DB was created and has the expected tables
    let conn = rusqlite::Connection::open(&session_path).unwrap();
    let tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .flatten()
        .collect();

    assert!(tables.contains(&"accounts".to_string()));
    assert!(tables.contains(&"transactions".to_string()));
    assert!(tables.contains(&"stock_prices".to_string()));
}

#[test]
fn test_multiple_sessions_share_no_data() {
    let dir = tempdir().unwrap();
    let session_a = dir.path().join("a.db");
    let session_b = dir.path().join("b.db");

    crate::init_db_at_path(&session_a).unwrap();
    crate::init_db_at_path(&session_b).unwrap();

    // Create an account in session A
    crate::create_account_db(
        &session_a,
        "Session A Account".to_string(),
        100.0,
        None,
        None,
    )
    .unwrap();

    // Session B should have no accounts
    let accounts_b = crate::get_accounts_db(&session_b).unwrap();
    assert!(accounts_b.is_empty());

    // Session A should have one account
    let accounts_a = crate::get_accounts_db(&session_a).unwrap();
    assert_eq!(accounts_a.len(), 1);
    assert_eq!(accounts_a[0].name, "Session A Account");
}
