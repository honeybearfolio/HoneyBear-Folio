import Papa from "papaparse";
import { rust } from "../api/tauri-client";
import { logError } from "./errors";
import {
  extractAccountsFromHoneyBearJson,
  parseAccountFromRow,
  pickAccountSheet,
  pickTransactionSheet,
  type ExportAccount,
} from "./accounts-io";
import {
  extractAssetsFromHoneyBearJson,
  isAssetRow,
  isAssetSheetName,
  parseAssetFromRow,
  type ExportAsset,
} from "./assets-io";
import {
  extractLiabilitiesFromHoneyBearJson,
  isLiabilityRow,
  isLiabilitySheetName,
  parseLiabilityFromRow,
  type ExportLiability,
} from "./liabilities-io";
import { rowsFromSheetData } from "./spreadsheet-io";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function getJsonRows(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(isRecord);
  }
  if (!isRecord(parsed)) {
    return [];
  }

  const txs = parsed.transactions;
  if (Array.isArray(txs)) {
    return txs.filter(isRecord);
  }

  const data = parsed.data;
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  return [];
}

export function collectColumnsFromRows(
  rows: Record<string, unknown>[],
): string[] {
  return Array.from(
    rows.reduce((acc: Set<string>, row: Record<string, unknown>) => {
      Object.keys(row).forEach((k: string) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );
}

export interface ImportParsePreview {
  columns: string[];
  previewRows: Record<string, unknown>[];
  parseError: string | null;
}

export interface ImportParseResult {
  rows: Record<string, unknown>[];
  assets: ExportAsset[];
  liabilities: ExportLiability[];
  accounts: ExportAccount[];
}

export function parseCsvText(text: string): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const results = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const columns = results.meta.fields ?? [];
  return { columns, rows: results.data };
}

export function parseCsvPreview(text: string): ImportParsePreview {
  const { columns, rows } = parseCsvText(text);
  return {
    columns,
    previewRows: rows.slice(0, 5),
    parseError: null,
  };
}

export function parseJsonPreview(
  text: string,
  unsupportedStructureMessage: string,
): ImportParsePreview {
  try {
    const parsed: unknown = JSON.parse(text);
    const rows = getJsonRows(parsed);

    if (rows.length === 0) {
      return {
        columns: [],
        previewRows: [],
        parseError: unsupportedStructureMessage,
      };
    }

    const columns = collectColumnsFromRows(rows);
    return {
      columns,
      previewRows: rows.slice(0, 5),
      parseError: null,
    };
  } catch (e: unknown) {
    return {
      columns: [],
      previewRows: [],
      parseError: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function parseXlsxPreview(
  buffer: ArrayBuffer,
  failedParseMessage: (error: string) => string,
): Promise<ImportParsePreview> {
  try {
    const bytes = Array.from(new Uint8Array(buffer));
    const result = await rust.read_xlsx({ data: bytes });

    const sheets = result.sheets ?? [{ name: "Sheet1", data: result.data }];
    const transactionSheet = pickTransactionSheet(sheets);

    if (transactionSheet && transactionSheet.data.length > 0) {
      const rows = rowsFromSheetData(transactionSheet.data);
      const columns = Object.keys(rows[0] ?? {});
      return {
        columns,
        previewRows: rows.slice(0, 5),
        parseError: null,
      };
    }

    return { columns: [], previewRows: [], parseError: null };
  } catch (err: unknown) {
    logError("Failed to parse XLSX", err);
    return {
      columns: [],
      previewRows: [],
      parseError: failedParseMessage(
        err instanceof Error ? err.message : String(err),
      ),
    };
  }
}

export function parseJsonForImport(text: string): ImportParseResult {
  try {
    const parsed: unknown = JSON.parse(text);
    return {
      rows: getJsonRows(parsed),
      assets: extractAssetsFromHoneyBearJson(parsed),
      liabilities: extractLiabilitiesFromHoneyBearJson(parsed),
      accounts: extractAccountsFromHoneyBearJson(parsed),
    };
  } catch (e) {
    logError("Failed to parse JSON import file", e);
    return { rows: [], assets: [], liabilities: [], accounts: [] };
  }
}

export async function parseXlsxForImport(
  buffer: ArrayBuffer,
): Promise<ImportParseResult> {
  try {
    const bytes = Array.from(new Uint8Array(buffer));
    const result = await rust.read_xlsx({ data: bytes });

    const sheets = result.sheets ?? [{ name: "Sheet1", data: result.data }];
    const transactionSheet = pickTransactionSheet(sheets);

    let rows: Record<string, unknown>[] = [];
    if (transactionSheet && transactionSheet.data.length > 0) {
      rows = rowsFromSheetData(transactionSheet.data);
    }

    const accountSheet = pickAccountSheet(sheets);
    const accounts =
      accountSheet && accountSheet.data.length > 0
        ? rowsFromSheetData(accountSheet.data)
            .map(parseAccountFromRow)
            .filter((account): account is ExportAccount => account !== null)
        : [];

    const assetSheet = sheets.find(
      (sheet) =>
        isAssetSheetName(sheet.name) ||
        isAssetRow(sheet.data[0]?.map((h) => asText(h)) ?? []),
    );
    const assets =
      assetSheet && assetSheet.data.length > 0
        ? rowsFromSheetData(assetSheet.data)
            .map(parseAssetFromRow)
            .filter((asset): asset is ExportAsset => asset !== null)
        : [];

    const liabilitySheet = sheets.find(
      (sheet) =>
        isLiabilitySheetName(sheet.name) ||
        isLiabilityRow(sheet.data[0]?.map((h) => asText(h)) ?? []),
    );
    const liabilities =
      liabilitySheet && liabilitySheet.data.length > 0
        ? rowsFromSheetData(liabilitySheet.data)
            .map(parseLiabilityFromRow)
            .filter(
              (liability): liability is ExportLiability => liability !== null,
            )
        : [];

    return { rows, assets, liabilities, accounts };
  } catch (err) {
    logError("Failed to parse XLSX during import", err);
    return { rows: [], assets: [], liabilities: [], accounts: [] };
  }
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text();
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export async function parseFilePreview(
  file: File,
  messages: {
    unsupportedJsonStructure: string;
    failedParseJson: (error: string) => string;
    failedParseExcel: (error: string) => string;
  },
): Promise<ImportParsePreview> {
  if (file.name.endsWith(".csv")) {
    const text = await readFileAsText(file);
    return parseCsvPreview(text);
  }

  if (file.name.endsWith(".json")) {
    const text = await readFileAsText(file);
    const preview = parseJsonPreview(text, messages.unsupportedJsonStructure);
    if (preview.parseError && preview.columns.length === 0) {
      // Distinguish parse errors from unsupported structure
      try {
        JSON.parse(text);
      } catch (e: unknown) {
        return {
          columns: [],
          previewRows: [],
          parseError: messages.failedParseJson(
            e instanceof Error ? e.message : String(e),
          ),
        };
      }
    }
    return preview;
  }

  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const buffer = await readFileAsArrayBuffer(file);
    return parseXlsxPreview(buffer, messages.failedParseExcel);
  }

  return { columns: [], previewRows: [], parseError: null };
}

export async function parseFileForImport(
  file: File,
): Promise<ImportParseResult> {
  if (file.name.endsWith(".csv")) {
    const text = await readFileAsText(file);
    const { rows } = parseCsvText(text);
    return { rows, assets: [], liabilities: [], accounts: [] };
  }

  if (file.name.endsWith(".json")) {
    const text = await readFileAsText(file);
    return parseJsonForImport(text);
  }

  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const buffer = await readFileAsArrayBuffer(file);
    return parseXlsxForImport(buffer);
  }

  return { rows: [], assets: [], liabilities: [], accounts: [] };
}
