import { AlertCircle, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import CustomSelect from "../ui/CustomSelect";
import SelectedFileBar from "./SelectedFileBar";
import type { FieldMapping, ImportProgress, ImportError } from "./import-types";

interface ColumnMappingStepProps {
  file: File;
  columns: string[];
  mapping: FieldMapping;
  setMapping: React.Dispatch<React.SetStateAction<FieldMapping>>;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  previewRows: Record<string, unknown>[];
  parseError: string | null;
  importing: boolean;
  progress: ImportProgress;
  showImportSummary: boolean;
  importErrors: ImportError[];
}

export default function ColumnMappingStep({
  file,
  columns,
  mapping,
  setMapping,
  setFile,
  previewRows,
  parseError,
  importing,
  progress,
  showImportSummary,
  importErrors,
}: ColumnMappingStepProps) {
  const { t } = useTranslation();
  const firstPreviewRow = previewRows[0];

  const toDisplayValue = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return "";
  };

  return (
    <div className="space-y-6">
      <SelectedFileBar
        fileName={file.name}
        onChangeFile={() => {
          setFile(null);
        }}
      />

      <div className="mb-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("import.indicate_account_column")}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {t("import.map_columns")}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {t("import.be_sure_map_account")}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(mapping).map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1 capitalize">
                {t(`import.field.${field}`)}
              </label>
              <div className="relative">
                <CustomSelect
                  value={mapping[field as keyof FieldMapping]}
                  onChange={(v) => {
                    setMapping({ ...mapping, [field]: v });
                  }}
                  options={[
                    { value: "", label: t("import.skip") },
                    ...columns.map((col) => ({
                      value: col,
                      label: col,
                    })),
                  ]}
                  placeholder={t("import.select_column")}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {t("import.preview")}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t("import.showing_first_rows")}
          </span>
        </div>

        {parseError ? (
          <p className="text-sm text-red-500">{parseError}</p>
        ) : previewRows.length > 0 && firstPreviewRow ? (
          <div className="overflow-x-auto bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 p-2 mt-2">
            <table className="w-full min-w-full text-sm table-auto">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  {Object.keys(firstPreviewRow).map((h) => (
                    <th
                      key={h}
                      className="text-left pr-4 text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800 odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800"
                  >
                    {Object.keys(firstPreviewRow).map((h) => (
                      <td
                        key={h}
                        className="pr-4 text-slate-900 dark:text-white whitespace-normal break-words"
                      >
                        {toDisplayValue(r[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("import.no_preview")}</p>
        )}
      </div>

      {importing && (
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-700 dark:text-slate-300">
              {t("import.importing")}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: progress.total
                  ? `${String((progress.current / progress.total) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> {progress.success}{" "}
              {t("import.success")}
            </span>
            <span className="text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {progress.failed}
              {t("import.failed")}
            </span>
          </div>
        </div>
      )}

      {showImportSummary && importErrors.length > 0 && (
        <div className="mt-4 p-4 rounded bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
          <h3 className="text-sm font-semibold mb-2">
            {t("import.error_summary") || "Import errors"}
          </h3>
          <p className="text-xs mb-2">
            {t("import.error_summary_instructions") ||
              "Some rows failed to import. Review the first errors below and fix your file or retry."}
          </p>
          <div className="max-h-40 overflow-auto text-sm">
            <ul>
              {importErrors.map((err, idx) => (
                <li key={idx} className="mb-1">
                  <span className="font-semibold">Row {err.row + 1}:</span>{" "}
                  {err.error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
