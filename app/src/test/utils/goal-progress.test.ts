import { describe, expect, it } from "vitest";
import {
  computeGoalProgress,
  holdingOverlapsAccountLink,
  tickersForAccount,
  type ProgressAccount,
  type ProgressLink,
} from "../../utils/goal-progress";
import type { HoldingValueMap } from "../../utils/market-values";

const NOW = new Date(Date.UTC(2026, 0, 1));

const savings: ProgressAccount = {
  id: 1,
  name: "Savings",
  balance: 4000,
  exchangeRate: 1,
};

const brokerage: ProgressAccount = {
  id: 2,
  name: "Brokerage",
  balance: 1000,
  exchangeRate: 1.1,
};

const holdings: HoldingValueMap = {
  "1": { AAPL: 1000 },
  "2": { AAPL: 500, VTI: null },
};

function progress(
  links: ProgressLink[],
  extra: Partial<Parameters<typeof computeGoalProgress>[0]> = {},
) {
  return computeGoalProgress({
    targetAmount: 10000,
    exchangeRate: 1,
    createdAt: "2025-01-01",
    links,
    accounts: [savings, brokerage],
    holdingValues: holdings,
    now: NOW,
    ...extra,
  });
}

describe("computeGoalProgress", () => {
  it("converts an account total and applies allocation", () => {
    const result = progress([
      {
        sourceType: "account",
        accountId: 2,
        allocationPercent: 50,
      },
    ]);
    // cash 1000 + AAPL 500 = 1500 account currency * 1.1 * 50%
    expect(result.current).toBeCloseTo(825);
    expect(result.target).toBe(10000);
    expect(result.contributions[0]?.missing).toBe(false);
  });

  it("sums a ticker across accounts and skips a missing quote", () => {
    const result = progress([
      {
        sourceType: "holding",
        accountId: null,
        ticker: "aapl",
        allocationPercent: 100,
      },
    ]);
    // account 1: 1000 * 1, account 2: 500 * 1.1
    expect(result.current).toBeCloseTo(1550);
    expect(result.contributions[0]?.missing).toBe(false);
  });

  it("marks a holding with no quote as missing", () => {
    const result = progress([
      {
        sourceType: "holding",
        accountId: 2,
        ticker: "VTI",
        allocationPercent: 100,
      },
    ]);
    expect(result.current).toBe(0);
    expect(result.contributions[0]?.missing).toBe(true);
  });

  it("warns when a holding is already inside a linked account and still sums both", () => {
    const links: ProgressLink[] = [
      { sourceType: "account", accountId: 1, allocationPercent: 100 },
      {
        sourceType: "holding",
        accountId: 1,
        ticker: "AAPL",
        allocationPercent: 100,
      },
    ];
    const result = progress(links);
    const holdingLink = links[1];
    expect(result.hasOverlap).toBe(true);
    expect(holdingLink).toBeDefined();
    if (holdingLink) {
      expect(holdingOverlapsAccountLink(holdingLink, links, holdings)).toBe(
        true,
      );
    }
    // account 1 is 4000 cash + 1000 AAPL, plus the AAPL holding again
    expect(result.current).toBeCloseTo(6000);
  });

  it("marks a goal reached when the target is met", () => {
    const result = progress(
      [
        {
          sourceType: "account",
          accountId: 1,
          allocationPercent: 100,
        },
      ],
      { targetAmount: 1000 },
    );
    expect(result.status).toBe("reached");
    expect(result.remaining).toBe(0);
  });

  it("compares progress with a straight line to the target date", () => {
    const halfwayAccount = [
      { id: 1, name: "Savings", balance: 1000, exchangeRate: 1 },
    ];
    const behind = progress(
      [
        {
          sourceType: "account",
          accountId: 1,
          allocationPercent: 100,
        },
      ],
      {
        targetDate: "2027-01-01",
        accounts: halfwayAccount,
        holdingValues: {},
      },
    );
    // Halfway through the window with only 10% funded.
    expect(behind.status).toBe("behind");
    expect(behind.requiredMonthly).toBeGreaterThan(0);

    const onTrack = progress(
      [
        {
          sourceType: "account",
          accountId: 1,
          allocationPercent: 100,
        },
      ],
      {
        targetDate: "2027-01-01",
        accounts: [{ id: 1, name: "Savings", balance: 6000, exchangeRate: 1 }],
        holdingValues: {},
      },
    );
    expect(onTrack.status).toBe("on_track");
  });

  it("projects a finish date from the monthly contribution", () => {
    const result = progress(
      [
        {
          sourceType: "account",
          accountId: 1,
          allocationPercent: 100,
        },
      ],
      { monthlyContribution: 500 },
    );
    expect(result.status).toBe("projected");
    expect(result.projectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is behind when the contribution misses the target date", () => {
    const result = progress(
      [
        {
          sourceType: "account",
          accountId: 1,
          allocationPercent: 100,
        },
      ],
      { monthlyContribution: 100, targetDate: "2026-02-01" },
    );
    expect(result.status).toBe("behind");
    expect(result.projectedDate).not.toBeNull();
  });

  it("stays unscheduled without a date or contribution", () => {
    const result = progress([
      {
        sourceType: "account",
        accountId: 1,
        allocationPercent: 100,
      },
    ]);
    expect(result.status).toBe("unscheduled");
    expect(result.requiredMonthly).toBeNull();
    expect(result.projectedDate).toBeNull();
  });

  it("lists tickers for one account and across accounts", () => {
    expect(tickersForAccount(holdings, "2")).toEqual(["AAPL", "VTI"]);
    expect(tickersForAccount(holdings, null)).toEqual(["AAPL", "VTI"]);
  });
});
