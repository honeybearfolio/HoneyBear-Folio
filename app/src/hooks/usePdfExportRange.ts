import { useState, useEffect, useMemo } from "react";
import { rust } from "../api/tauri-client";

export type PdfRangeType = "ytd" | "annual" | "month" | "custom";

export interface PdfDateRange {
  start: string;
  end: string;
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
  const [transactionDates, setTransactionDates] = useState<string[]>([]);

  useEffect(() => {
    rust
      .get_all_transactions()
      .then((txs) => {
        const dates = txs.map((tx) => tx.date).filter(Boolean);
        setTransactionDates(dates);
      })
      .catch((e: unknown) => {
        console.error("Failed to fetch transaction dates for export", e);
      });
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

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }, [
    rangeType,
    selectedYear,
    selectedMonthYear,
    selectedMonthIndex,
    customStartDate,
    customEndDate,
  ]);

  const availableYears = useMemo(() => {
    if (transactionDates.length === 0) {
      return [new Date().getFullYear()];
    }
    const years = [
      ...new Set(transactionDates.map((d) => Number(d.slice(0, 4)))),
    ];
    years.sort((a, b) => b - a);
    return years;
  }, [transactionDates]);

  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }),
    );
  }, []);

  const availableMonths = useMemo(() => {
    const now = new Date();
    const prefix = String(selectedMonthYear);
    const monthsWithTxs = [
      ...new Set(
        transactionDates
          .filter((d) => d.startsWith(prefix))
          .map((d) => Number(d.slice(5, 7)) - 1),
      ),
    ].sort((a, b) => a - b);

    const maxMonth =
      selectedMonthYear === now.getFullYear() ? now.getMonth() : 11;
    const filtered = monthsWithTxs.filter((m) => m <= maxMonth);

    if (filtered.length === 0) {
      const fallbackLabel = monthNames[now.getMonth()] ?? "";
      return [{ index: now.getMonth(), label: fallbackLabel }];
    }
    return filtered.map((i) => ({
      index: i,
      label: monthNames[i] ?? String(i + 1),
    }));
  }, [selectedMonthYear, monthNames, transactionDates]);

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
