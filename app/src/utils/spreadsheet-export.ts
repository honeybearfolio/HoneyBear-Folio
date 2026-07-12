import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { rust } from "../api/tauri-client";
import type { Account, StockQuote } from "../api/types";
import { formatNumberForExport } from "./format";
import { computeReportData } from "./report";
import { logError } from "./errors";
import { buildHoldingsFromTransactions } from "./investments";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_FIELD_LABELS,
  fetchAssetsForExport,
  toLegacyJsonAsset,
} from "./assets-io";
import type { PdfDateRange } from "../hooks/usePdfExportRange";

interface DailyPrice {
  date: string;
  price: number;
}

interface ExchangeRateEntry {
  currency?: string;
  rate: number;
}

export type ExportFormat = "json" | "csv" | "xlsx" | "pdf";

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

function coerceExportNumber(v: unknown): number | string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const s = formatNumberForExport(v);
  const n = Number(s);
  return Number.isNaN(n) ? s : n;
}

function escapeCsvValue(v: unknown): string {
  const s =
    typeof v === "string"
      ? v
      : typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : "";
  const escaped = s.replace(/"/g, '""');
  return /[,"\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export interface ExportLabels {
  date: string;
  account: string;
  payee: string;
  category: string;
  amount: string;
  notes: string;
  ticker: string;
  shares: string;
  price: string;
  fee: string;
  currency: string;
  assetsTitle: string;
  csvFormat: string;
  xlsxFormat: string;
  pdfFormat: string;
}

export interface ReportLabels {
  title: string;
  financial_summary: string;
  net_worth_evolution: string;
  income_vs_expenses: string;
  expense_breakdown: string;
  income_breakdown: string;
  cash_flow_summary: string;
  investment_holdings: string;
  transactions_title: string;
  net_worth: string;
  total_income: string;
  total_expenses: string;
  net_savings: string;
  savings_rate: string;
  accounts: string;
  account: string;
  currency: string;
  cash_balance: string;
  market_value: string;
  total: string;
  category: string;
  amount: string;
  percentage: string;
  month: string;
  income: string;
  expenses: string;
  net: string;
  investments: string;
  surplus: string;
  deficit: string;
  ticker: string;
  shares: string;
  price: string;
  value: string;
  cost_basis: string;
  roi: string;
  date: string;
  payee: string;
  notes: string;
  fee: string;
  page: string;
  no_transactions: string;
  portfolio_total: string;
  overall_roi: string;
}

interface BuildExportPayloadOptions {
  format: ExportFormat;
  labels: ExportLabels;
  reportLabels: ReportLabels;
  pdfDateRange: PdfDateRange;
  appCurrency: string;
}

export async function buildAndWriteExport({
  format,
  labels,
  reportLabels,
  pdfDateRange,
  appCurrency,
}: BuildExportPayloadOptions): Promise<string | null> {
  const accounts = await rust.get_accounts();
  const transactions = await rust.get_all_transactions();
  const assets = await fetchAssetsForExport(rust);

  let content: string | undefined;
  const isoDate = new Date().toISOString().split("T")[0] ?? "";
  let defaultPath = `honeybear_export_${isoDate}`;
  let filters: { name: string; extensions: string[] }[];

  if (format === "json") {
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
    const headers = [
      labels.date,
      labels.account,
      labels.payee,
      labels.category,
      labels.amount,
      labels.notes,
      labels.ticker,
      labels.shares,
      labels.price,
      labels.fee,
      labels.currency,
    ];
    const rows = transactions.map((tx) => {
      const acc = accounts.find((a) => a.id === tx.account_id);
      const values = [
        tx.date,
        acc ? acc.name : tx.account_id,
        tx.payee,
        tx.category,
        formatNumberForExport(tx.amount),
        tx.notes,
        tx.ticker,
        formatNumberForExport(tx.shares),
        formatNumberForExport(tx.price_per_share),
        formatNumberForExport(tx.fee),
        tx.currency || "",
      ];
      return values.map(escapeCsvValue).join(",");
    });
    content = [headers.join(","), ...rows].join("\n");
    defaultPath += ".csv";
    filters = [{ name: labels.csvFormat, extensions: ["csv"] }];
  } else if (format === "xlsx") {
    defaultPath += ".xlsx";
    filters = [{ name: labels.xlsxFormat, extensions: ["xlsx"] }];
  } else {
    defaultPath = `honeybear_report_${pdfDateRange.start}_${pdfDateRange.end}`;
    defaultPath += ".pdf";
    filters = [{ name: labels.pdfFormat, extensions: ["pdf"] }];
  }

  const filePath = await save({ defaultPath, filters });
  if (!filePath) return null;

  if (format === "xlsx") {
    const txData = transactions.map((tx) => {
      const acc = accounts.find((a) => a.id === tx.account_id);
      return {
        [labels.date]: tx.date,
        [labels.account]: acc ? acc.name : tx.account_id,
        [labels.payee]: tx.payee,
        [labels.category]: tx.category,
        [labels.amount]: coerceExportNumber(tx.amount),
        [labels.notes]: tx.notes,
        [labels.ticker]: tx.ticker,
        [labels.shares]: coerceExportNumber(tx.shares),
        [labels.price]: coerceExportNumber(tx.price_per_share),
        [labels.fee]: coerceExportNumber(tx.fee),
        [labels.currency]: tx.currency || "",
      };
    });

    const assetData = assets.map((a) => {
      const categoryLabel = Object.prototype.hasOwnProperty.call(
        ASSET_CATEGORY_LABELS,
        a.category,
      )
        ? ASSET_CATEGORY_LABELS[
            a.category as keyof typeof ASSET_CATEGORY_LABELS
          ]
        : a.category;
      const latest = a.valuations.length
        ? [...a.valuations].sort((x, y) => y.date.localeCompare(x.date))[0]
        : null;
      return {
        [ASSET_FIELD_LABELS.name]: a.name,
        [ASSET_FIELD_LABELS.category]: categoryLabel,
        [ASSET_FIELD_LABELS.currency]: a.currency || "",
        [ASSET_FIELD_LABELS.value]: latest
          ? coerceExportNumber(latest.value)
          : null,
        [ASSET_FIELD_LABELS.date]: latest?.date || "",
        [ASSET_FIELD_LABELS.notes]: a.notes || "",
      };
    });

    const sheets: { name: string; data: Record<string, unknown>[] }[] = [
      { name: "Transactions", data: txData },
      { name: "Accounts", data: accounts.map(accountToExportRow) },
      { name: labels.assetsTitle, data: assetData },
    ];

    await rust.write_xlsx({ filePath, sheets });
  } else if (format === "pdf") {
    const exchangeRates: Record<
      string,
      { map: Record<string, number>; list: DailyPrice[] }
    > = {};

    try {
      const allRates = await rust.get_all_exchange_rates({ appCurrency });
      if (Array.isArray(allRates)) {
        for (const entry of allRates as ExchangeRateEntry[]) {
          if (!entry.currency || entry.currency === appCurrency) continue;
          const pair = `${entry.currency}${appCurrency}=X`;
          let dailyPrices: DailyPrice[] = [];
          try {
            dailyPrices = await rust.get_daily_stock_prices({ ticker: pair });
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
          if (entry.rate > 0) {
            const today = new Date().toISOString().slice(0, 10);
            map[today] = entry.rate;
            list.push({ date: today, price: entry.rate });
            if (!list.some((p: DailyPrice) => p.date <= pdfDateRange.start)) {
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

    await rust.generate_pdf_report({ filePath, data: reportData });
  } else {
    await writeTextFile(filePath, content!);
  }

  return typeof filePath === "string" ? filePath : JSON.stringify(filePath);
}
