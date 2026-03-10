import { rust } from "../api/tauri-client";

export async function computeReportData({
  accounts,
  transactions,
  startDate,
  endDate,
  appCurrency,
  exchangeRates,
  quotes,
  labels,
}) {
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
