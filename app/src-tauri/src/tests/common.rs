use std::path::PathBuf;
use tempfile::tempdir;

pub fn setup_db() -> (tempfile::TempDir, PathBuf) {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    crate::db_init::init_db_at_path(&db_path).unwrap();
    (dir, db_path)
}
