import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../stores/toast";
import { useNumberFormat } from "../stores/number-format";
import { handleAsyncError } from "../utils/errors";
import {
  buildAndWriteExport,
  type ExportFormat,
} from "../utils/spreadsheet-export";
import type { PdfDateRange } from "./usePdfExportRange";

interface UseSpreadsheetExportOptions {
  onClose: () => void;
  pdfDateRange: PdfDateRange;
}

export function useSpreadsheetExport({
  onClose,
  pdfDateRange,
}: UseSpreadsheetExportOptions) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currency: appCurrency } = useNumberFormat();
  const [exporting, setExporting] = useState(false);

  const exportSpreadsheet = useCallback(
    async (format: ExportFormat) => {
      try {
        setExporting(true);

        const labels = {
          date: t("import.field.date"),
          account: t("import.field.account"),
          payee: t("import.field.payee"),
          category: t("import.field.category"),
          amount: t("import.field.amount"),
          notes: t("import.field.notes"),
          ticker: t("import.field.ticker"),
          shares: t("import.field.shares"),
          price: t("import.field.price"),
          fee: t("import.field.fee"),
          currency: t("import.field.currency"),
          assetsTitle: t("assets.title"),
          csvFormat: t("export.format.csv"),
          xlsxFormat: t("export.format.xlsx"),
          pdfFormat: t("export.format.pdf"),
        };

        const reportLabels = {
          title: t("report.title"),
          financial_summary: t("report.financial_summary"),
          net_worth_evolution: t("report.net_worth_evolution"),
          income_vs_expenses: t("report.income_vs_expenses"),
          expense_breakdown: t("report.expense_breakdown"),
          income_breakdown: t("report.income_breakdown"),
          cash_flow_summary: t("report.cash_flow_summary"),
          investment_holdings: t("report.investment_holdings"),
          transactions_title: t("report.transactions"),
          net_worth: t("report.net_worth"),
          total_income: t("report.total_income"),
          total_expenses: t("report.total_expenses"),
          net_savings: t("report.net_savings"),
          savings_rate: t("report.savings_rate"),
          accounts: t("settings.accounts"),
          account: t("report.account"),
          currency: t("report.currency"),
          cash_balance: t("report.cash_balance"),
          market_value: t("report.market_value"),
          total: t("report.total"),
          category: t("report.category"),
          amount: t("report.amount"),
          percentage: t("report.percentage"),
          month: t("report.month"),
          income: t("report.income"),
          expenses: t("report.expenses"),
          net: t("report.net"),
          investments: t("report.investments"),
          surplus: t("report.surplus"),
          deficit: t("report.deficit"),
          ticker: t("report.ticker"),
          shares: t("report.shares"),
          price: t("report.price"),
          value: t("report.value"),
          cost_basis: t("report.cost_basis"),
          roi: t("report.roi"),
          date: t("report.date"),
          payee: t("report.payee"),
          notes: t("report.notes"),
          fee: t("report.fee"),
          page: t("report.page"),
          no_transactions: t("report.no_transactions"),
          portfolio_total: t("report.portfolio_total"),
          overall_roi: t("report.overall_roi"),
        };

        const filePath = await buildAndWriteExport({
          format,
          labels,
          reportLabels,
          pdfDateRange,
          appCurrency,
        });

        if (!filePath) return;

        showToast(t("export.success_saved", { path: filePath }), {
          type: "success",
        });
        onClose();
      } catch (e) {
        handleAsyncError({
          context: "Export failed",
          error: e,
          userMessage: t("error.operation_failed"),
          toast: (message) => {
            showToast(message, { type: "error" });
          },
        });
      } finally {
        setExporting(false);
      }
    },
    [appCurrency, onClose, pdfDateRange, showToast, t],
  );

  return { exporting, exportSpreadsheet };
}
