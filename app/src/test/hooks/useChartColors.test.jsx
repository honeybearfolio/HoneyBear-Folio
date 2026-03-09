import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import useChartColors from "../../hooks/useChartColors";

const { mockUseIsDark, mockUseIsHighContrast } = vi.hoisted(() => ({
  mockUseIsDark: vi.fn(),
  mockUseIsHighContrast: vi.fn(),
}));

vi.mock("../../hooks/useIsDark", () => ({ default: mockUseIsDark }));
vi.mock("../../hooks/useIsHighContrast", () => ({
  default: mockUseIsHighContrast,
}));

describe("useChartColors", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    mockUseIsHighContrast.mockReturnValue(false);
    document.documentElement.removeAttribute("style");
  });

  afterEach(() => {
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

  it("uses dark high-contrast tooltip and text colors", () => {
    mockUseIsDark.mockReturnValue(true);
    mockUseIsHighContrast.mockReturnValue(true);

    const { result } = renderHook(() => useChartColors());
    expect(result.current.tooltipBg).toBe("rgba(0, 0, 0, 0.95)");
    expect(result.current.tooltipText).toBe("#ffffff");
  });

  it("uses dark non-high-contrast tooltip variant", () => {
    mockUseIsDark.mockReturnValue(true);
    mockUseIsHighContrast.mockReturnValue(false);

    const { result } = renderHook(() => useChartColors());
    expect(result.current.tooltipBg).toBe("rgba(15, 23, 42, 0.9)");
  });

  it("uses light high-contrast tooltip variant", () => {
    mockUseIsDark.mockReturnValue(false);
    mockUseIsHighContrast.mockReturnValue(true);

    const { result } = renderHook(() => useChartColors());
    expect(result.current.tooltipBg).toBe("rgba(255, 255, 255, 0.98)");
  });
});
