import { rust } from "../api/tauri-client";

interface ComputeReportDataParams {
  accounts: unknown[];
  transactions: unknown[];
  startDate: string;
  endDate: string;
  appCurrency: string;
  exchangeRates: unknown;
  quotes: unknown[];
  labels: unknown[];
}

export async function computeReportData({
  accounts,
  transactions,
  startDate,
  endDate,
  appCurrency,
  exchangeRates,
  quotes,
  labels,
}: ComputeReportDataParams): Promise<unknown> {
  return rust.compute_report_data({
    input: {
      accounts,
      transactions,
      startDate,
      endDate,
      appCurrency,
      exchangeRates,
      quotes,
      labels,
    },
  });
}
