import { useState } from "react";
import PropTypes from "prop-types";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { t } from "../../i18n/i18n";
import "../../styles/Modal.css";
import "../../styles/ExportModal.css";
import { formatNumberForExport } from "../../utils/format";
import { useToast } from "../../contexts/toast";

export default function ExportModal({ onClose }) {
  const [format, setFormat] = useState("json");
  const [exporting, setExporting] = useState(false);
  // Toast API (safe noop provided by useToast when provider missing)
  const { showToast } = useToast();

  const handleExport = async () => {
    try {
      setExporting(true);

      // 1. Fetch Data
      const accounts = await invoke("get_accounts");
      const transactions = await invoke("get_all_transactions");

      // 2. Prepare Data based on format
      let content;
      let defaultPath = `honeybear_export_${new Date().toISOString().split("T")[0]}`;
      let filters = [];

      if (format === "json") {
        // Replace transaction account IDs with account names for easier interoperability
        const transactionsWithAccountNames = transactions.map((tx) => {
          const acc = accounts.find((a) => a.id === tx.account_id);
          const { account_id, ...rest } = tx;
          return {
            ...rest,
            account: acc ? acc.name : account_id,
          };
        });

        const data = {
          accounts,
          transactions: transactionsWithAccountNames,
          exportDate: new Date().toISOString(),
        };
        content = JSON.stringify(data, null, 2);
        defaultPath += ".json";
        filters = [{ name: "JSON", extensions: ["json"] }];
      } else if (format === "csv") {
        // Flatten transactions for CSV — ensure numeric fields use dot decimal separator
        const headers = [
          t("import.field.date"),
          t("import.field.account"),
          t("import.field.payee"),
          t("import.field.category"),
          t("import.field.amount"),
          t("import.field.notes"),
          t("import.field.ticker"),
          t("import.field.shares"),
          t("import.field.price"),
          t("import.field.fee"),
          t("import.field.currency"),
        ];
        const rows = transactions.map((t) => {
          const acc = accounts.find((a) => a.id === t.account_id);
          const values = [
            t.date,
            acc ? acc.name : t.account_id,
            t.payee,
            t.category,
            formatNumberForExport(t.amount),
            t.notes,
            t.ticker,
            formatNumberForExport(t.shares),
            formatNumberForExport(t.price_per_share),
            formatNumberForExport(t.fee),
            t.currency || "",
          ];
          return values
            .map((v) => {
              const s = v === null || v === undefined ? "" : String(v);
              const escaped = s.replace(/"/g, '""');
              return /[,"\n]/.test(escaped) ? `"${escaped}"` : escaped;
            })
            .join(",");
        });
        content = [headers.join(","), ...rows].join("\n");
        defaultPath += ".csv";
        filters = [{ name: t("export.format.csv"), extensions: ["csv"] }];
      } else if (format === "xlsx") {
        defaultPath += ".xlsx";
        filters = [{ name: t("export.format.xlsx"), extensions: ["xlsx"] }];
      }

      // 3. Open Save Dialog
      const filePath = await save({
        defaultPath,
        filters,
      });

      if (!filePath) {
        setExporting(false);
        return; // User cancelled
      }

      // 4. Write File
      if (format === "xlsx") {
        // Prepare data structure for Rust backend
        const coerceNumber = (v) => {
          if (v === null || v === undefined || v === "") return null;
          if (typeof v === "number") return v;
          const s = formatNumberForExport(v);
          const n = Number(s);
          return Number.isNaN(n) ? v : n;
        };

        const txData = transactions.map((tx) => {
          const acc = accounts.find((a) => a.id === tx.account_id);
          return {
            [t("import.field.date")]: tx.date,
            [t("import.field.account")]: acc ? acc.name : tx.account_id,
            [t("import.field.payee")]: tx.payee,
            [t("import.field.category")]: tx.category,
            [t("import.field.amount")]: coerceNumber(tx.amount),
            [t("import.field.notes")]: tx.notes,
            [t("import.field.ticker")]: tx.ticker,
            [t("import.field.shares")]: coerceNumber(tx.shares),
            [t("import.field.price")]: coerceNumber(tx.price_per_share),
            [t("import.field.fee")]: coerceNumber(tx.fee),
            [t("import.field.currency")]: tx.currency || "",
          };
        });

        const sheets = [
            { name: "Transactions", data: txData },
            { name: "Accounts", data: accounts }
        ];

        await invoke("write_xlsx", { filePath, sheets });
      } else {
        await writeTextFile(filePath, content);
      }

      // Show success toast and close modal
      try {
        // Some OS APIs may return a path object; make sure we stringify sensibly
        const filePathStr =
          typeof filePath === "string" ? filePath : JSON.stringify(filePath);

        if (showToast) {
          showToast(t("export.success_saved", { path: filePathStr }), {
            type: "success",
          });
        } else {
          // Fallback when toast system isn't available
          alert(t("export.success_saved", { path: filePathStr }));
        }

        onClose();
      } catch (e) {
        console.error("Export failed:", e);
        if (showToast) {
          showToast(t("export.failed", { error: String(e) }), {
            type: "error",
          });
        } else {
          alert(t("export.failed", { error: String(e) }));
        }
      } finally {
        setExporting(false);
      }
    } catch (e) {
      console.error("Export failed:", e);
      if (showToast) {
        showToast(t("export.failed", { error: String(e) }), { type: "error" });
      } else {
        alert(t("export.failed", { error: String(e) }));
      }
    } finally {
      // Ensure exporting flag is cleared even if an outer error occurs
      setExporting(false);
    }
  };

  // If SSR or tests, avoid touching document
  if (typeof document === "undefined") return null;
  return (
    <Modal onClose={onClose}>
      <ModalHeader
        onClose={onClose}
        title={t("export.title")}
        icon={Download}
      />
      <ModalBody>
        <label className="modal-label">{t("export.select_format")}</label>
        <div className="format-grid">
          <button
            onClick={() => setFormat("json")}
            className={`format-button ${
              format === "json"
                ? "format-button-active"
                : "format-button-inactive"
            }`}
          >
            <FileJson className="w-6 h-6 mb-2" />
            <span className="text-xs font-medium">
              {t("export.format.json")}
            </span>
          </button>
          <button
            onClick={() => setFormat("csv")}
            className={`format-button ${
              format === "csv"
                ? "format-button-active"
                : "format-button-inactive"
            }`}
          >
            <FileText className="w-6 h-6 mb-2" />
            <span className="text-xs font-medium">
              {t("export.format.csv")}
            </span>
          </button>
          <button
            onClick={() => setFormat("xlsx")}
            className={`format-button ${
              format === "xlsx"
                ? "format-button-active"
                : "format-button-inactive"
            }`}
          >
            <FileSpreadsheet className="w-6 h-6 mb-2" />
            <span className="text-xs font-medium">
              {t("export.format.xlsx")}
            </span>
          </button>
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          className="btn-secondary"
          disabled={exporting}
        >
          {t("account.cancel")}
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary"
        >
          <span className="text-white">
            {exporting
              ? t("export.exporting")
              : t("export.select_location_export")}
          </span>
        </button>
      </ModalFooter>
    </Modal>
  );
}

ExportModal.propTypes = {
  onClose: PropTypes.func.isRequired,
};
