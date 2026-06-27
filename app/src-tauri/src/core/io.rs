use calamine::{open_workbook_from_rs, Data, Reader, Xlsx};
use rust_xlsxwriter::Workbook;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::Cursor;

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetData {
    pub name: String,
    pub data: Vec<Value>, // Array of objects
}

#[derive(Debug, Serialize)]
pub struct XlsxSheetRows {
    pub name: String,
    pub data: Vec<Vec<Value>>,
}

#[derive(Debug, Serialize)]
pub struct ReadXlsxResult {
    pub data: Vec<Vec<Value>>, // First sheet rows (backward compatibility)
    pub sheets: Vec<XlsxSheetRows>,
}

fn cell_to_value(cell: &Data) -> Value {
    match cell {
        Data::Int(i) => Value::Number(i.to_owned().into()),
        Data::Float(f) => serde_json::Number::from_f64(f.to_owned())
            .map_or(Value::Null, Value::Number),
        Data::String(s) => Value::String(s.clone()),
        Data::Bool(b) => Value::Bool(b.to_owned()),
        Data::DateTime(d) => Value::Number(
            serde_json::Number::from_f64(d.as_f64().to_owned())
                .unwrap_or(serde_json::Number::from(0)),
        ),
        Data::Error(_) | Data::Empty => Value::Null,
        Data::DateTimeIso(d) | Data::DurationIso(d) => Value::String(d.clone()),
    }
}

fn read_sheet_rows(
    workbook: &mut Xlsx<Cursor<Vec<u8>>>,
    sheet_name: &str,
) -> Result<Vec<Vec<Value>>, String> {
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|e: calamine::XlsxError| e.to_string())?;

    let mut rows: Vec<Vec<Value>> = Vec::new();
    for row in range.rows() {
        rows.push(row.iter().map(cell_to_value).collect());
    }
    Ok(rows)
}

/// Tauri command: reads all sheets of an Excel file from raw bytes and returns rows as JSON arrays.
#[tauri::command]
pub fn read_xlsx(data: Vec<u8>) -> Result<ReadXlsxResult, String> {
    let cursor = Cursor::new(data);
    let mut workbook: Xlsx<_> =
        open_workbook_from_rs(cursor).map_err(|e: calamine::XlsxError| e.to_string())?;

    let sheet_names = workbook.sheet_names().clone();
    if sheet_names.is_empty() {
        return Err("No sheets found in workbook".to_string());
    }

    let mut sheets: Vec<XlsxSheetRows> = Vec::new();
    for sheet_name in &sheet_names {
        let rows = read_sheet_rows(&mut workbook, sheet_name)?;
        sheets.push(XlsxSheetRows {
            name: sheet_name.clone(),
            data: rows,
        });
    }

    let data = sheets.first().map(|s| s.data.clone()).unwrap_or_default();

    Ok(ReadXlsxResult { data, sheets })
}

/// Tauri command: writes the given sheets with their data to an Excel file at `file_path`.
#[tauri::command]
pub fn write_xlsx(file_path: String, sheets: Vec<SheetData>) -> Result<(), String> {
    let mut workbook = Workbook::new();

    for sheet_data in sheets {
        let worksheet = workbook.add_worksheet();
        worksheet
            .set_name(&sheet_data.name)
            .map_err(|e| e.to_string())?;

        // If data is empty, just create the sheet
        if sheet_data.data.is_empty() {
            continue;
        }

        // Get headers from the first object
        let first_row = &sheet_data.data[0];
        let headers: Vec<String> = if let Value::Object(map) = first_row {
            map.keys().cloned().collect()
        } else {
            return Err(format!(
                "Data in sheet '{}' is not an array of objects",
                sheet_data.name
            ));
        };

        // Write headers
        for (col, header) in headers.iter().enumerate() {
            worksheet
                .write_string(0, col as u16, header)
                .map_err(|e| e.to_string())?;
        }

        // Write data
        for (row_idx, item) in sheet_data.data.iter().enumerate() {
            if let Value::Object(map) = item {
                for (col, header) in headers.iter().enumerate() {
                    if let Some(val) = map.get(header) {
                        match val {
                            Value::Null => {} // Do nothing (empty)
                            Value::Bool(b) => {
                                worksheet
                                    .write_boolean((row_idx + 1) as u32, col as u16, *b)
                                    .map_err(|e| e.to_string())?;
                            }
                            Value::Number(n) => {
                                if let Some(f) = n.as_f64() {
                                    worksheet
                                        .write_number((row_idx + 1) as u32, col as u16, f)
                                        .map_err(|e| e.to_string())?;
                                }
                            }
                            Value::String(s) => {
                                worksheet
                                    .write_string((row_idx + 1) as u32, col as u16, s)
                                    .map_err(|e| e.to_string())?;
                            }
                            Value::Array(_) | Value::Object(_) => {
                                worksheet
                                    .write_string((row_idx + 1) as u32, col as u16, val.to_string())
                                    .map_err(|e| e.to_string())?;
                            }
                        }
                    }
                }
            }
        }
    }

    workbook.save(&file_path).map_err(|e| e.to_string())?;

    Ok(())
}
