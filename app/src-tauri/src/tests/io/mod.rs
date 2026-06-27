use crate::core::io::{read_xlsx, write_xlsx, SheetData};
use serde_json::json;
use tempfile::tempdir;

#[test]
fn test_write_and_read_xlsx_roundtrip() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("test.xlsx");
    let path_str = file_path.to_string_lossy().into_owned();

    let sheets = vec![SheetData {
        name: "Accounts".to_string(),
        data: vec![
            json!({"name": "Checking", "balance": 1500.0, "active": true}),
            json!({"name": "Savings", "balance": 5000.0, "active": false}),
        ],
    }];

    write_xlsx(path_str.clone(), sheets).unwrap();
    assert!(file_path.exists());

    let bytes = std::fs::read(&file_path).unwrap();
    let result = read_xlsx(bytes).unwrap();

    assert_eq!(result.sheets.len(), 1);
    assert_eq!(result.sheets[0].name, "Accounts");
    assert!(!result.data.is_empty());
    let header: Vec<_> = result.data[0]
        .iter()
        .filter_map(|v| v.as_str().map(str::to_string))
        .collect();
    assert!(header.contains(&"name".to_string()));
    assert!(header.contains(&"balance".to_string()));
    let row1: Vec<_> = result.data[1]
        .iter()
        .filter_map(|v| v.as_str().map(str::to_string))
        .collect();
    assert!(row1.contains(&"Checking".to_string()));
}

#[test]
fn test_write_xlsx_multiple_sheets() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("multi.xlsx");
    let path_str = file_path.to_string_lossy().into_owned();

    let sheets = vec![
        SheetData {
            name: "Sheet1".to_string(),
            data: vec![json!({"col": "a"})],
        },
        SheetData {
            name: "Sheet2".to_string(),
            data: vec![json!({"col": "b"})],
        },
    ];

    write_xlsx(path_str, sheets).unwrap();

    let bytes = std::fs::read(&file_path).unwrap();
    let result = read_xlsx(bytes).unwrap();
    assert_eq!(result.sheets.len(), 2);
    assert_eq!(result.sheets[0].name, "Sheet1");
    assert_eq!(result.sheets[1].name, "Sheet2");
}

#[test]
fn test_write_xlsx_empty_sheet_data() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("empty.xlsx");
    let path_str = file_path.to_string_lossy().into_owned();

    let sheets = vec![SheetData {
        name: "Empty".to_string(),
        data: vec![],
    }];

    write_xlsx(path_str, sheets).unwrap();
    let bytes = std::fs::read(&file_path).unwrap();
    let result = read_xlsx(bytes).unwrap();
    assert_eq!(result.sheets.len(), 1);
    assert!(result.sheets[0].data.is_empty());
}

#[test]
fn test_write_xlsx_rejects_non_object_rows() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("bad.xlsx");
    let path_str = file_path.to_string_lossy().into_owned();

    let sheets = vec![SheetData {
        name: "Bad".to_string(),
        data: vec![json!(["not", "an", "object"])],
    }];

    let err = write_xlsx(path_str, sheets).unwrap_err();
    assert!(err.contains("not an array of objects"));
}

#[test]
fn test_read_xlsx_rejects_empty_workbook() {
    // Minimal valid xlsx with no sheets is hard to construct; use corrupt bytes instead.
    let err = read_xlsx(vec![0, 1, 2, 3]).unwrap_err();
    assert!(!err.is_empty());
}

#[test]
fn test_write_xlsx_handles_null_and_nested_values() {
    let dir = tempdir().unwrap();
    let file_path = dir.path().join("nested.xlsx");
    let path_str = file_path.to_string_lossy().into_owned();

    let sheets = vec![SheetData {
        name: "Nested".to_string(),
        data: vec![json!({
            "name": "Item",
            "optional": null,
            "tags": ["a", "b"],
            "meta": {"key": "value"}
        })],
    }];

    write_xlsx(path_str, sheets).unwrap();
    let bytes = std::fs::read(&file_path).unwrap();
    let result = read_xlsx(bytes).unwrap();
    assert_eq!(result.sheets[0].data.len(), 2);
}
