import { describe, it, expect, beforeEach, vi } from "vitest";
import { useThemeStore } from "../../stores/theme";
import { STORAGE_KEYS } from "../../constants/app";

describe("useThemeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "system" });
    vi.spyOn(Storage.prototype, "setItem");
  });

  it("has default theme of 'system'", () => {
    expect(useThemeStore.getState().theme).toBe("system");
  });

  it("setTheme updates the theme state", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("setTheme persists to localStorage", () => {
    useThemeStore.getState().setTheme("light");
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEYS.THEME, "light");
  });

  it("supports high-contrast-dark theme", () => {
    useThemeStore.getState().setTheme("high-contrast-dark");
    expect(useThemeStore.getState().theme).toBe("high-contrast-dark");
  });

  it("supports high-contrast-light theme", () => {
    useThemeStore.getState().setTheme("high-contrast-light");
    expect(useThemeStore.getState().theme).toBe("high-contrast-light");
  });

  it("supports ink-light theme", () => {
    useThemeStore.getState().setTheme("ink-light");
    expect(useThemeStore.getState().theme).toBe("ink-light");
  });

  it("supports ink-dark theme", () => {
    useThemeStore.getState().setTheme("ink-dark");
    expect(useThemeStore.getState().theme).toBe("ink-dark");
  });

  it("setState overrides theme directly", () => {
    useThemeStore.setState({ theme: "dark" });
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("exposes a setTheme action", () => {
    expect(typeof useThemeStore.getState().setTheme).toBe("function");
  });
});
