import type { DashboardTimeRange } from "./dashboard-constants";
import type { Transaction } from "./dashboard-types";

export interface NetWorthDateRange {
  cutoffDate: Date;
  endDate: Date;
  sortedDates: string[];
}

export function buildSortedLocalDates(start: Date, end: Date): string[] {
  const sortedDates: string[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);

  while (d <= end) {
    const localDate = `${String(d.getFullYear())}-${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    sortedDates.push(localDate);
    d.setDate(d.getDate() + 1);
  }

  return sortedDates;
}

export function computeNetWorthDateRange(
  timeRange: DashboardTimeRange,
  customStartDate: Date,
  customEndDate: Date,
  filteredTransactions: Transaction[],
): NetWorthDateRange {
  const now = new Date();
  let cutoffDate = new Date();
  let endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  if (timeRange === "1M") cutoffDate.setMonth(now.getMonth() - 1);
  else if (timeRange === "3M") cutoffDate.setMonth(now.getMonth() - 3);
  else if (timeRange === "6M") cutoffDate.setMonth(now.getMonth() - 6);
  else if (timeRange === "YTD") cutoffDate = new Date(now.getFullYear(), 0, 1);
  else if (timeRange === "1Y") cutoffDate.setFullYear(now.getFullYear() - 1);
  else if (timeRange === "CUSTOM") {
    cutoffDate = new Date(customStartDate);
    endDate = new Date(customEndDate);
  } else cutoffDate = new Date(0);

  cutoffDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (timeRange === "ALL" && filteredTransactions.length > 0) {
    const firstTxDate = new Date(
      filteredTransactions.reduce(
        (min, t) => (t.date < min ? t.date : min),
        filteredTransactions[0]!.date,
      ),
    );
    cutoffDate = firstTxDate;
    cutoffDate.setHours(0, 0, 0, 0);
  } else if (timeRange === "ALL") {
    cutoffDate.setFullYear(now.getFullYear() - 1);
    cutoffDate.setHours(0, 0, 0, 0);
  }

  if (filteredTransactions.length > 0) {
    const firstTxDate = new Date(
      filteredTransactions.reduce(
        (min, t) => (t.date < min ? t.date : min),
        filteredTransactions[0]!.date,
      ),
    );
    firstTxDate.setHours(0, 0, 0, 0);
    if (firstTxDate > cutoffDate && timeRange !== "CUSTOM")
      cutoffDate = new Date(firstTxDate);
  }

  return {
    cutoffDate,
    endDate,
    sortedDates: buildSortedLocalDates(cutoffDate, endDate),
  };
}

export interface ExpenseDateRange {
  startStr: string;
  endStr: string;
}

export function computeExpenseDateRange(
  timeRange: DashboardTimeRange,
  customStartDate: Date,
  customEndDate: Date,
): ExpenseDateRange {
  const now = new Date();
  let startDate = new Date(0);
  let endDate = new Date();

  if (timeRange === "1M") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
  } else if (timeRange === "3M") {
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 3);
  } else if (timeRange === "6M") {
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 6);
  } else if (timeRange === "YTD") {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else if (timeRange === "1Y") {
    startDate = new Date(now);
    startDate.setFullYear(now.getFullYear() - 1);
  } else if (timeRange === "CUSTOM") {
    startDate = new Date(customStartDate);
    endDate = new Date(customEndDate);
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return {
    startStr: startDate.toISOString().split("T")[0] ?? "",
    endStr: endDate.toISOString().split("T")[0] ?? "",
  };
}

export function isDayBucketRange(
  timeRange: DashboardTimeRange,
  customStartDate: Date,
  customEndDate: Date,
): boolean {
  return (
    timeRange === "1M" ||
    (timeRange === "CUSTOM" &&
      (customEndDate.getTime() - customStartDate.getTime()) /
        (1000 * 60 * 60 * 24) <=
        31)
  );
}

export interface IncomeExpenseBuckets {
  keys: string[];
  labels: string[];
  isDayBucket: boolean;
}

export function computeIncomeExpenseBuckets(
  timeRange: DashboardTimeRange,
  customStartDate: Date,
  customEndDate: Date,
  filteredTransactions: Transaction[],
  formatDate: (date: string) => string,
  locale: string,
): IncomeExpenseBuckets {
  const now = new Date();
  const keys: string[] = [];
  const labels: string[] = [];

  const isDayBucket = isDayBucketRange(
    timeRange,
    customStartDate,
    customEndDate,
  );

  if (isDayBucket) {
    const end =
      timeRange === "CUSTOM" ? new Date(customEndDate) : new Date(now);
    const start =
      timeRange === "CUSTOM" ? new Date(customStartDate) : new Date(now);
    if (timeRange === "1M") start.setDate(now.getDate() - 29);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const d = new Date(start);
    while (d <= end) {
      const key = d.toISOString().slice(0, 10);
      keys.push(key);
      labels.push(formatDate(key));
      d.setDate(d.getDate() + 1);
    }
  } else {
    let end = new Date(now);
    let start = new Date(now);

    if (timeRange === "3M") start.setMonth(now.getMonth() - 2);
    else if (timeRange === "6M") start.setMonth(now.getMonth() - 5);
    else if (timeRange === "YTD") start = new Date(now.getFullYear(), 0, 1);
    else if (timeRange === "1Y") start.setFullYear(now.getFullYear() - 1);
    else if (timeRange === "ALL") {
      const txDates = filteredTransactions.map((t) => t.date).sort();
      const firstDate = txDates[0];
      if (firstDate) start = new Date(firstDate);
    } else if (timeRange === "CUSTOM") {
      start = new Date(customStartDate);
      end = new Date(customEndDate);
    }

    start.setDate(1);
    const d = new Date(start);
    while (d <= end) {
      const key = `${String(d.getFullYear())}-${String(
        d.getMonth() + 1,
      ).padStart(2, "0")}`;
      keys.push(key);
      const opts: Intl.DateTimeFormatOptions = { month: "short" };
      const monthsDiff =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
      if (monthsDiff >= 12) opts.year = "numeric";
      labels.push(d.toLocaleDateString(locale, opts));
      d.setMonth(d.getMonth() + 1);
    }
  }

  return { keys, labels, isDayBucket };
}
