import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useNumberFormat } from "../../contexts/number-format";
import { useNumberFormatStore } from "../../stores/number-format";

// Test component to consume hook
function TestComponent() {
  const { locale, currency } = useNumberFormat();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="currency">{currency}</span>
    </div>
  );
}

describe("useNumberFormat (Zustand store)", () => {
  beforeEach(() => {
    useNumberFormatStore.setState({ locale: "en-US", currency: "USD" });
  });

  it("returns default values without any provider", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("currency")).toHaveTextContent("USD");
  });

  it("reflects store state changes", () => {
    useNumberFormatStore.setState({ locale: "de-DE", currency: "EUR" });
    render(<TestComponent />);
    expect(screen.getByTestId("locale")).toHaveTextContent("de-DE");
    expect(screen.getByTestId("currency")).toHaveTextContent("EUR");
  });

  it("works with different locales", () => {
    useNumberFormatStore.setState({ locale: "ja-JP", currency: "JPY" });
    render(<TestComponent />);
    expect(screen.getByTestId("locale")).toHaveTextContent("ja-JP");
    expect(screen.getByTestId("currency")).toHaveTextContent("JPY");
  });
});
