import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { fetchMarketValuesForAccounts } from "../../utils/market-values";

describe("fetchMarketValuesForAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object when there are no transactions", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_all_transactions") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const result = await fetchMarketValuesForAccounts([], "USD");
    expect(result).toEqual({});
  });

  it("returns empty object when transactions have no tickers", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve([
          { account_id: 1, amount: -500, category: "Food" },
        ]);
      return Promise.resolve([]);
    });

    const result = await fetchMarketValuesForAccounts(
      [{ id: 1, currency: "USD" }],
      "USD",
    );
    expect(result).toEqual({});
  });

  it("computes market value for a single holding", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve([{ account_id: 1, ticker: "AAPL", shares: 10 }]);
      if (cmd === "get_stock_quotes") {
        const a = args as { tickers: string[] };
        // Exchange-rate pairs have "=X" suffix; return empty for them
        if (a.tickers.some((t: string) => t.endsWith("=X")))
          return Promise.resolve([]);
        return Promise.resolve([
          { symbol: "AAPL", regularMarketPrice: 150, currency: "USD" },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await fetchMarketValuesForAccounts(
      [{ id: 1, currency: "USD" }],
      "USD",
    );
    // 10 shares * $150 = $1500
    expect(result["1"]).toBeCloseTo(1500);
  });

  it("applies exchange-rate conversion when quote currency differs from account currency", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve([{ account_id: 1, ticker: "SAP", shares: 5 }]);
      if (cmd === "get_stock_quotes") {
        const a = args as { tickers: string[] };
        if (a.tickers.some((t: string) => t.endsWith("=X")))
          // EURUSD=X rate
          return Promise.resolve([
            { symbol: "EURUSD=X", regularMarketPrice: 1.1 },
          ]);
        return Promise.resolve([
          { symbol: "SAP", regularMarketPrice: 100, currency: "EUR" },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await fetchMarketValuesForAccounts(
      [{ id: 1, currency: "USD" }],
      "USD",
    );
    // 5 shares * 100 EUR * 1.1 EURUSD = 550 USD
    expect(result["1"]).toBeCloseTo(550);
  });

  it("ignores holdings with negligible share count", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve([
          // shares below the 0.0001 threshold should be skipped
          { account_id: 1, ticker: "AAPL", shares: 0.00005 },
        ]);
      if (cmd === "get_stock_quotes")
        return Promise.resolve([
          { symbol: "AAPL", regularMarketPrice: 200, currency: "USD" },
        ]);
      return Promise.resolve([]);
    });

    const result = await fetchMarketValuesForAccounts(
      [{ id: 1, currency: "USD" }],
      "USD",
    );
    expect(result["1"]).toBe(0);
  });

  it("uses appCurrency for accounts without an explicit currency", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve([{ account_id: 99, ticker: "MSFT", shares: 2 }]);
      if (cmd === "get_stock_quotes") {
        const a = args as { tickers: string[] };
        if (a.tickers.some((t: string) => t.endsWith("=X")))
          return Promise.resolve([]);
        return Promise.resolve([
          { symbol: "MSFT", regularMarketPrice: 300, currency: "USD" },
        ]);
      }
      return Promise.resolve([]);
    });

    // Account 99 has no currency — should fall back to appCurrency "USD"
    const result = await fetchMarketValuesForAccounts([], "USD");
    // 2 shares * $300 = $600, no conversion needed
    expect(result["99"]).toBeCloseTo(600);
  });

  it("aggregates multiple tickers in the same account", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === "get_all_transactions")
        return Promise.resolve([
          { account_id: 1, ticker: "AAPL", shares: 10 },
          { account_id: 1, ticker: "GOOG", shares: 2 },
        ]);
      if (cmd === "get_stock_quotes") {
        const a = args as { tickers: string[] };
        if (a.tickers.some((t: string) => t.endsWith("=X")))
          return Promise.resolve([]);
        return Promise.resolve([
          { symbol: "AAPL", regularMarketPrice: 100, currency: "USD" },
          { symbol: "GOOG", regularMarketPrice: 200, currency: "USD" },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await fetchMarketValuesForAccounts(
      [{ id: 1, currency: "USD" }],
      "USD",
    );
    // 10*100 + 2*200 = 1400
    expect(result["1"]).toBeCloseTo(1400);
  });
});
