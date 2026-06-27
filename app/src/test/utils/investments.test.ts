import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  buildHoldingsFromTransactions,
  mergeHoldingsWithQuotes,
  computePortfolioTotals,
  computeNetWorthMarketValues,
} from "../../utils/investments";

describe("investment utils wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Rust build_holdings_from_transactions command", async () => {
    const transactions = [{ date: "2023-01-01", ticker: "AAPL", shares: 10 }];
    const expected = {
      currentHoldings: [{ ticker: "AAPL", shares: 10, costBasis: 1505 }],
      firstTradeDate: "2023-01-01",
    };

    vi.mocked(invoke).mockResolvedValue(expected);

    const result = await buildHoldingsFromTransactions(transactions as never);

    expect(invoke).toHaveBeenCalledWith("build_holdings_from_transactions", {
      transactions,
    });
    expect(result).toEqual(expected);
  });

  it("calls Rust merge_holdings_with_quotes command", async () => {
    const holdings = [{ ticker: "AAPL", shares: 10, costBasis: 1500 }];
    const quotes = [{ symbol: "AAPL", regularMarketPrice: 200 }];
    const expected = [
      {
        ticker: "AAPL",
        shares: 10,
        costBasis: 1500,
        price: 200,
        currentValue: 2000,
        roi: 33.33,
        changePercent: 0,
        quoteType: null,
      },
    ];

    vi.mocked(invoke).mockResolvedValue(expected);

    const result = await mergeHoldingsWithQuotes(
      holdings as never,
      quotes as never,
    );

    expect(invoke).toHaveBeenCalledWith("merge_holdings_with_quotes", {
      holdings,
      quotes,
    });
    expect(result).toEqual(expected);
  });

  it("calls Rust compute_portfolio_totals command", async () => {
    const holdings = [{ currentValue: 2000, costBasis: 1500 }];
    const expected = { totalValue: 2000, totalCostBasis: 1500 };

    vi.mocked(invoke).mockResolvedValue(expected);

    const result = await computePortfolioTotals(holdings as never);

    expect(invoke).toHaveBeenCalledWith("compute_portfolio_totals", {
      holdings,
    });
    expect(result).toEqual(expected);
  });

  it("computes per-account market values without FX conversion", async () => {
    const transactions = [
      { account_id: 1, ticker: "AAPL", shares: 5 },
      { account_id: 2, ticker: "GOOG", shares: 2 },
    ];
    const quotes = [
      { symbol: "AAPL", regularMarketPrice: 220 },
      { symbol: "GOOG", regularMarketPrice: 100 },
    ];

    const result = await computeNetWorthMarketValues(
      transactions as never,
      quotes as never,
    );

    expect(result["1"]).toBeCloseTo(1100);
    expect(result["2"]).toBeCloseTo(200);
    expect(invoke).not.toHaveBeenCalledWith(
      "compute_net_worth_market_values",
      expect.anything(),
    );
  });

  it("ignores negligible share counts when computing market values", async () => {
    const transactions = [{ account_id: 1, ticker: "AAPL", shares: 0.00005 }];
    const quotes = [{ symbol: "AAPL", regularMarketPrice: 200 }];

    const result = await computeNetWorthMarketValues(
      transactions as never,
      quotes as never,
    );

    expect(result["1"]).toBe(0);
  });
});
