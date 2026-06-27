use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use tauri::AppHandle;

use crate::db_init::{init_db, read_settings, write_settings};
use crate::models::{AppSettings, RecentDb};

const MAX_RECENT_SESSIONS: usize = 10;

fn file_stem_or_default(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

fn enrich_recent_db(entry: &RecentDb) -> RecentDb {
    let path = Path::new(&entry.path);
    let (exists, size) = if path.exists() {
        let size = fs::metadata(path).map_or(0, |m| m.len());
        (true, size)
    } else {
        (false, 0)
    };
    RecentDb {
        path: entry.path.clone(),
        name: entry.name.clone(),
        last_opened: entry.last_opened.clone(),
        file_exists: exists,
        file_size: size,
    }
}

fn upsert_recent(settings: &mut AppSettings, path: &str, name: Option<&str>) {
    let now = Utc::now().to_rfc3339();
    let display_name = name.unwrap_or(&file_stem_or_default(path)).to_string();

    // Remove existing entry for this path (case-sensitive)
    settings.recent_dbs.retain(|r| r.path != path);

    // Insert at front
    settings.recent_dbs.insert(
        0,
        RecentDb {
            path: path.to_string(),
            name: display_name,
            last_opened: now,
            file_exists: true,
            file_size: 0,
        },
    );

    // Cap the list
    settings.recent_dbs.truncate(MAX_RECENT_SESSIONS);
}

/// Public wrapper so `db_init::set_db_path` can track recent sessions too.
pub fn upsert_recent_public(settings: &mut AppSettings, path: &str, name: Option<&str>) {
    upsert_recent(settings, path, name);
}

// ── Tauri commands ──────────────────────────────────────────────

/// Returns an enriched list of recent database files with existence and size metadata.
#[tauri::command]
pub fn get_recent_sessions(app_handle: AppHandle) -> Result<Vec<RecentDb>, String> {
    let settings = read_settings(&app_handle)?;
    let enriched: Vec<RecentDb> = settings.recent_dbs.iter().map(enrich_recent_db).collect();
    Ok(enriched)
}

/// Returns the currently active database session, if one is set.
#[tauri::command]
pub fn get_active_session(app_handle: AppHandle) -> Result<Option<RecentDb>, String> {
    let settings = read_settings(&app_handle)?;
    match &settings.db_path {
        Some(path) => {
            let entry = settings
                .recent_dbs
                .iter()
                .find(|r| r.path == *path)
                .cloned()
                .unwrap_or_else(|| RecentDb {
                    path: path.clone(),
                    name: file_stem_or_default(path),
                    last_opened: Utc::now().to_rfc3339(),
                    file_exists: true,
                    file_size: 0,
                });
            Ok(Some(enrich_recent_db(&entry)))
        }
        None => Ok(None),
    }
}

/// Creates a new database file at the given path and sets it as the active session.
#[tauri::command]
pub fn create_session(app_handle: AppHandle, path: String) -> Result<RecentDb, String> {
    let pb = PathBuf::from(&path);
    if let Some(parent) = pb.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    // If the file already exists, refuse to overwrite
    if pb.exists() {
        return Err("A file already exists at that path. Use 'Open Existing' instead.".to_string());
    }

    let mut settings = read_settings(&app_handle)?;
    settings.db_path = Some(path.clone());
    upsert_recent(&mut settings, &path, None);
    write_settings(&app_handle, &settings)?;

    // Initialize schema at the new path
    init_db(&app_handle)?;

    Ok(enrich_recent_db(settings.recent_dbs.first().unwrap()))
}

/// Opens and validates an existing database file, setting it as the active session.
#[tauri::command]
pub fn open_session(app_handle: AppHandle, path: String) -> Result<RecentDb, String> {
    let pb = PathBuf::from(&path);
    if !pb.exists() {
        return Err(format!("File not found: {path}"));
    }

    // Validate it's a valid SQLite database by trying to open and query it
    {
        let conn = rusqlite::Connection::open(&pb).map_err(|e| e.to_string())?;
        conn.query_row("SELECT 1", [], |_row| Ok(()))
            .map_err(|_| "The selected file is not a valid SQLite database.".to_string())?;
    }

    let mut settings = read_settings(&app_handle)?;

    // Preserve existing display name if the file was already in recent list
    let existing_name = settings
        .recent_dbs
        .iter()
        .find(|r| r.path == path)
        .map(|r| r.name.clone());

    settings.db_path = Some(path.clone());
    upsert_recent(&mut settings, &path, existing_name.as_deref());
    write_settings(&app_handle, &settings)?;

    // Ensure schema is up-to-date (runs CREATE IF NOT EXISTS + migrations)
    init_db(&app_handle)?;

    Ok(enrich_recent_db(settings.recent_dbs.first().unwrap()))
}

/// Removes a database from the recent sessions list.
#[tauri::command]
pub fn remove_recent_session(app_handle: AppHandle, path: String) -> Result<(), String> {
    let mut settings = read_settings(&app_handle)?;
    settings.recent_dbs.retain(|r| r.path != path);
    write_settings(&app_handle, &settings)?;
    Ok(())
}

/// Renames the display name of a recent database session.
#[tauri::command]
pub fn rename_session(app_handle: AppHandle, path: String, new_name: String) -> Result<(), String> {
    let mut settings = read_settings(&app_handle)?;
    if let Some(entry) = settings.recent_dbs.iter_mut().find(|r| r.path == path) {
        entry.name = new_name;
    } else {
        return Err("Session not found in recent list.".to_string());
    }
    write_settings(&app_handle, &settings)?;
    Ok(())
}

// ── Unit tests (no AppHandle needed) ────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn make_settings(db_path: Option<&str>, recent: Vec<(&str, &str)>) -> AppSettings {
        AppSettings {
            db_path: db_path.map(std::string::ToString::to_string),
            recent_dbs: recent
                .into_iter()
                .map(|(p, n)| RecentDb {
                    path: p.to_string(),
                    name: n.to_string(),
                    last_opened: "2026-01-01T00:00:00Z".to_string(),
                    file_exists: false,
                    file_size: 0,
                })
                .collect(),
            ..Default::default()
        }
    }

    #[test]
    fn upsert_adds_new_entry_at_front() {
        let mut settings = make_settings(None, vec![("/old.db", "Old")]);
        upsert_recent(&mut settings, "/new.db", None);

        assert_eq!(settings.recent_dbs.len(), 2);
        assert_eq!(settings.recent_dbs[0].path, "/new.db");
        assert_eq!(settings.recent_dbs[0].name, "new");
        assert_eq!(settings.recent_dbs[1].path, "/old.db");
    }

    #[test]
    fn upsert_moves_existing_entry_to_front() {
        let mut settings =
            make_settings(None, vec![("/first.db", "First"), ("/second.db", "Second")]);
        upsert_recent(&mut settings, "/second.db", Some("Second"));

        assert_eq!(settings.recent_dbs.len(), 2);
        assert_eq!(settings.recent_dbs[0].path, "/second.db");
        assert_eq!(settings.recent_dbs[1].path, "/first.db");
    }

    #[test]
    fn upsert_caps_at_max() {
        let entries: Vec<(&str, &str)> = (0..MAX_RECENT_SESSIONS)
            .map(|i| {
                // We'll use leaked strings since we need &str with 'static lifetime for the test
                let path: &'static str = Box::leak(format!("/{i}.db").into_boxed_str());
                let name: &'static str = Box::leak(format!("DB {i}").into_boxed_str());
                (path, name)
            })
            .collect();
        let mut settings = make_settings(None, entries);
        assert_eq!(settings.recent_dbs.len(), MAX_RECENT_SESSIONS);

        upsert_recent(&mut settings, "/overflow.db", None);
        assert_eq!(settings.recent_dbs.len(), MAX_RECENT_SESSIONS);
        assert_eq!(settings.recent_dbs[0].path, "/overflow.db");
    }

    #[test]
    fn upsert_uses_custom_name_when_provided() {
        let mut settings = make_settings(None, vec![]);
        upsert_recent(&mut settings, "/data/finances.db", Some("My Finances"));

        assert_eq!(settings.recent_dbs[0].name, "My Finances");
    }

    #[test]
    fn upsert_derives_name_from_filename_when_not_provided() {
        let mut settings = make_settings(None, vec![]);
        upsert_recent(&mut settings, "/home/user/personal_budget.db", None);

        assert_eq!(settings.recent_dbs[0].name, "personal_budget");
    }

    #[test]
    fn file_stem_or_default_handles_edge_cases() {
        assert_eq!(file_stem_or_default("/path/to/test.db"), "test");
        assert_eq!(file_stem_or_default("simple.sqlite"), "simple");
        assert_eq!(file_stem_or_default("/"), "Untitled");
    }

    #[test]
    fn enrich_sets_file_exists_false_for_missing_file() {
        let entry = RecentDb {
            path: "/nonexistent/path/missing.db".to_string(),
            name: "Missing".to_string(),
            last_opened: "2026-01-01T00:00:00Z".to_string(),
            file_exists: true,
            file_size: 999,
        };
        let enriched = enrich_recent_db(&entry);
        assert!(!enriched.file_exists);
        assert_eq!(enriched.file_size, 0);
    }

    #[test]
    fn enrich_sets_file_exists_true_for_real_file() {
        let dir = tempdir().unwrap();
        let db_file = dir.path().join("test.db");
        fs::write(&db_file, b"test data").unwrap();

        let entry = RecentDb {
            path: db_file.to_string_lossy().to_string(),
            name: "Test".to_string(),
            last_opened: "2026-01-01T00:00:00Z".to_string(),
            file_exists: false,
            file_size: 0,
        };
        let enriched = enrich_recent_db(&entry);
        assert!(enriched.file_exists);
        assert!(enriched.file_size > 0);
    }

    #[test]
    fn settings_serialization_roundtrip() {
        let settings = make_settings(
            Some("/active.db"),
            vec![("/active.db", "Active"), ("/other.db", "Other")],
        );
        let json = serde_json::to_string_pretty(&settings).unwrap();
        let deserialized: AppSettings = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.db_path.as_deref(), Some("/active.db"));
        assert_eq!(deserialized.recent_dbs.len(), 2);
        assert_eq!(deserialized.recent_dbs[0].name, "Active");
    }

    #[test]
    fn settings_deserializes_without_recent_dbs_field() {
        // Backward compatibility: old settings.json won't have recent_dbs
        let json = r#"{ "db_path": "/old.db" }"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();

        assert_eq!(settings.db_path.as_deref(), Some("/old.db"));
        assert!(settings.recent_dbs.is_empty());
    }
}
