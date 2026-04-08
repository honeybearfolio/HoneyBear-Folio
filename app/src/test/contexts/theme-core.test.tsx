import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useTheme } from "../../contexts/theme-core";
import { useThemeStore } from "../../stores/theme";

// Test component to consume hook
function TestComponent() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme("dark")}>Set Dark</button>
    </div>
  );
}

describe("useTheme (Zustand store)", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "system" });
  });

  it("returns default theme value", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("can call setTheme", () => {
    render(<TestComponent />);
    screen.getByRole("button").click();
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("works with dark theme value", () => {
    useThemeStore.setState({ theme: "dark" });
    render(<TestComponent />);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("works with system theme value", () => {
    useThemeStore.setState({ theme: "system" });
    render(<TestComponent />);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("works with high-contrast-dark theme value", () => {
    useThemeStore.setState({ theme: "high-contrast-dark" });
    render(<TestComponent />);
    expect(screen.getByTestId("theme")).toHaveTextContent("high-contrast-dark");
  });

  it("works with high-contrast-light theme value", () => {
    useThemeStore.setState({ theme: "high-contrast-light" });
    render(<TestComponent />);
    expect(screen.getByTestId("theme")).toHaveTextContent(
      "high-contrast-light",
    );
  });

  it("works with ink-light theme value", () => {
    useThemeStore.setState({ theme: "ink-light" });
    render(<TestComponent />);
    expect(screen.getByTestId("theme")).toHaveTextContent("ink-light");
  });

  it("works with ink-dark theme value", () => {
    useThemeStore.setState({ theme: "ink-dark" });
    render(<TestComponent />);
    expect(screen.getByTestId("theme")).toHaveTextContent("ink-dark");
  });
});
