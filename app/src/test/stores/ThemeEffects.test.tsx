import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeEffects } from "../../stores/theme";
import { useThemeStore } from "../../stores/theme";

vi.mock("../../api/tauri-client", () => ({
  rust: {
    get_system_theme: vi.fn().mockResolvedValue("dark"),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("ThemeEffects", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    useThemeStore.setState({ theme: "system" });
  });

  it("applies dark class for dark theme", () => {
    useThemeStore.setState({ theme: "dark" });
    render(<ThemeEffects />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applies light class for light theme", () => {
    useThemeStore.setState({ theme: "light" });
    render(<ThemeEffects />);
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("applies high-contrast classes", () => {
    useThemeStore.setState({ theme: "high-contrast-dark" });
    render(<ThemeEffects />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("high-contrast")).toBe(true);
  });

  it("applies ink theme classes", () => {
    useThemeStore.setState({ theme: "ink-light" });
    render(<ThemeEffects />);
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("ink")).toBe(true);
  });

  it("responds to system theme via matchMedia when theme is system", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as typeof window.matchMedia;

    render(<ThemeEffects />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
