import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useColumnMapping,
  EMPTY_FIELD_MAPPING,
} from "../../hooks/useColumnMapping";

describe("useColumnMapping", () => {
  it("starts with empty mapping", () => {
    const { result } = renderHook(() => useColumnMapping());
    expect(result.current.mapping).toEqual(EMPTY_FIELD_MAPPING);
  });

  it("auto-maps columns from headers", () => {
    const { result } = renderHook(() => useColumnMapping());

    act(() => {
      result.current.applyAutoMap([
        "Date",
        "Payee",
        "Amount",
        "Account",
        "Category",
      ]);
    });

    expect(result.current.mapping.date).toBe("Date");
    expect(result.current.mapping.payee).toBe("Payee");
    expect(result.current.mapping.amount).toBe("Amount");
    expect(result.current.mapping.account).toBe("Account");
    expect(result.current.mapping.category).toBe("Category");
  });

  it("resets mapping to empty defaults", () => {
    const { result } = renderHook(() => useColumnMapping());

    act(() => {
      result.current.applyAutoMap(["Date", "Amount"]);
    });
    act(() => {
      result.current.resetMapping();
    });

    expect(result.current.mapping).toEqual(EMPTY_FIELD_MAPPING);
  });

  it("allows manual mapping updates", () => {
    const { result } = renderHook(() => useColumnMapping());

    act(() => {
      result.current.setMapping({ ...EMPTY_FIELD_MAPPING, notes: "Memo" });
    });

    expect(result.current.mapping.notes).toBe("Memo");
  });
});
