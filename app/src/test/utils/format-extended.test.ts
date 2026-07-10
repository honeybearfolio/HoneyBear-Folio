import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  formatDateForUI,
  getDatePickerFormat,
  formatNumberForExport,
  useFormatNumber,
  useFormatDate,
  useParseNumber,
  DATE_FORMATS,
} from "../../utils/format";
import { useNumberFormatStore } from "../../stores/number-format";
import { usePrivacyStore } from "../../stores/privacy";

vi.mock("../../utils/currencies", () => ({
  CURRENCIES: [
    { code: "USD", symbol: "$", position: "left" },
    { code: "EUR", symbol: "€", position: "right" },
  ],
}));

const sampleDate = new Date("2024-03-15T12:00:00");

describe("formatDateForUI", () => {
  it("returns empty string for invalid values", () => {
    expect(formatDateForUI(null, "YYYY-MM-DD")).toBe("");
    expect(formatDateForUI("", "YYYY-MM-DD")).toBe("");
    expect(formatDateForUI("invalid", "YYYY-MM-DD")).toBe("");
  });

  it("formats known date patterns", () => {
    expect(formatDateForUI(sampleDate, "YYYY-MM-DD")).toBe("2024-03-15");
    expect(formatDateForUI(sampleDate, "YYYY/MM/DD")).toBe("2024/03/15");
    expect(formatDateForUI(sampleDate, "MM/DD/YYYY")).toBe("03/15/2024");
    expect(formatDateForUI(sampleDate, "DD/MM/YYYY")).toBe("15/03/2024");
    expect(formatDateForUI(sampleDate, "DD-MM-YYYY")).toBe("15-03-2024");
    expect(formatDateForUI(sampleDate, "DD.MM.YYYY")).toBe("15.03.2024");
  });

  it("formats locale month name patterns", () => {
    expect(formatDateForUI(sampleDate, "DD MMM YYYY")).toMatch(/15/);
    expect(formatDateForUI(sampleDate, "MMM DD, YYYY")).toMatch(/Mar/);
    expect(formatDateForUI(sampleDate, "MMMM D, YYYY")).toMatch(/March/);
  });

  it("falls back to ISO for unknown format key", () => {
    expect(formatDateForUI(sampleDate, "UNKNOWN")).toBe("2024-03-15");
  });
});

describe("getDatePickerFormat", () => {
  it("returns mapped datepicker format", () => {
    expect(getDatePickerFormat("YYYY-MM-DD")).toBe("yyyy-MM-dd");
    expect(getDatePickerFormat("DD/MM/YYYY")).toBe("dd/MM/yyyy");
  });

  it("falls back for unknown key", () => {
    expect(getDatePickerFormat("bad")).toBe("yyyy-MM-dd");
  });

  it("covers all DATE_FORMATS keys", () => {
    for (const key of Object.keys(DATE_FORMATS)) {
      expect(getDatePickerFormat(key)).toBeTruthy();
    }
  });
});

describe("formatNumberForExport", () => {
  it("handles empty and non-string values", () => {
    expect(formatNumberForExport(null)).toBe("");
    expect(formatNumberForExport(undefined)).toBe("");
    expect(formatNumberForExport(42)).toBe("42");
    expect(formatNumberForExport(true)).toBe("");
  });

  it("normalizes comma decimal separator", () => {
    expect(formatNumberForExport("1234,56")).toBe("1234.56");
  });

  it("removes thousand separators when dot decimal present", () => {
    expect(formatNumberForExport("1,234.56")).toBe("1234.56");
  });

  it("returns original string when not parseable", () => {
    expect(formatNumberForExport("not-a-number")).toBe("not-a-number");
  });
});

describe("format hooks", () => {
  beforeEach(() => {
    useNumberFormatStore.setState({
      locale: "en-US",
      currency: "USD",
      dateFormat: "YYYY-MM-DD",
    });
    usePrivacyStore.setState({ isPrivacyMode: false });
  });

  it("useFormatNumber applies default currency", () => {
    const { result } = renderHook(() => useFormatNumber());
    expect(result.current(100, { style: "currency" })).toBe("$100.00");
  });

  it("useFormatNumber masks values in privacy mode", () => {
    usePrivacyStore.setState({ isPrivacyMode: true });
    const { result } = renderHook(() => useFormatNumber());
    const masked = result.current(1234.56, {
      style: "currency",
      currency: "USD",
    });
    expect(masked).toContain("•");
    expect(masked).toContain("$");
  });

  it("useFormatNumber masks non-currency values in privacy mode", () => {
    usePrivacyStore.setState({ isPrivacyMode: true });
    const { result } = renderHook(() => useFormatNumber());
    expect(result.current(1234.56)).toMatch(/^•+$/);
  });

  it("useFormatDate uses store date format", () => {
    const { result } = renderHook(() => useFormatDate());
    expect(result.current("2024-01-02")).toBe("2024-01-02");
  });

  it("useParseNumber uses store locale", () => {
    const { result } = renderHook(() => useParseNumber());
    expect(result.current("1,234.56")).toBe(1234.56);
  });
});
