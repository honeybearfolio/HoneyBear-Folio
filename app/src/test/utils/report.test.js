import { describe, expect, it, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { computeReportData } from "../../utils/report";

describe("computeReportData wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards report input to Rust and returns its payload", async () => {
    const input = {
      accounts: [{ id: 1, name: "Cash", balance: 1000, currency: "USD" }],
      transactions: [],
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      appCurrency: "USD",
      exchangeRates: {},
      quotes: [],
      labels: { title: "Report" },
    };

    const expected = {
      summary: { net_worth: 1000 },
      account_balances: [{ total: 1000 }],
    };
    vi.mocked(invoke).mockResolvedValue(expected);

    const result = await computeReportData(input);

    expect(invoke).toHaveBeenCalledWith("compute_report_data", {
      input,
    });
    expect(result).toEqual(expected);
  });
});
