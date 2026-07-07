use std::fs;
use std::path::{Path, PathBuf};

// Test-only helpers to allow testing settings and init_db logic without an AppHandle

/// Returns the settings file path for the given directory.
pub(crate) fn settings_file_path_for_dir(dir: &Path) -> PathBuf {
    dir.join("settings.json")
}

/// Writes application settings to the given directory.
pub(crate) fn write_settings_to_dir(
    dir: &Path,
    settings: &crate::AppSettings,
) -> Result<(), String> {
    let settings_path = settings_file_path_for_dir(dir);
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

/// Reads application settings from the given directory, returning defaults if absent.
pub(crate) fn read_settings_from_dir(dir: &Path) -> Result<crate::AppSettings, String> {
    let settings_path = settings_file_path_for_dir(dir);
    if settings_path.exists() {
        let contents = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let s: crate::AppSettings = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        Ok(s)
    } else {
        Ok(crate::AppSettings::default())
    }
}

/// Returns the database file path for the given directory, using settings override if configured.
pub(crate) fn get_db_path_for_dir(dir: &Path) -> Result<PathBuf, String> {
    // If the user has configured an override, use it
    if let Ok(settings) = read_settings_from_dir(dir) {
        if let Some(ref p) = settings.db_path {
            let pb = PathBuf::from(p);
            // Ensure parent dir exists
            if let Some(parent) = pb.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
            }
            return Ok(pb);
        }
    }

    // Default path
    let app_dir = dir;
    if !app_dir.exists() {
        fs::create_dir_all(app_dir).map_err(|e| e.to_string())?;
    }
    Ok(app_dir.join("honeybear.db"))
}

/// Initializes the database schema at the given path for testing.
pub(crate) fn init_db_at_path(db_path: &Path) -> Result<(), String> {
    crate::db_init::init_db_at_path(db_path)
}

/// Creates a test account in the database at the specified directory.
pub(crate) fn create_account_in_dir(
    dir: &Path,
    name: String,
    balance: f64,
) -> Result<crate::Account, String> {
    let db_path = get_db_path_for_dir(dir)?;
    init_db_at_path(&db_path)?;
    crate::create_account_db(&db_path, name, balance, None, None)
}

/// Creates a test transaction in the database at the specified directory.
pub(crate) fn create_transaction_in_dir(
    dir: &Path,
    account_id: i32,
    date: String,
    payee: String,
    notes: Option<String>,
    category: Option<String>,
    amount: f64,
) -> Result<crate::Transaction, String> {
    let db_path = get_db_path_for_dir(dir)?;
    init_db_at_path(&db_path)?;
    crate::create_transaction_db(
        &db_path,
        crate::CreateTransactionArgs {
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
            currency: None,
        },
    )
}
