import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../stores/toast";
import { useNumberFormat } from "../stores/number-format";
import { parseNumberWithLocale } from "../utils/format";
import { parseFileForImport } from "../utils/import-parser";
import { importTransactionsFromRows } from "../utils/import-transactions";
import type {
  FieldMapping,
  ImportError,
  ImportProgress,
} from "../components/shared/import-types";

interface UseImportRunnerOptions {
  onImportComplete: () => void;
  onClose: () => void;
}

export function useImportRunner({
  onImportComplete,
  onClose,
}: UseImportRunnerOptions) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { locale } = useNumberFormat();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [showImportSummary, setShowImportSummary] = useState(false);

  const parseNumber = useCallback(
    (value: unknown) => parseNumberWithLocale(value, locale),
    [locale],
  );

  const runImport = useCallback(
    async (file: File, mapping: FieldMapping) => {
      if (!mapping.account && !file.name.endsWith(".json")) {
        alert(t("error.no_account_mapping"));
        return;
      }

      setImporting(true);
      setShowImportSummary(false);
      setImportErrors([]);

      try {
        const { rows, assets, accounts } = await parseFileForImport(file);
        const result = await importTransactionsFromRows(
          rows,
          mapping,
          assets,
          accounts,
          {
            parseNumber,
            t,
            onProgress: setProgress,
          },
        );

        setImportErrors(result.importErrors);

        const { successCount, failCount } = result;
        const { accountImportSummary, assetImportSummary } = result;

        const accountMsg =
          accountImportSummary.imported > 0
            ? `${String(accountImportSummary.imported)} accounts, `
            : "";
        const assetMsg =
          assetImportSummary.imported > 0
            ? `, ${String(assetImportSummary.imported)} assets imported`
            : "";
        const hasErrors =
          failCount > 0 ||
          assetImportSummary.errors.length > 0 ||
          accountImportSummary.errors.length > 0;

        if (hasErrors) {
          showToast(
            `Import completed: ${accountMsg}${String(successCount)} transactions succeeded, ${String(failCount)} failed${assetMsg}`,
            { type: "error" },
          );
          console.error(
            "Import errors:",
            result.importErrors,
            assetImportSummary.errors,
            accountImportSummary.errors,
          );
        } else {
          showToast(
            `${accountMsg}${String(successCount)} transactions imported${assetMsg}`,
            { type: "success" },
          );
        }

        onImportComplete();
        if (failCount === 0) {
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setShowImportSummary(true);
        }
      } catch (err) {
        console.error("Import failed:", err);
        showToast(String(err), { type: "error" });
      } finally {
        setImporting(false);
      }
    },
    [parseNumber, t, showToast, onImportComplete, onClose],
  );

  return {
    importing,
    progress,
    importErrors,
    showImportSummary,
    runImport,
  };
}
