import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import useIsHighContrast from "../../hooks/useIsHighContrast";

describe("useIsHighContrast", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("high-contrast");
  });

  afterEach(() => {
    document.documentElement.classList.remove("high-contrast");
  });

  it("returns false when high-contrast class is not present", () => {
    const { result } = renderHook(() => useIsHighContrast());

    expect(result.current).toBe(false);
  });

  it("returns true when high-contrast class is present", () => {
    document.documentElement.classList.add("high-contrast");

    const { result } = renderHook(() => useIsHighContrast());

    expect(result.current).toBe(true);
  });

  it("updates when high-contrast class is added", async () => {
    const { result } = renderHook(() => useIsHighContrast());

    expect(result.current).toBe(false);

    act(() => {
      document.documentElement.classList.add("high-contrast");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current).toBe(true);
  });

  it("updates when high-contrast class is removed", async () => {
    document.documentElement.classList.add("high-contrast");

    const { result } = renderHook(() => useIsHighContrast());

    expect(result.current).toBe(true);

    act(() => {
      document.documentElement.classList.remove("high-contrast");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current).toBe(false);
  });

  it("cleans up MutationObserver on unmount", () => {
    const { unmount } = renderHook(() => useIsHighContrast());

    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
