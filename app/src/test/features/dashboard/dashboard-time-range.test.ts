import { describe, it, expect } from "vitest";
import {
  buildSortedLocalDates,
  computeNetWorthDateRange,
  computeExpenseDateRange,
  isDayBucketRange,
  computeIncomeExpenseBuckets,
} from "../../../features/dashboard/dashboard-time-range";
import type { Transaction } from "../../../features/dashboard/dashboard-types";

const transactions: Transaction[] = [
  { id: 1, account_id: 1, date: "2024-06-15", amount: 100 },
  { id: 2, account_id: 1, date: "2024-07-01", amount: -50 },
];

describe("dashboard-time-range", () => {
  it("buildSortedLocalDates produces inclusive local date strings", () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 3);
    expect(buildSortedLocalDates(start, end)).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ]);
  });

  it("computeNetWorthDateRange clamps ALL to first transaction", () => {
    const { sortedDates } = computeNetWorthDateRange(
      "ALL",
      new Date("2020-01-01"),
      new Date("2025-01-01"),
      transactions,
    );

    expect(sortedDates[0]).toBe("2024-06-15");
    expect(sortedDates[sortedDates.length - 1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("computeExpenseDateRange returns ISO date bounds for 1M", () => {
    const { startStr, endStr } = computeExpenseDateRange(
      "1M",
      new Date("2020-01-01"),
      new Date("2025-01-01"),
    );

    expect(startStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("isDayBucketRange is true for 1M and short custom ranges", () => {
    expect(isDayBucketRange("1M", new Date(), new Date())).toBe(true);
    expect(
      isDayBucketRange(
        "CUSTOM",
        new Date("2024-01-01"),
        new Date("2024-01-15"),
      ),
    ).toBe(true);
    expect(
      isDayBucketRange(
        "CUSTOM",
        new Date("2024-01-01"),
        new Date("2024-03-01"),
      ),
    ).toBe(false);
  });

  it("computeIncomeExpenseBuckets builds day keys for 1M", () => {
    const { keys, labels, isDayBucket } = computeIncomeExpenseBuckets(
      "1M",
      new Date("2024-01-01"),
      new Date("2024-01-31"),
      transactions,
      (d) => d,
      "en-US",
    );

    expect(isDayBucket).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    expect(labels.length).toBe(keys.length);
  });
});
