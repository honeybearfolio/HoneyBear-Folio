import { describe, it, expect } from "vitest";
import { buildAccountHoldingsFromTransactions } from "../../utils/account-holdings";

describe("buildAccountHoldingsFromTransactions", () => {
  it("returns empty maps when there are no investment transactions", () => {
    const result = buildAccountHoldingsFromTransactions([
      { account_id: 1, ticker: undefined, shares: undefined },
      { account_id: 1, amount: -50 } as never,
    ]);

    expect(result.accountHoldings).toEqual({});
    expect(result.allTickers.size).toBe(0);
  });

  it("aggregates shares per account and ticker", () => {
    const result = buildAccountHoldingsFromTransactions([
      { account_id: 1, ticker: "AAPL", shares: 10 },
      { account_id: 1, ticker: "AAPL", shares: 5 },
      { account_id: 2, ticker: "GOOG", shares: 2 },
    ]);

    expect(result.accountHoldings["1"]).toEqual({ AAPL: 15 });
    expect(result.accountHoldings["2"]).toEqual({ GOOG: 2 });
    expect(result.allTickers).toEqual(new Set(["AAPL", "GOOG"]));
  });

  it("includes sell transactions as negative share deltas", () => {
    const result = buildAccountHoldingsFromTransactions([
      { account_id: 1, ticker: "AAPL", shares: 10 },
      { account_id: 1, ticker: "AAPL", shares: -3 },
    ]);

    expect(result.accountHoldings["1"]).toEqual({ AAPL: 7 });
  });
});
