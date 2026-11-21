import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import useTagColors from "../../hooks/useTagColors";
import { usePortfolioPreferences } from "../../stores/portfolio-preferences";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
import {
  getColorClasses,
  getColorDot,
  TAG_COLOR_KEYS,
  DEFAULT_COLOR,
  TRANSFER_DEFAULT_COLOR,
} from "../../config/tag-colors";

describe("tag-colors config", () => {
  it("exports a non-empty list of color keys", () => {
    expect(TAG_COLOR_KEYS.length).toBeGreaterThan(0);
    expect(TAG_COLOR_KEYS).toContain("slate");
    expect(TAG_COLOR_KEYS).toContain("purple");
    expect(TAG_COLOR_KEYS).toContain("red");
  });

  it("getColorClasses returns classes for every key", () => {
    for (const key of TAG_COLOR_KEYS) {
      const classes = getColorClasses(key);
      expect(classes).toBeTruthy();
      expect(classes).toContain("bg-");
      expect(classes).toContain("text-");
      expect(classes).toContain("border-");
    }
  });

  it("getColorClasses falls back to default for unknown key", () => {
    const result = getColorClasses("nonexistent");
    expect(result).toBe(getColorClasses(DEFAULT_COLOR));
  });

  it("getColorDot returns a dot class for every key", () => {
    for (const key of TAG_COLOR_KEYS) {
      const dot = getColorDot(key);
      expect(dot).toContain("bg-");
    }
  });
});

describe("useTagColors", () => {
  beforeEach(() => {
    usePortfolioPreferences.setState({ path: "/test.db", values: {} });
  });

  it("starts with empty tag colors", () => {
    const { result } = renderHook(() => useTagColors());
    expect(result.current.tagColors).toEqual({});
  });

  it("getTagClasses returns slate for a regular category", () => {
    const { result } = renderHook(() => useTagColors());
    const classes = result.current.getTagClasses("Food");
    expect(classes).toBe(getColorClasses(DEFAULT_COLOR));
  });

  it("getTagClasses returns purple for Transfer by default", () => {
    const { result } = renderHook(() => useTagColors());
    const classes = result.current.getTagClasses("Transfer");
    expect(classes).toBe(getColorClasses(TRANSFER_DEFAULT_COLOR));
  });

  it("getTagClasses returns default for null/undefined category", () => {
    const { result } = renderHook(() => useTagColors());
    expect(result.current.getTagClasses(null as unknown as string)).toBe(
      getColorClasses(DEFAULT_COLOR),
    );
    expect(result.current.getTagClasses(undefined as unknown as string)).toBe(
      getColorClasses(DEFAULT_COLOR),
    );
  });

  it("setTagColor assigns a color and persists to the portfolio", () => {
    const { result } = renderHook(() => useTagColors());

    act(() => {
      result.current.setTagColor("Food", "red");
    });

    expect(result.current.tagColors).toEqual({ Food: "red" });
    expect(result.current.getTagClasses("Food")).toBe(getColorClasses("red"));
    expect(
      JSON.parse(usePortfolioPreferences.getState().values.hb_tag_colors!),
    ).toEqual({
      Food: "red",
    });
  });

  it("removeTagColor removes assignment and reverts to default", () => {
    const { result } = renderHook(() => useTagColors());

    act(() => {
      result.current.setTagColor("Food", "blue");
    });
    expect(result.current.getTagClasses("Food")).toBe(getColorClasses("blue"));

    act(() => {
      result.current.removeTagColor("Food");
    });
    expect(result.current.tagColors).toEqual({});
    expect(result.current.getTagClasses("Food")).toBe(
      getColorClasses(DEFAULT_COLOR),
    );
  });

  it("resetAll clears all assignments", () => {
    const { result } = renderHook(() => useTagColors());

    act(() => {
      result.current.setTagColor("Food", "red");
      result.current.setTagColor("Savings", "blue");
    });
    expect(Object.keys(result.current.tagColors)).toHaveLength(2);

    act(() => {
      result.current.resetAll();
    });
    expect(result.current.tagColors).toEqual({});
    expect(
      JSON.parse(usePortfolioPreferences.getState().values.hb_tag_colors!),
    ).toEqual({});
  });

  it("reads persisted colors from the portfolio on mount", () => {
    usePortfolioPreferences.setState({
      values: {
        hb_tag_colors: JSON.stringify({ Rent: "green", Transfer: "indigo" }),
      },
    });

    const { result } = renderHook(() => useTagColors());
    expect(result.current.tagColors).toEqual({
      Rent: "green",
      Transfer: "indigo",
    });
    expect(result.current.getTagClasses("Rent")).toBe(getColorClasses("green"));
    expect(result.current.getTagClasses("Transfer")).toBe(
      getColorClasses("indigo"),
    );
  });

  it("handles corrupted saved colors gracefully", () => {
    usePortfolioPreferences.setState({ values: { hb_tag_colors: "not-json" } });

    const { result } = renderHook(() => useTagColors());
    expect(result.current.tagColors).toEqual({});
  });
});
