import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { NumberFormatProvider } from "../../contexts/NumberFormatContext";
import { useNumberFormat } from "../../contexts/number-format";

// Test component to consume context
function TestComponent() {
  const { locale, setLocale, currency, setCurrency, uiLanguage, setUiLanguage } = useNumberFormat();
  return (
    <div>
      <div data-testid="locale">{locale}</div>
      <div data-testid="currency">{currency}</div>
      <div data-testid="uiLanguage">{uiLanguage}</div>
      <button onClick={() => setLocale("de-DE")}>Set Locale DE</button>
      <button onClick={() => setCurrency("EUR")}>Set Currency EUR</button>
      <button onClick={() => setUiLanguage("es")}>Set UI Language ES</button>
    </div>
  );
}

describe("NumberFormatProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses default values if localStorage is empty", () => {
    render(
      <NumberFormatProvider>
        <TestComponent />
      </NumberFormatProvider>,
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("currency")).toHaveTextContent("USD");
    expect(screen.getByTestId("uiLanguage")).toHaveTextContent("en");
  });

  it("persists uiLanguage and calls i18n.setLanguage on change", async () => {
    const i18n = await import("../../i18n/i18n");
    const spy = vi.spyOn(i18n, "setLanguage").mockResolvedValue();

    render(
      <NumberFormatProvider>
        <TestComponent />
      </NumberFormatProvider>,
    );

    fireEvent.click(screen.getByText("Set UI Language ES"));
    expect(screen.getByTestId("uiLanguage")).toHaveTextContent("es");

    await waitFor(() => {
      expect(localStorage.getItem("hb_ui_language")).toBe("es");
      expect(spy).toHaveBeenCalledWith("es");
    });

    spy.mockRestore();
  });

  it("loads values from localStorage", () => {
    localStorage.setItem("hb_number_format", "fr-FR");
    localStorage.setItem("hb_currency", "GBP");

    render(
      <NumberFormatProvider>
        <TestComponent />
      </NumberFormatProvider>,
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("fr-FR");
    expect(screen.getByTestId("currency")).toHaveTextContent("GBP");
  });

  it("updates state and persists to localStorage", async () => {
    render(
      <NumberFormatProvider>
        <TestComponent />
      </NumberFormatProvider>,
    );

    fireEvent.click(screen.getByText("Set Locale DE"));
    expect(screen.getByTestId("locale")).toHaveTextContent("de-DE");

    await waitFor(() => {
      expect(localStorage.getItem("hb_number_format")).toBe("de-DE");
    });

    fireEvent.click(screen.getByText("Set Currency EUR"));
    expect(screen.getByTestId("currency")).toHaveTextContent("EUR");

    await waitFor(() => {
      expect(localStorage.getItem("hb_currency")).toBe("EUR");
    });
  });
});
