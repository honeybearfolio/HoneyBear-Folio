import { useState, useEffect, useMemo } from "react";
import { rust } from "../api/tauri-client";
import { logError } from "../utils/errors";
import { formatCalendarDate } from "../utils/format";

export type PdfRangeType = "ytd" | "annual" | "month" | "custom";

export interface PdfDateRange {
  start: string;
  end: string;
}

interface DateBounds {
  min: string | null;
  max: string | null;
}

const EMPTY_BOUNDS: DateBounds = { min: null, max: null };

function yearOf(iso: string): number | null {
  if (iso.length < 4) return null;
  const year = Number(iso.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

function monthIndexOf(iso: string): number | null {
  if (iso.length < 7) return null;
  const month = Number(iso.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month - 1;
}

function readDateBounds(value: unknown): DateBounds {
  if (typeof value !== "object" || value === null) return EMPTY_BOUNDS;
  const record = value as { min_date?: unknown; max_date?: unknown };
  const min = typeof record.min_date === "string" ? record.min_date : null;
  const max = typeof record.max_date === "string" ? record.max_date : null;
  if (!min || !max) return EMPTY_BOUNDS;
  return { min, max };
}

/** Years from the earliest transaction through the latest, newest first. */
export function yearsFromDateBounds(
  min: string | null,
  max: string | null,
  today = new Date(),
): number[] {
  if (!min || !max) return [today.getFullYear()];
  const startYear = yearOf(min);
  const endYear = yearOf(max);
  if (startYear === null || endYear === null) return [today.getFullYear()];
  const first = Math.min(startYear, endYear);
  const last = Math.max(startYear, endYear);
  const years: number[] = [];
  for (let year = last; year >= first; year -= 1) years.push(year);
  return years;
}

/**
 * Months in `year` that overlap the ledger span.
 * The current year stops at this month. Other years are not clipped.
 */
export function monthsFromDateBounds(
  year: number,
  min: string | null,
  max: string | null,
  today = new Date(),
): number[] {
  if (!min || !max) return [];
  const minYear = yearOf(min);
  const maxYear = yearOf(max);
  const minMonth = monthIndexOf(min);
  const maxMonth = monthIndexOf(max);
  if (
    minYear === null ||
    maxYear === null ||
    minMonth === null ||
    maxMonth === null
  ) {
    return [];
  }
  const fromYear = Math.min(minYear, maxYear);
  const toYear = Math.max(minYear, maxYear);
  const fromMonth = min <= max ? minMonth : maxMonth;
  const toMonth = min <= max ? maxMonth : minMonth;
  if (year < fromYear || year > toYear) return [];
  const startMonth = year === fromYear ? fromMonth : 0;
  let endMonth = year === toYear ? toMonth : 11;
  if (year === today.getFullYear()) {
    endMonth = Math.min(endMonth, today.getMonth());
  }
  if (startMonth > endMonth) return [];
  const months: number[] = [];
  for (let month = startMonth; month <= endMonth; month += 1) {
    months.push(month);
  }
  return months;
}

export function usePdfExportRange() {
  const [rangeType, setRangeType] = useState<PdfRangeType>("ytd");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthYear, setSelectedMonthYear] = useState(
    new Date().getFullYear(),
  );
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(
    new Date().getMonth(),
  );
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
  );
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [dateBounds, setDateBounds] = useState<DateBounds>(EMPTY_BOUNDS);

  useEffect(() => {
    let cancelled = false;
    rust
      .get_transaction_date_bounds()
      .then((bounds) => {
        if (cancelled) return;
        setDateBounds(readDateBounds(bounds));
      })
      .catch((e: unknown) => {
        logError("Failed to fetch transaction dates for export", e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pdfDateRange = useMemo((): PdfDateRange => {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (rangeType === "annual") {
      start = new Date(selectedYear, 0, 1);
      end =
        selectedYear === now.getFullYear()
          ? now
          : new Date(selectedYear, 11, 31);
    } else if (rangeType === "month") {
      start = new Date(selectedMonthYear, selectedMonthIndex, 1);
      end = new Date(selectedMonthYear, selectedMonthIndex + 1, 0);
      if (end > now) end = now;
    } else if (rangeType === "ytd") {
      start = new Date(now.getFullYear(), 0, 1);
      end = now;
    } else {
      start = customStartDate;
      end = customEndDate;
    }

    const fmt = (d: Date) => formatCalendarDate(d);
    return { start: fmt(start), end: fmt(end) };
  }, [
    rangeType,
    selectedYear,
    selectedMonthYear,
    selectedMonthIndex,
    customStartDate,
    customEndDate,
  ]);

  const availableYears = useMemo(
    () => yearsFromDateBounds(dateBounds.min, dateBounds.max),
    [dateBounds.min, dateBounds.max],
  );

  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }),
    );
  }, []);

  const availableMonths = useMemo(() => {
    const now = new Date();
    const filtered = monthsFromDateBounds(
      selectedMonthYear,
      dateBounds.min,
      dateBounds.max,
      now,
    );

    if (filtered.length === 0) {
      const fallbackLabel = monthNames[now.getMonth()] ?? "";
      return [{ index: now.getMonth(), label: fallbackLabel }];
    }
    return filtered.map((i) => ({
      index: i,
      label: monthNames[i] ?? String(i + 1),
    }));
  }, [selectedMonthYear, monthNames, dateBounds.min, dateBounds.max]);

  return {
    rangeType,
    setRangeType,
    selectedYear,
    setSelectedYear,
    selectedMonthYear,
    setSelectedMonthYear,
    selectedMonthIndex,
    setSelectedMonthIndex,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    pdfDateRange,
    availableYears,
    availableMonths,
  };
}
