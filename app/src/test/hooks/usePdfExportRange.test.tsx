import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  monthsFromDateBounds,
  usePdfExportRange,
  yearsFromDateBounds,
} from "../../hooks/usePdfExportRange";

describe("yearsFromDateBounds", () => {
  const today = new Date(2026, 10, 18);

  it("returns the current year when the ledger is empty", () => {
    expect(yearsFromDateBounds(null, null, today)).toEqual([2026]);
  });

  it("fills every year from the earliest date through the latest", () => {
    expect(yearsFromDateBounds("2020-05-01", "2024-01-10", today)).toEqual([
      2024, 2023, 2022, 2021, 2020,
    ]);
  });
});

describe("monthsFromDateBounds", () => {
  const today = new Date(2026, 10, 18);

  it("spans the partial years and clips only the current year", () => {
    expect(
      monthsFromDateBounds(2023, "2023-03-15", "2024-01-10", today),
    ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(
      monthsFromDateBounds(2024, "2023-03-15", "2024-01-10", today),
    ).toEqual([0]);
    expect(
      monthsFromDateBounds(2026, "2026-01-02", "2026-12-31", today),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("usePdfExportRange", () => {
  it("loads min and max dates instead of the full ledger", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_transaction_date_bounds") {
        return Promise.resolve({
          min_date: "2023-03-15",
          max_date: "2024-01-10",
        });
      }
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => usePdfExportRange());

    await waitFor(() => {
      expect(result.current.availableYears).toEqual([2024, 2023]);
    });
    expect(invoke).toHaveBeenCalledWith("get_transaction_date_bounds");
    expect(invoke).not.toHaveBeenCalledWith("get_all_transactions");

    act(() => {
      result.current.setSelectedMonthYear(2023);
    });
    expect(result.current.availableMonths.map((month) => month.index)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });
});
