import type { Account } from "../api/types";
import { isAssetRow, isAssetSheetName } from "./assets-io";
import {
  getField,
  headerMatchesAlias,
  headerMatchesFieldAlias,
  normalizeKey,
  parseNumericValue,
} from "./spreadsheet-io";

export interface ExportAccount {
  name: string;
  balance: number;
  currency?: string | null;
  kind?: string | null;
}

export interface ImportAccountResult {
  imported: number;
  skipped: number;
  errors: string[];
  created: Account[];
}

export interface XlsxSheet {
  name: string;
  data: unknown[][];
}

const ACCOUNT_SHEET_NAMES = new Set(
  ["accounts", "account", "cuentas"].map((s) => s.toLowerCase()),
);

const ACCOUNT_FIELD_ALIASES = {
  name: ["name", "nombre"],
  balance: ["balance", "saldo"],
  currency: ["currency", "moneda"],
} as const;

/** Column header aliases for transaction import auto-mapping (English + Spanish). */
export const TRANSACTION_FIELD_ALIASES = {
  date: ["date", "fecha"],
  payee: [
    "payee",
    "description",
    "merchant",
    "descripcion",
    "descripción",
    "beneficiario",
  ],
  amount: ["amount", "value", "importe"],
  category: ["category", "categoría", "categoria"],
  notes: ["notes", "note", "memo", "notas", "nota"],
  account: ["account", "acc", "cuenta"],
  ticker: ["ticker", "symbol", "símbolo", "simbolo"],
  shares: ["shares", "quantity", "qty", "acciones", "cantidad"],
  price: ["price", "price_per_share", "precio"],
  fee: ["fee", "commission", "comisión", "comision"],
  currency: ["currency", "curr", "moneda"],
} as const;

export type TransactionImportField = keyof typeof TRANSACTION_FIELD_ALIASES;

export type ImportColumnMapping = Record<TransactionImportField, string>;

const TRANSACTION_SHEET_HINT_FIELDS = [
  "date",
  "payee",
  "amount",
  "category",
] as const satisfies readonly TransactionImportField[];

const TRANSACTION_HEADER_HINTS = TRANSACTION_SHEET_HINT_FIELDS.flatMap(
  (field) => TRANSACTION_FIELD_ALIASES[field],
);

const IMPORT_FIELD_PRIORITY: readonly TransactionImportField[] = [
  "date",
  "payee",
  "amount",
  "category",
  "notes",
  "account",
  "ticker",
  "shares",
  "price",
  "fee",
  "currency",
];

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function sheetHeaders(sheet: XlsxSheet): string[] {
  return sheet.data[0]?.map((h) => asText(h)) ?? [];
}

export function isAccountSheetName(name: string): boolean {
  return ACCOUNT_SHEET_NAMES.has(normalizeKey(name));
}

/** Auto-map spreadsheet column headers to transaction import fields. */
export function autoMapImportColumns(
  columns: string[],
): Partial<ImportColumnMapping> {
  const mapping: Partial<ImportColumnMapping> = {};

  for (const column of columns) {
    for (const field of IMPORT_FIELD_PRIORITY) {
      if (
        headerMatchesFieldAlias(column, TRANSACTION_FIELD_ALIASES[field])
      ) {
        mapping[field] = column;
        break;
      }
    }
  }

  return mapping;
}

export function isAccountRow(headers: string[]): boolean {
  const hasName = headers.some((h) =>
    headerMatchesAlias(h, ACCOUNT_FIELD_ALIASES.name),
  );
  const hasBalance = headers.some((h) =>
    headerMatchesAlias(h, ACCOUNT_FIELD_ALIASES.balance),
  );
  const hasTransactionCol = headers.some((h) => {
    const normalized = normalizeKey(h);
    return TRANSACTION_HEADER_HINTS.some((hint) =>
      normalized.includes(normalizeKey(hint)),
    );
  });
  return hasName && hasBalance && !hasTransactionCol;
}

export function pickTransactionSheet(
  sheets: XlsxSheet[],
): XlsxSheet | undefined {
  const match = sheets.find((sheet) => {
    const headers = sheetHeaders(sheet);
    if (!headers.length) return false;
    if (isAssetSheetName(sheet.name) || isAssetRow(headers)) return false;
    if (isAccountSheetName(sheet.name) || isAccountRow(headers)) return false;
    return true;
  });
  return match ?? sheets[0];
}

export function pickAccountSheet(sheets: XlsxSheet[]): XlsxSheet | undefined {
  return sheets.find((sheet) => {
    const headers = sheetHeaders(sheet);
    return (
      isAccountSheetName(sheet.name) ||
      (headers.length > 0 && isAccountRow(headers))
    );
  });
}

export function parseAccountFromJson(item: unknown): ExportAccount | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = asText(record.name).trim();
  if (!name) return null;

  return {
    name,
    balance: parseNumericValue(record.balance) ?? 0,
    currency: record.currency ? asText(record.currency) : null,
    kind: record.kind ? asText(record.kind) : null,
  };
}

/** Extract accounts from HoneyBear JSON exports. */
export function extractAccountsFromHoneyBearJson(
  parsed: unknown,
): ExportAccount[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  const accounts = (parsed as Record<string, unknown>).accounts;
  if (!Array.isArray(accounts)) return [];

  return accounts
    .map(parseAccountFromJson)
    .filter((account): account is ExportAccount => account !== null);
}

export function parseAccountFromRow(
  row: Record<string, unknown>,
): ExportAccount | null {
  const name = asText(getField(row, "name", "Name", "nombre", "Nombre")).trim();
  if (!name) return null;

  const balance =
    parseNumericValue(getField(row, "balance", "Balance", "saldo", "Saldo")) ??
    0;
  const currencyRaw = getField(row, "currency", "Currency", "moneda", "Moneda");
  const kindRaw = getField(row, "kind", "Kind");

  return {
    name,
    balance,
    currency: currencyRaw ? asText(currencyRaw) : null,
    kind: kindRaw ? asText(kindRaw) : null,
  };
}

type AccountApi = {
  create_account: (args: {
    name: string;
    balance?: number;
    kind?: string;
    currency?: string | null;
  }) => Promise<Account>;
};

export async function importAccounts(
  api: AccountApi,
  accountsToImport: ExportAccount[],
  existingAccounts: Account[] = [],
): Promise<ImportAccountResult> {
  const result: ImportAccountResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    created: [],
  };
  const knownNames = new Set(
    existingAccounts.map((a) => a.name.trim().toLowerCase()),
  );

  for (const account of accountsToImport) {
    const key = account.name.trim().toLowerCase();
    if (knownNames.has(key)) {
      result.skipped++;
      continue;
    }

    try {
      const created = await api.create_account({
        name: account.name,
        balance: account.balance,
        ...(account.kind ? { kind: account.kind } : {}),
        ...(account.currency ? { currency: account.currency } : {}),
      });
      knownNames.add(key);
      result.created.push(created);
      result.imported++;
    } catch (e) {
      result.errors.push(`${account.name}: ${String(e)}`);
    }
  }

  return result;
}
