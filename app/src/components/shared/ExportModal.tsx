import { useState, useEffect, useMemo } from "react";
import { rust } from "../../api/tauri-client";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import type { Day } from "date-fns";
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileDown,
} from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import CustomSelect from "../ui/CustomSelect";
import { useTranslation } from "react-i18next";
import "../../styles/Modal.css";
import "../../styles/ExportModal.css";
import { formatNumberForExport, getDatePickerFormat } from "../../utils/format";
import { useToast } from "../../stores/toast";
import { useNumberFormat } from "../../stores/number-format";
import { computeReportData } from "../../utils/report";
import { handleAsyncError, logError } from "../../utils/errors";
import { buildHoldingsFromTransactions } from "../../utils/investments";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_FIELD_LABELS,
  fetchAssetsForExport,
  toLegacyJsonAsset,
} from "../../utils/assets-io";
import type { Account, StockQuote } from "../../api/types";

function accountToExportRow(account: Account): Record<string, unknown> {
  return {
    id: account.id,
    name: account.name,
    balance: account.balance,
    totalValue: account.totalValue,
    currency: account.currency,
    kind: account.kind,
    exchange_rate: account.exchange_rate,
  };
}

interface DailyPrice {
  date: string;
  price: number;
}

interface ExchangeRateEntry {
  currency?: string;
  rate: number;
}

interface ExportModalProps {
  onClose: () => void;
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState("json");
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();

  // PDF time range state
  const [rangeType, setRangeType] = useState("ytd"); // "ytd", "annual", "month", "custom"
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthYear, setSelectedMonthYear] = useState(
    new Date().getFullYear(),
  );
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(
    new Date().getMonth(),
  );
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
  );
  const [customEndDate, setCustomEndDate] = useState(new Date());

  // Fetch transaction dates on mount to derive available years/months
  const [transactionDates, setTransactionDates] = useState<string[]>([]);
  useEffect(() => {
    rust
      .get_all_transactions()
      .then((txs) => {
        const dates = txs.map((tx) => tx.date).filter(Boolean);
        setTransactionDates(dates);
      })
      .catch((e) => {
        logError("Failed to fetch transaction dates for export", e);
      });
  }, []);

  const { dateFormat, firstDayOfWeek, currency: appCurrency } = useNumberFormat();

  // Compute the effective date range for the PDF export
  const pdfDateRange = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;

    if (rangeType === "annual") {
      start = new Date(selectedYear, 0, 1);
      end =
        selectedYear === now.getFullYear()
          ? now
          : new Date(selectedYear, 11, 31);
    } else if (rangeType === "month") {
      start = new Date(selectedMonthYear, selectedMonthIndex, 1);
      end = new Date(selectedMonthYear, selectedMonthIndex + 1, 0); // last day of month
      if (end > now) end = now;
    } else if (rangeType === "ytd") {
      start = new Date(now.getFullYear(), 0, 1);
      end = now;
    } else {
      start = customStartDate;
      end = customEndDate;
    }

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }, [
    rangeType,
    selectedYear,
    selectedMonthYear,
    selectedMonthIndex,
    customStartDate,
    customEndDate,
  ]);

  // Available years derived from actual transaction data
  const availableYears = useMemo(() => {
    if (transactionDates.length === 0) {
      return [new Date().getFullYear()];
    }
    const years = [
      ...new Set(transactionDates.map((d) => Number(d.slice(0, 4)))),
    ];
    years.sort((a, b) => b - a);
    return years;
  }, [transactionDates]);

  // Month names
  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }),
    );
  }, []);

  // Available months for the selected year — only months that have transactions
  const availableMonths = useMemo(() => {
    const now = new Date();
    const prefix = String(selectedMonthYear);
    const monthsWithTxs = [
      ...new Set(
        transactionDates
          .filter((d) => d.startsWith(prefix))
          .map((d) => Number(d.slice(5, 7)) - 1),
      ),
    ].sort((a, b) => a - b);

    // Cap at current month if current year
    const maxMonth =
      selectedMonthYear === now.getFullYear() ? now.getMonth() : 11;
    const filtered = monthsWithTxs.filter((m) => m <= maxMonth);

    if (filtered.length === 0) {
      return [{ index: now.getMonth(), label: monthNames[now.getMonth()] }];
    }
    return filtered.map((i) => ({ index: i, label: monthNames[i] }));
  }, [selectedMonthYear, monthNames, transactionDates]);

  const handleExport = async () => {
    try {
      setExporting(true);

      // 1. Fetch Data
      const accounts = await rust.get_accounts();
      const transactions = await rust.get_all_transactions();
      const assets = await fetchAssetsForExport(rust);

      // 2. Prepare Data based on format
      let content: string | undefined;
      let defaultPath = `honeybear_export_${new Date().toISOString().split("T")[0]}`;
      let filters: { name: string; extensions: string[] }[] = [];

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
          assets: assets.map(toLegacyJsonAsset),
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
      } else if (format === "pdf") {
        defaultPath = `honeybear_report_${pdfDateRange.start}_${pdfDateRange.end}`;
        defaultPath += ".pdf";
        filters = [{ name: t("export.format.pdf"), extensions: ["pdf"] }];
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
        const coerceNumber = (v: unknown) => {
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

        const assetData = assets.map((a) => {
          const latest = a.valuations.length
            ? [...a.valuations].sort((x, y) => y.date.localeCompare(x.date))[0]
            : null;
          return {
            [ASSET_FIELD_LABELS.name]: a.name,
            [ASSET_FIELD_LABELS.category]:
              ASSET_CATEGORY_LABELS[
                a.category as keyof typeof ASSET_CATEGORY_LABELS
              ] ?? a.category,
            [ASSET_FIELD_LABELS.currency]: a.currency || "",
            [ASSET_FIELD_LABELS.value]: latest
              ? coerceNumber(latest.value)
              : null,
            [ASSET_FIELD_LABELS.date]: latest?.date || "",
            [ASSET_FIELD_LABELS.notes]: a.notes || "",
          };
        });

        const sheets: { name: string; data: Record<string, unknown>[] }[] = [
          { name: "Transactions", data: txData },
          { name: "Accounts", data: accounts.map(accountToExportRow) },
          { name: t("assets.title"), data: assetData },
        ];

        await rust.write_xlsx({ filePath, sheets });
      } else if (format === "pdf") {
        // Fetch exchange rates
        const exchangeRates: Record<
          string,
          { map: Record<string, number>; list: DailyPrice[] }
        > = {};

        try {
          const allRates = await rust.get_all_exchange_rates({
            appCurrency,
          });
          if (Array.isArray(allRates)) {
            for (const entry of allRates as ExchangeRateEntry[]) {
              if (!entry.currency || entry.currency === appCurrency) continue;
              const pair = `${entry.currency}${appCurrency}=X`;
              // Try to fetch historical daily prices for this currency pair
              let dailyPrices: DailyPrice[] = [];
              try {
                dailyPrices = (await rust.get_daily_stock_prices({
                  ticker: pair,
                })) as DailyPrice[];
              } catch (e) {
                logError(
                  `Optional daily prices for ${entry.currency} PDF export`,
                  e,
                );
              }
              const map: Record<string, number> = {};
              const list: DailyPrice[] = [];
              if (Array.isArray(dailyPrices) && dailyPrices.length > 0) {
                dailyPrices.forEach((dp: DailyPrice) => {
                  map[dp.date] = dp.price;
                  list.push({ date: dp.date, price: dp.price });
                });
              }
              // Add the current custom rate as a fallback
              if (entry.rate > 0) {
                const today = new Date().toISOString().slice(0, 10);
                map[today] = entry.rate;
                list.push({ date: today, price: entry.rate });
                // Also add an early date so historical lookups always have a fallback
                if (
                  !list.some((p: DailyPrice) => p.date <= pdfDateRange.start)
                ) {
                  map["1970-01-01"] = entry.rate;
                  list.unshift({ date: "1970-01-01", price: entry.rate });
                }
              }
              if (list.length > 0) {
                exchangeRates[pair] = { map, list };
              }
            }
          }
        } catch (e) {
          logError("Optional exchange rates fetch for PDF export", e);
        }

        // Fetch stock quotes if user has investments
        let quotes: StockQuote[] = [];
        try {
          const { currentHoldings } =
            await buildHoldingsFromTransactions(transactions);
          if (currentHoldings.length > 0) {
            const tickers = [...new Set(currentHoldings.map((h) => h.ticker))];
            quotes = await rust.get_stock_quotes({ tickers });
          }
        } catch (e) {
          logError("Optional stock quotes fetch for PDF export", e);
        }

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

        const reportData = await computeReportData({
          accounts,
          transactions,
          startDate: pdfDateRange.start,
          endDate: pdfDateRange.end,
          appCurrency,
          exchangeRates,
          quotes,
          labels: reportLabels,
        });

        await rust.generate_pdf_report({
          filePath,
          data: reportData,
        });
      } else {
        await writeTextFile(filePath, content!);
      }

      const filePathStr =
        typeof filePath === "string" ? filePath : JSON.stringify(filePath);

      showToast(t("export.success_saved", { path: filePathStr }), {
        type: "success",
      });

      onClose();
    } catch (e) {
      handleAsyncError({
        context: "Export failed",
        error: e,
        userMessage: t("error.operation_failed"),
        toast: (message) => showToast(message, { type: "error" }),
      });
    } finally {
      setExporting(false);
    }
  };

  // If SSR or tests, avoid touching document
  if (typeof document === "undefined") return null;
  return (
    <Modal onClose={onClose}>
      <ModalHeader onClose={onClose} title={t("export.title")} icon={Upload} />
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
          <button
            onClick={() => setFormat("pdf")}
            className={`format-button ${
              format === "pdf"
                ? "format-button-active"
                : "format-button-inactive"
            }`}
          >
            <FileDown className="w-6 h-6 mb-2" />
            <span className="text-xs font-medium">
              {t("export.format.pdf")}
            </span>
          </button>
        </div>

        {/* PDF Time Range Selector */}
        {format === "pdf" && (
          <div className="pdf-range-section">
            <label className="modal-label">{t("export.pdf.time_range")}</label>

            {/* Range type dropdown */}
            <CustomSelect
              value={rangeType}
              onChange={(v) => setRangeType(String(v))}
              options={[
                { value: "ytd", label: t("export.pdf.ytd") },
                { value: "annual", label: t("export.pdf.annual") },
                { value: "month", label: t("export.pdf.month") },
                { value: "custom", label: t("export.pdf.custom") },
              ]}
            />

            {/* Annual: year picker */}
            {rangeType === "annual" && (
              <div className="pdf-sub-select">
                <label className="pdf-sub-label">
                  {t("export.pdf.select_year")}
                </label>
                <CustomSelect
                  value={selectedYear}
                  onChange={(v) => setSelectedYear(Number(v))}
                  options={availableYears.map((yr) => ({
                    value: yr,
                    label: String(yr),
                  }))}
                />
              </div>
            )}

            {/* Monthly: year + month pickers */}
            {rangeType === "month" && (
              <div className="pdf-sub-select">
                <label className="pdf-sub-label">
                  {t("export.pdf.select_year")}
                </label>
                <CustomSelect
                  value={selectedMonthYear}
                  onChange={(v) => {
                    const yr = Number(v);
                    setSelectedMonthYear(yr);
                    // Reset month if not available for the new year
                    const now = new Date();
                    if (
                      yr === now.getFullYear() &&
                      selectedMonthIndex > now.getMonth()
                    ) {
                      setSelectedMonthIndex(now.getMonth());
                    }
                  }}
                  options={availableYears.map((yr) => ({
                    value: yr,
                    label: String(yr),
                  }))}
                />
                <label className="pdf-sub-label mt-2">
                  {t("export.pdf.select_month")}
                </label>
                <CustomSelect
                  value={selectedMonthIndex}
                  onChange={(v) => setSelectedMonthIndex(Number(v))}
                  options={availableMonths.map((m) => ({
                    value: m.index,
                    label: m.label,
                  }))}
                />
              </div>
            )}

            {/* Custom: date pickers */}
            {rangeType === "custom" && (
              <div className="pdf-sub-select">
                <label className="pdf-sub-label">
                  {t("export.pdf.start_date")}
                </label>
                <DatePicker
                  selected={customStartDate}
                  onChange={(date: Date | null) => {
                    if (date) {
                      setCustomStartDate(date);
                      if (date > customEndDate) setCustomEndDate(date);
                    }
                  }}
                  selectsStart
                  startDate={customStartDate}
                  endDate={customEndDate}
                  maxDate={new Date()}
                  showPopperArrow={false}
                  portalId="datepicker-portal"
                  popperPlacement="bottom-start"
                  dateFormat={getDatePickerFormat(dateFormat)}
                  calendarStartDay={firstDayOfWeek as Day}
                  className="pdf-date-input"
                />
                <label className="pdf-sub-label mt-2">
                  {t("export.pdf.end_date")}
                </label>
                <DatePicker
                  selected={customEndDate}
                  onChange={(date: Date | null) => {
                    if (date) setCustomEndDate(date);
                  }}
                  selectsEnd
                  startDate={customStartDate}
                  endDate={customEndDate}
                  minDate={customStartDate}
                  maxDate={new Date()}
                  showPopperArrow={false}
                  portalId="datepicker-portal"
                  popperPlacement="bottom-start"
                  dateFormat={getDatePickerFormat(dateFormat)}
                  calendarStartDay={firstDayOfWeek as Day}
                  className="pdf-date-input"
                />
              </div>
            )}

            {/* Date range preview */}
            <div className="pdf-range-preview">
              {pdfDateRange.start} — {pdfDateRange.end}
            </div>
          </div>
        )}
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
              ? format === "pdf"
                ? t("export.pdf.generating")
                : t("export.exporting")
              : t("export.select_location_export")}
          </span>
        </button>
      </ModalFooter>
    </Modal>
  );
}
