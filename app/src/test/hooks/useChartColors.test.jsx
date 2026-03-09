import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import useChartColors from "../../hooks/useChartColors";

describe("useChartColors", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark", "high-contrast");
    document.documentElement.removeAttribute("style");
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark", "high-contrast");
    document.documentElement.removeAttribute("style");
  });

  it("uses fallback palette values when CSS variables are missing", () => {
    const { result } = renderHook(() => useChartColors());

    expect(result.current.primary).toBe("#f98c07");
    expect(result.current.grid).toBe("#d2cfce");
    expect(result.current.tooltipBg).toBe("rgba(255, 255, 255, 0.9)");
    expect(result.current.palette).toHaveLength(8);
  });

  it("uses CSS variable values when present", () => {
    document.documentElement.style.setProperty("--color-brand-500", "#123456");
    document.documentElement.style.setProperty("--color-slate-600", "#654321");

    const { result } = renderHook(() => useChartColors());
    expect(result.current.primary).toBe("#123456");
    expect(result.current.text).toBe("#654321");
  });

  it("uses dark high-contrast tooltip and text colors", async () => {
    document.documentElement.classList.add("dark", "high-contrast");

    const { result } = renderHook(() => useChartColors());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.tooltipBg).toBe("rgba(0, 0, 0, 0.95)");
    expect(result.current.tooltipText).toBe("#ffffff");
  });
});
