import { rust } from "../api/tauri-client";
import type { Account } from "../api/types";
import type {
  FieldMapping,
  ImportError,
  ImportProgress,
} from "../components/shared/import-types";
import { importAccounts, type ExportAccount } from "./accounts-io";
import { importAssets, type ExportAsset } from "./assets-io";
import { asText } from "./import-parser";

export interface TransactionImportCallbacks {
  parseNumber: (value: unknown) => number;
  t: (key: string, options?: Record<string, unknown>) => string;
  onProgress: (progress: ImportProgress) => void;
}

export interface TransactionImportResult {
  successCount: number;
  failCount: number;
  importErrors: ImportError[];
  accountImportSummary: {
    imported: number;
    skipped: number;
    errors: string[];
  };
  assetImportSummary: {
    imported: number;
    skipped: number;
    errors: string[];
  };
}

function parseImportDate(dateStr: unknown): string {
  if (dateStr === undefined || dateStr === null || dateStr === "") {
    return new Date().toISOString().split("T")[0]!;
  }

  const parsedDate = new Date(asText(dateStr));
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().split("T")[0]!;
  }

  const normalized = asText(dateStr).replace(/\./g, "/").replace(/-/g, "/");
  const parts = normalized.split("/");
  if (parts.length === 3) {
    const [p0, p1, p2] = parts;
    if (p0 && p1 && p2) {
      const altDate =
        p0.length === 4
          ? new Date(`${p0}-${p1}-${p2}`)
          : new Date(`${p2}-${p1}-${p0}`);
      if (!isNaN(altDate.getTime())) {
        return altDate.toISOString().split("T")[0]!;
      }
    }
  }

  console.warn(`Invalid date:`, dateStr);
  return new Date().toISOString().split("T")[0]!;
}

function rowLooksLikeBrokerage(
  row: Record<string, unknown>,
  mapping: FieldMapping,
): boolean {
  if (
    mapping.ticker &&
    row[mapping.ticker] &&
    asText(row[mapping.ticker]).trim() !== ""
  ) {
    return true;
  }
  if (
    mapping.shares &&
    row[mapping.shares] &&
    asText(row[mapping.shares]).trim() !== ""
  ) {
    return true;
  }

  for (const k of Object.keys(row)) {
    const lowerKey = k.toLowerCase();
    if (
      ["ticker", "shares", "symbol", "quantity", "price_per_share"].some((s) =>
        lowerKey.includes(s),
      )
    ) {
      const val = row[k];
      if (val !== undefined && val !== null && asText(val).trim() !== "") {
        return true;
      }
    }
  }

  return false;
}

function getAccountField(
  row: Record<string, unknown>,
  mapping: FieldMapping,
): unknown {
  const mappedAccountValue = mapping.account ? row[mapping.account] : undefined;
  return (
    mappedAccountValue ??
    row.account_id ??
    row.accountId ??
    row.account ??
    row.account_name ??
    row.accountName
  );
}

function parseOptionalNumber(
  value: unknown,
  parseNumber: (value: unknown) => number,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const parsed = parseNumber(value);
  return isNaN(parsed) ? null : parsed;
}

export async function importTransactionsFromRows(
  rows: Record<string, unknown>[],
  mapping: FieldMapping,
  assetsToImport: ExportAsset[],
  accountsToImport: ExportAccount[],
  callbacks: TransactionImportCallbacks,
): Promise<TransactionImportResult> {
  const { parseNumber, t, onProgress } = callbacks;

  let successCount = 0;
  let failCount = 0;
  const importErrors: ImportError[] = [];

  onProgress({ current: 0, total: rows.length, success: 0, failed: 0 });

  let assetImportSummary = {
    imported: 0,
    skipped: 0,
    errors: [] as string[],
  };
  if (assetsToImport.length > 0) {
    try {
      const existingAssets = await rust.get_assets();
      assetImportSummary = await importAssets(
        rust,
        assetsToImport,
        existingAssets,
      );
    } catch (e) {
      assetImportSummary.errors.push(String(e));
    }
  }

  let accountImportSummary = {
    imported: 0,
    skipped: 0,
    errors: [] as string[],
  };

  let localAccounts: Account[] = await rust.get_accounts();

  if (accountsToImport.length > 0) {
    try {
      const importResult = await importAccounts(
        rust,
        accountsToImport,
        localAccounts,
      );
      accountImportSummary = importResult;
      localAccounts = [...localAccounts, ...importResult.created];
    } catch (e) {
      accountImportSummary.errors.push(String(e));
    }
  }

  const rowsByAccount = new Map<
    string,
    { identifier: unknown; rows: Record<string, unknown>[] }
  >();
  const rowIndices = new Map<Record<string, unknown>, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const accountField = getAccountField(row, mapping);

    if (accountField) {
      const key =
        typeof accountField === "string"
          ? accountField.trim().toLowerCase()
          : asText(accountField);
      if (!rowsByAccount.has(key)) {
        rowsByAccount.set(key, { identifier: accountField, rows: [] });
      }
      rowsByAccount.get(key)!.rows.push(row);
      if (!rowIndices.has(row)) rowIndices.set(row, i);
    } else {
      const key = "undefined_account";
      if (!rowsByAccount.has(key)) {
        rowsByAccount.set(key, { identifier: null, rows: [] });
      }
      rowsByAccount.get(key)!.rows.push(row);
      if (!rowIndices.has(row)) rowIndices.set(row, i);
    }
  }

  let processedCount = 0;

  for (const [, group] of rowsByAccount) {
    const { identifier, rows: groupRows } = group;
    let accountId: number | string | null = null;

    if (identifier !== null) {
      if (typeof identifier === "number") {
        accountId = identifier;
      } else if (!isNaN(parseInt(asText(identifier)))) {
        accountId = parseInt(asText(identifier));
      } else if (typeof identifier === "string") {
        const name = identifier.trim();
        let match = localAccounts.find(
          (a) => a.name && a.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (!match) {
          const isBrokerage = groupRows.some((row) =>
            rowLooksLikeBrokerage(row, mapping),
          );
          const kind = isBrokerage ? "brokerage" : "cash";
          try {
            const created = await rust.create_account({
              name,
              balance: 0.0,
              kind,
            });
            localAccounts.push(created);
            match = created;
          } catch (e) {
            console.error("Failed to create account for import:", e);
            for (const row of groupRows) {
              const idx = rowIndices.get(row) ?? 0;
              importErrors.push({
                row: idx,
                error: `Failed to create account '${name}': ${String(e)}`,
              });
              failCount++;
              processedCount++;
            }
            continue;
          }
        }
        accountId = match.id;
      }
    }

    for (const row of groupRows) {
      const i = rowIndices.get(row) ?? 0;
      try {
        if (!accountId) throw new Error(t("import.error.no_account_for_row"));

        const date = parseImportDate(row[mapping.date]);
        const amountStr = row[mapping.amount];
        const payee = row[mapping.payee] || t("import.unknown_payee");

        let amount = parseNumber(amountStr);
        if (isNaN(amount)) amount = 0;

        let ticker: unknown = mapping.ticker
          ? row[mapping.ticker]
          : row.ticker || row.symbol || row.Ticker || row.Symbol;
        let shares: unknown = mapping.shares
          ? row[mapping.shares]
          : row.shares || row.quantity || row.qty || row.Shares || row.Quantity;
        let price: unknown = mapping.price
          ? row[mapping.price]
          : row.price || row.price_per_share || row.Price;
        let fee: unknown = mapping.fee
          ? row[mapping.fee]
          : row.fee || row.commission || row.Fee;

        const currency = mapping.currency
          ? row[mapping.currency]
          : row.currency ||
            row.Currency ||
            row.curr ||
            row.currency_code ||
            row.currencyCode ||
            null;

        shares = parseOptionalNumber(shares, parseNumber);
        price = parseOptionalNumber(price, parseNumber);
        fee = parseOptionalNumber(fee, parseNumber);
        if (!ticker) ticker = null;

        await rust.create_transaction({
          args: {
            accountId,
            date,
            payee,
            notes: row[mapping.notes] || "",
            category: row[mapping.category] || t("general.uncategorized"),
            amount,
            ticker,
            shares,
            pricePerShare: price,
            fee,
            currency: currency ? asText(currency) : null,
          },
        });
        successCount++;
      } catch (e) {
        console.error(`Row ${String(i)} import failed:`, e);
        importErrors.push({ row: i, error: String(e) });
        failCount++;
      }
      processedCount++;
      onProgress({
        current: processedCount,
        total: rows.length,
        success: successCount,
        failed: failCount,
      });
    }
  }

  return {
    successCount,
    failCount,
    importErrors,
    accountImportSummary,
    assetImportSummary,
  };
}
