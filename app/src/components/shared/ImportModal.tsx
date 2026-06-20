import { useState, useRef, useEffect, useCallback } from "react";
import { rust } from "../../api/tauri-client";
import { listen } from "@tauri-apps/api/event";
import { Download, FileSpreadsheet } from "lucide-react";
import "../../styles/Modal.css";
import "../../styles/Settings.css";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
// @ts-expect-error papaparse has no type declarations
import Papa from "papaparse";
import { parseNumberWithLocale } from "../../utils/format";
import { useTranslation } from "react-i18next";
import { useToast } from "../../contexts/toast";
import { getMimeType } from "./import-types";
import type {
  ImportModalProps,
  FieldMapping,
  ImportProgress,
  ImportError,
  Account,
} from "./import-types";
import FileDropZone from "./FileDropZone";
import ColumnMappingStep from "./ColumnMappingStep";
import {
  extractAccountsFromHoneyBearJson,
  importAccounts,
  parseAccountFromRow,
  pickAccountSheet,
  pickTransactionSheet,
  type ExportAccount,
} from "../../utils/accounts-io";
import {
  extractAssetsFromHoneyBearJson,
  importAssets,
  isAssetRow,
  isAssetSheetName,
  parseAssetFromRow,
  rowsFromSheetData,
  type ExportAsset,
} from "../../utils/assets-io";
import type { AssetWithLatestValue } from "../../api/types";

export default function ImportModal({
  onClose,
  onImportComplete,
}: ImportModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({
    date: "",
    payee: "",
    amount: "",
    category: "",
    notes: "",
    account: "",
    ticker: "",
    shares: "",
    price: "",
    fee: "",
    currency: "",
  });

  /* Modal JSX moved to end of function to avoid referencing refs/state before initialization */

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState(0); // 0 = select file, 1 = map/review
  const { showToast } = useToast();

  // Import result details for user review
  const [importErrorsState, setImportErrorsState] = useState<ImportError[]>([]);
  const [showImportSummary, setShowImportSummary] = useState(false);

  const autoMapColumns = useCallback((cols: string[]) => {
    setMapping((prevMapping) => {
      const newMapping = { ...prevMapping };
      cols.forEach((col) => {
        const lower = col.toLowerCase();
        if (lower.includes("date")) newMapping.date = col;
        else if (
          lower.includes("payee") ||
          lower.includes("description") ||
          lower.includes("merchant")
        )
          newMapping.payee = col;
        else if (lower.includes("amount") || lower.includes("value"))
          newMapping.amount = col;
        else if (lower.includes("category")) newMapping.category = col;
        else if (lower.includes("note") || lower.includes("memo"))
          newMapping.notes = col;
        else if (lower.includes("account") || lower.includes("acc"))
          newMapping.account = col;
        else if (lower.includes("ticker") || lower.includes("symbol"))
          newMapping.ticker = col;
        else if (
          lower.includes("shares") ||
          lower.includes("quantity") ||
          lower.includes("qty")
        )
          newMapping.shares = col;
        else if (lower.includes("price")) newMapping.price = col;
        else if (lower.includes("fee") || lower.includes("commission"))
          newMapping.fee = col;
        else if (lower.includes("currency") || lower === "curr")
          newMapping.currency = col;
      });
      return newMapping;
    });
  }, []);

  const parseFile = useCallback(
    (file: File) => {
      // Reset previous parse state
      setParseError(null);
      setPreviewRows([]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target!.result;

        if (file.name.endsWith(".csv")) {
          Papa.parse(data as string, {
            header: true,
            skipEmptyLines: true,
            complete: (results: {
              meta: { fields?: string[] };
              data: Record<string, unknown>[];
            }) => {
              setColumns(results.meta.fields || []);
              setPreviewRows((results.data || []).slice(0, 5));
              autoMapColumns(results.meta.fields || []);
            },
          });
        } else if (file.name.endsWith(".json")) {
          try {
            const parsed = JSON.parse(data as string);
            let rows = [];

            if (Array.isArray(parsed)) {
              rows = parsed;
            } else if (
              parsed.transactions &&
              Array.isArray(parsed.transactions)
            ) {
              rows = parsed.transactions;
            } else if (parsed.data && Array.isArray(parsed.data)) {
              rows = parsed.data;
            } else {
              // Unsupported JSON shape
              setColumns([]);
              setPreviewRows([]);
              setParseError(t("import.error.unsupported_json_structure"));
              autoMapColumns([]);
              return;
            }

            // Collect union of keys as columns
            const cols: string[] = Array.from(
              rows.reduce((acc: Set<string>, row: Record<string, unknown>) => {
                Object.keys(row || {}).forEach((k: string) => acc.add(k));
                return acc;
              }, new Set<string>()),
            );

            setColumns(cols);
            setPreviewRows(rows.slice(0, 5) as Record<string, unknown>[]);
            setParseError(null);
            autoMapColumns(cols);
          } catch (e: unknown) {
            console.error("Failed to parse JSON import file:", e);
            setParseError(
              t("import.error.failed_parse_json", {
                error: e instanceof Error ? e.message : String(e),
              }),
            );
            setColumns([]);
            setPreviewRows([]);
          }
        } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          try {
            const arrayBuffer = e.target!.result as ArrayBuffer;
            const bytes = Array.from(new Uint8Array(arrayBuffer));
            const result = (await rust.read_xlsx({ data: bytes })) as {
              data: unknown[][];
              sheets?: { name: string; data: unknown[][] }[];
            };

            const sheets = result.sheets ?? [
              { name: "Sheet1", data: result.data },
            ];
            const transactionSheet = pickTransactionSheet(sheets);

            if (transactionSheet?.data?.length) {
              const rows = rowsFromSheetData(transactionSheet.data);
              const strHeaders = Object.keys(rows[0] ?? {});
              setColumns(strHeaders);
              setPreviewRows(rows.slice(0, 5));
              autoMapColumns(strHeaders);
            }
          } catch (err: unknown) {
            console.error("Failed to parse XLSX:", err);
            setParseError("Failed to parse Excel file: " + String(err));
          }
        }
      };

      if (file.name.endsWith(".csv") || file.name.endsWith(".json")) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    },
    [autoMapColumns, t],
  );

  // Handle file dropped via Tauri's native drag-drop (receives file path)
  const handleFileFromPath = useCallback(
    async (filePath: string) => {
      try {
        // Import Tauri's file system API
        const { readFile } = await import("@tauri-apps/plugin-fs");

        // Read the file contents as bytes
        const contents = await readFile(filePath);

        // Extract file name from path
        const fileName = filePath.split(/[\\/]/).pop() ?? "file";

        // Create a File object from the contents
        const blob = new Blob([contents]);
        const fileObj = new File([blob], fileName, {
          type: getMimeType(fileName),
        });

        setFile(fileObj);
        parseFile(fileObj);
      } catch (err: unknown) {
        console.error("Failed to read dropped file:", err);
        setParseError(
          t("import.error.failed_read_dropped", {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    },
    [parseFile, t],
  );

  useEffect(() => {
    // Fetch accounts on mount
    rust
      .get_accounts()
      .then((data) => setAccounts(data as Account[]))
      .catch(console.error);

    // Prevent background from scrolling while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Listen for Tauri's native file drop events (works reliably on Linux)
    let unlistenDrop: (() => void) | null = null;
    let unlistenHover: (() => void) | null = null;
    let unlistenLeave: (() => void) | null = null;

    const setupListeners = async () => {
      // Listen for file drop
      unlistenDrop = await listen("tauri://drag-drop", (event) => {
        const payload = event.payload as { paths?: string[] };
        const paths = payload?.paths;
        if (paths && paths.length > 0) {
          const filePath = paths[0];
          // Check if it's a supported file type
          const validExtensions = [".csv", ".xlsx", ".xls", ".json"];
          const hasValidExtension = validExtensions.some((ext) =>
            filePath.toLowerCase().endsWith(ext),
          );
          if (hasValidExtension) {
            // Read the file from the path using fetch with file:// protocol
            handleFileFromPath(filePath);
          }
        }
        setIsDragging(false);
      });

      // Listen for drag hover (file is being dragged over window)
      unlistenHover = await listen("tauri://drag-over", () => {
        setIsDragging(true);
      });

      // Listen for drag leave
      unlistenLeave = await listen("tauri://drag-leave", () => {
        setIsDragging(false);
      });
    };

    setupListeners();

    return () => {
      // Restore previous overflow setting on unmount
      document.body.style.overflow = prevOverflow || "";
      // Cleanup Tauri event listeners
      if (unlistenDrop) unlistenDrop();
      if (unlistenHover) unlistenHover();
      if (unlistenLeave) unlistenLeave();
    };
  }, [handleFileFromPath]);

  // Browser-based drag event handlers (works on Linux GNOME)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Ensure the drop effect is shown
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the drop zone entirely
    // Check if we're leaving to a child element
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      const fileName = droppedFile.name.toLowerCase();
      const validExtensions = [".csv", ".xlsx", ".xls", ".json"];
      const hasValidExtension = validExtensions.some((ext) =>
        fileName.endsWith(ext),
      );

      if (hasValidExtension) {
        setFile(droppedFile);
        parseFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const handleImport = async () => {
    // Require that an account column is indicated (CSV/XLSX) or JSON includes account fields.
    // Use optional chaining so the check is safe when `file` is null and avoids patterns that trigger CodeQL.
    if (!mapping.account && !file?.name?.endsWith(".json")) {
      alert(t("error.no_account_mapping"));
      return;
    }

    setImporting(true);

    // Re-parse full file to get all data
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target!.result;
      let allRows: Record<string, unknown>[] = [];
      let jsonAssets: ExportAsset[] = [];
      let jsonAccounts: ExportAccount[] = [];
      let xlsxAssetRows: Record<string, unknown>[] = [];
      let xlsxAccounts: ExportAccount[] = [];

      if (file!.name.endsWith(".csv")) {
        Papa.parse(data as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results: { data: Record<string, unknown>[] }) => {
            allRows = results.data;
            processRows(allRows, jsonAssets, jsonAccounts);
          },
        });
      } else if (file!.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(data as string);
          if (Array.isArray(parsed)) {
            allRows = parsed;
          } else if (
            parsed.transactions &&
            Array.isArray(parsed.transactions)
          ) {
            allRows = parsed.transactions;
          } else if (parsed.data && Array.isArray(parsed.data)) {
            allRows = parsed.data;
          } else {
            allRows = [];
          }

          jsonAssets = extractAssetsFromHoneyBearJson(parsed);
          jsonAccounts = extractAccountsFromHoneyBearJson(parsed);
        } catch (e) {
          console.error("Failed to parse JSON import file:", e);
          allRows = [];
        }
        processRows(allRows, jsonAssets, jsonAccounts);
      } else if (file!.name.endsWith(".xlsx") || file!.name.endsWith(".xls")) {
        try {
          const arrayBuffer = e.target!.result as ArrayBuffer;
          const bytes = Array.from(new Uint8Array(arrayBuffer));
          const result = (await rust.read_xlsx({ data: bytes })) as {
            data: unknown[][];
            sheets?: { name: string; data: unknown[][] }[];
          };

          const sheets = result.sheets ?? [
            { name: "Sheet1", data: result.data },
          ];
          const transactionSheet = pickTransactionSheet(sheets);

          if (transactionSheet?.data?.length) {
            allRows = rowsFromSheetData(transactionSheet.data);
          }

          const accountSheet = pickAccountSheet(sheets);
          if (accountSheet?.data?.length) {
            xlsxAccounts = rowsFromSheetData(accountSheet.data)
              .map(parseAccountFromRow)
              .filter((account): account is ExportAccount => account !== null);
          }

          const assetSheet = sheets.find(
            (sheet) =>
              isAssetSheetName(sheet.name) ||
              isAssetRow(
                (sheet.data[0] as unknown[] | undefined)?.map((h) =>
                  String(h ?? ""),
                ) ?? [],
              ),
          );
          if (assetSheet?.data?.length) {
            xlsxAssetRows = rowsFromSheetData(assetSheet.data);
          }
        } catch (err) {
          console.error("Failed to parse XLSX during import:", err);
          // We'll proceed with empty rows which will finish quickly with 0/0
        }

        const xlsxAssets = xlsxAssetRows
          .map(parseAssetFromRow)
          .filter((asset): asset is ExportAsset => asset !== null);
        processRows(
          allRows,
          [...jsonAssets, ...xlsxAssets],
          [...jsonAccounts, ...xlsxAccounts],
        );
      }
    };

    if (file!.name.endsWith(".csv") || file!.name.endsWith(".json")) {
      reader.readAsText(file!);
    } else {
      reader.readAsArrayBuffer(file!);
    }
  };

  const processRows = async (
    rows: Record<string, unknown>[],
    assetsToImport: ExportAsset[] = [],
    accountsToImport: ExportAccount[] = [],
  ) => {
    let successCount = 0;
    let failCount = 0;
    const importErrors: ImportError[] = [];

    setProgress({ current: 0, total: rows.length, success: 0, failed: 0 });

    let assetImportSummary = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };
    if (assetsToImport.length > 0) {
      try {
        const existingAssets =
          (await rust.get_assets()) as AssetWithLatestValue[];
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

    // Fetch fresh accounts from DB so we don't rely on stale React state.
    let localAccounts: Account[] = (await rust.get_accounts()) as Account[];

    if (accountsToImport.length > 0) {
      try {
        const importResult = await importAccounts(
          rust,
          accountsToImport,
          localAccounts,
        );
        accountImportSummary = importResult;
        localAccounts = [...localAccounts, ...(importResult.created as Account[])];
      } catch (e) {
        accountImportSummary.errors.push(String(e));
      }
    }

    // Group rows by account identifier to determine account type before creation
    const rowsByAccount = new Map<
      string,
      { identifier: unknown; rows: Record<string, unknown>[] }
    >();
    const rowIndices = new Map<Record<string, unknown>, number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const mappedAccountValue = mapping.account
        ? row[mapping.account]
        : undefined;
      const accountField =
        mappedAccountValue ??
        row.account_id ??
        row.accountId ??
        row.account ??
        row.account_name ??
        row.accountName;

      if (accountField) {
        const key =
          typeof accountField === "string"
            ? accountField.trim().toLowerCase()
            : String(accountField);
        if (!rowsByAccount.has(key)) {
          rowsByAccount.set(key, { identifier: accountField, rows: [] });
        }
        rowsByAccount.get(key)!.rows.push(row);
        if (!rowIndices.has(row)) rowIndices.set(row, i);
      } else {
        // Rows without account info
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
      let accountId: number | null = null;

      if (identifier !== null) {
        if (typeof identifier === "number") {
          accountId = identifier;
        } else if (!isNaN(parseInt(String(identifier)))) {
          accountId = parseInt(String(identifier));
        } else if (typeof identifier === "string") {
          const name = identifier.trim();
          // Do a case-insensitive, trimmed comparison to avoid duplicates
          let match = localAccounts.find(
            (a) => a.name && a.name.trim().toLowerCase() === name.toLowerCase(),
          );
          if (!match) {
            // Determine account kind: scan ALL rows in this group
            let isBrokerage = false;
            for (const row of groupRows) {
              // Check mapped fields
              if (
                mapping.ticker &&
                row[mapping.ticker] &&
                String(row[mapping.ticker]).trim() !== ""
              ) {
                isBrokerage = true;
                break;
              }
              if (
                mapping.shares &&
                row[mapping.shares] &&
                String(row[mapping.shares]).trim() !== ""
              ) {
                isBrokerage = true;
                break;
              }
              // Check heuristics
              const keys = Object.keys(row || {});
              for (const k of keys) {
                const lowerKey = String(k).toLowerCase();
                if (
                  [
                    "ticker",
                    "shares",
                    "symbol",
                    "quantity",
                    "price_per_share",
                  ].some((s) => lowerKey.includes(s))
                ) {
                  const val = row[k];
                  if (
                    val !== undefined &&
                    val !== null &&
                    String(val).trim() !== ""
                  ) {
                    isBrokerage = true;
                    break;
                  }
                }
              }
              if (isBrokerage) break;
            }

            const kind = isBrokerage ? "brokerage" : "cash";
            try {
              const created = await rust.create_account({
                name,
                balance: 0.0,
                kind,
              });
              // push to local cache (we'll update React state after the import completes)
              localAccounts.push(created as Account);
              match = created as Account;
            } catch (e) {
              console.error("Failed to create account for import:", e);
              // Fail all rows for this account
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
          if (match) accountId = match.id;
        }
      }

      for (const row of groupRows) {
        const i = rowIndices.get(row) ?? 0;
        try {
          if (!accountId) throw new Error(t("import.error.no_account_for_row"));

          const dateStr = row[mapping.date];
          const amountStr = row[mapping.amount];
          const payee = row[mapping.payee] || t("import.unknown_payee");

          // Robust date parsing: try JS Date, then attempt common dd/mm/yyyy or dd-mm-yyyy forms, otherwise fallback to today
          let date;
          if (dateStr === undefined || dateStr === null || dateStr === "") {
            date = new Date().toISOString().split("T")[0];
          } else {
            const parsedDate = new Date(String(dateStr));
            if (isNaN(parsedDate.getTime())) {
              // Try to normalize common separators and formats
              const normalized = String(dateStr)
                .replace(/\./g, "/")
                .replace(/-/g, "/");
              const parts = normalized.split("/");
              let altDate = null;
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  // yyyy/mm/dd
                  altDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
                } else {
                  // dd/mm/yyyy -> yyyy-mm-dd
                  altDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }
              }
              if (altDate && !isNaN(altDate.getTime())) {
                date = altDate.toISOString().split("T")[0];
              } else {
                console.warn(`Invalid date for row ${i}:`, dateStr);
                date = new Date().toISOString().split("T")[0];
              }
            } else {
              date = parsedDate.toISOString().split("T")[0];
            }
          }

          // Amount parsing — import files are read using American format (dot as decimal separator)
          let amount = parseNumberWithLocale(amountStr, "en-US");
          if (isNaN(amount)) amount = 0;

          // Brokerage fields
          let ticker: unknown = mapping.ticker
            ? row[mapping.ticker]
            : row.ticker || row.symbol || row.Ticker || row.Symbol;
          let shares: unknown = mapping.shares
            ? row[mapping.shares]
            : row.shares ||
              row.quantity ||
              row.qty ||
              row.Shares ||
              row.Quantity;
          let price: unknown = mapping.price
            ? row[mapping.price]
            : row.price || row.price_per_share || row.Price;
          let fee: unknown = mapping.fee
            ? row[mapping.fee]
            : row.fee || row.commission || row.Fee;

          let currency = mapping.currency
            ? row[mapping.currency]
            : row.currency ||
              row.Currency ||
              row.curr ||
              row.currency_code ||
              row.currencyCode ||
              null;

          if (typeof shares === "string")
            shares = parseNumberWithLocale(shares, "en-US");
          if (typeof price === "string")
            price = parseNumberWithLocale(price, "en-US");
          if (typeof fee === "string")
            fee = parseNumberWithLocale(fee, "en-US");

          if (typeof shares === "number" && isNaN(shares)) shares = null;
          if (typeof price === "number" && isNaN(price)) price = null;
          if (typeof fee === "number" && isNaN(fee)) fee = null;
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
              currency: currency ? String(currency) : null,
            },
          });
          successCount++;
        } catch (e) {
          console.error(`Row ${i} import failed:`, e);
          importErrors.push({ row: i, error: String(e) });
          failCount++;
        }
        processedCount++;
        setProgress({
          current: processedCount,
          total: rows.length,
          success: successCount,
          failed: failCount,
        });
      }
    }

    // Update React state to include any accounts we created during the import
    setAccounts(localAccounts);

    setImporting(false);
    setImportErrorsState(importErrors);

    if (showToast) {
      const accountMsg =
        accountImportSummary.imported > 0
          ? `${accountImportSummary.imported} accounts, `
          : "";
      const assetMsg =
        assetImportSummary.imported > 0
          ? `, ${assetImportSummary.imported} assets imported`
          : "";
      const hasErrors =
        failCount > 0 ||
        assetImportSummary.errors.length > 0 ||
        accountImportSummary.errors.length > 0;
      if (hasErrors) {
        showToast(
          `Import completed: ${accountMsg}${successCount} transactions succeeded, ${failCount} failed${assetMsg}`,
          { type: "error" },
        );
        console.error(
          "Import errors:",
          importErrors,
          assetImportSummary.errors,
          accountImportSummary.errors,
        );
      } else {
        showToast(
          `${accountMsg}${successCount} transactions imported${assetMsg}`,
          { type: "success" },
        );
      }
    }

    // Always refresh app data so created accounts/transactions appear, but keep modal open
    // when some rows failed so the user can inspect errors.
    onImportComplete();
    if (failCount === 0) {
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setShowImportSummary(true);
    }
  };

  // derived helper used by the Start Import button (keeps conditional concise & clear)
  const canStartImport = Boolean(
    file && (mapping.account || file?.name?.endsWith(".json")) && !importing,
  );

  // If SSR or tests, avoid touching document
  if (typeof document === "undefined") return null;

  return (
    <Modal
      onClose={onClose}
      size="4xl"
      className="!p-0 flex flex-col overflow-hidden max-h-[90vh]"
    >
      <div className="p-6 pb-0">
        <ModalHeader
          onClose={onClose}
          title={t("import.title")}
          icon={Download}
        />
      </div>

      <ModalBody className="overflow-y-auto flex-1 px-6">
        {!file ? (
          <FileDropZone
            file={file}
            isDragging={isDragging}
            dropZoneRef={dropZoneRef}
            fileInputRef={fileInputRef}
            handleDragEnter={handleDragEnter}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handleFileChange={handleFileChange}
          />
        ) : step === 1 ? (
          <ColumnMappingStep
            file={file}
            columns={columns}
            mapping={mapping}
            setMapping={setMapping}
            setFile={setFile}
            previewRows={previewRows}
            parseError={parseError}
            importing={importing}
            progress={progress}
            showImportSummary={showImportSummary}
            importErrors={importErrorsState}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-green-500" />
                <span className="text-slate-900 dark:text-white font-medium">
                  {file.name}
                </span>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setStep(0);
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-red-400 text-sm"
              >
                {t("import.change_file")}
              </button>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
              {t("import.file_loaded_review") ||
                "File loaded — click Next to review mappings and preview"}
            </div>
          </div>
        )}
      </ModalBody>

      <div className="px-6 pb-6 pt-0">
        <ModalFooter className="mt-0 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={importing}
          >
            {t("account.cancel")}
          </button>

          {step === 0 ? (
            <button
              onClick={() => setStep(1)}
              disabled={!file}
              className="btn-primary"
            >
              <span className="text-white">{t("import.next") || "Next"}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setStep(0)}
                disabled={importing}
                className="btn-secondary"
              >
                {t("import.back") || "Back"}
              </button>

              <button
                onClick={handleImport}
                disabled={!canStartImport}
                className="btn-primary"
              >
                <span className="text-white">
                  {importing ? t("import.importing") : t("import.start_import")}
                </span>
              </button>
            </>
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
}
