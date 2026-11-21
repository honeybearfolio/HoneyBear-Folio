import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import useChartColors from "../../hooks/useChartColors";
import themeCss from "../../styles/theme.css?raw";

const { mockUseIsDark, mockUseIsHighContrast } = vi.hoisted(() => ({
  mockUseIsDark: vi.fn(),
  mockUseIsHighContrast: vi.fn(),
}));

vi.mock("../../hooks/useIsDark", () => ({ default: mockUseIsDark }));
vi.mock("../../hooks/useIsHighContrast", () => ({
  default: mockUseIsHighContrast,
}));

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

describe("useChartColors", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    mockUseIsHighContrast.mockReturnValue(false);
    document.documentElement.removeAttribute("style");
    document.documentElement.className = "";
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.className = "";
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

  it.each([
    ["light", false, false, false, "#ffffff"],
    ["dark", true, false, false, "base"],
    ["high-contrast light", false, true, false, "#ffffff"],
    ["high-contrast dark", true, true, false, "high-contrast"],
    ["ink light", false, false, true, "#ffffff"],
    ["ink dark", true, false, true, "ink"],
  ])(
    "keeps every pie color visible on the %s card",
    (_theme, isDark, isHighContrast, isInk, background) => {
      mockUseIsDark.mockReturnValue(isDark);
      mockUseIsHighContrast.mockReturnValue(isHighContrast);
      document.documentElement.classList.toggle("ink", isInk);

      const cardBackground =
        background === "base"
          ? themeCss.match(/--color-slate-800:\s*(#[0-9a-f]{6})/i)![1]!
          : background === "high-contrast"
            ? themeCss.match(
                /\.dark\.high-contrast\s*\{[^}]*--color-slate-800:\s*(#[0-9a-f]{6})/i,
              )![1]!
            : background === "ink"
              ? themeCss.match(
                  /\.dark\.ink\s*\{[^}]*--color-slate-800:\s*(#[0-9a-f]{6})/i,
                )![1]!
              : background;
      const { result } = renderHook(() => useChartColors());
      const colors = result.current.piePalette;
      expect(new Set(colors).size).toBe(8);
      for (const color of colors) {
        const values = [luminance(color), luminance(cardBackground)].sort(
          (a, b) => b - a,
        );
        expect(
          (values[0]! + 0.05) / (values[1]! + 0.05),
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("updates the pie palette when switching to ink without changing brightness", async () => {
    const { result } = renderHook(() => useChartColors());
    const previous = result.current.piePalette;
    document.documentElement.classList.add("ink");
    await waitFor(() => {
      expect(result.current.piePalette).not.toEqual(previous);
    });
  });
});
