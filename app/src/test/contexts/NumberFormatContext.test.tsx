import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTranslation } from "react-i18next";
import { NumberFormatEffects } from "../../stores/number-format";
import { useNumberFormatStore } from "../../stores/number-format";
import { useNumberFormat } from "../../stores/number-format";
import i18n from "../../i18n/i18n";

// Test component to consume hook
function TestComponent() {
  const {
    locale,
    setLocale,
    currency,
    setCurrency,
    uiLanguage,
    setUiLanguage,
  } = useNumberFormat();
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

describe("NumberFormat Zustand store", () => {
  beforeEach(async () => {
    localStorage.clear();
    useNumberFormatStore.setState({
      locale: "en-US",
      currency: "USD",
      dateFormat: "YYYY-MM-DD",
      firstDayOfWeek: 1,
      uiLanguage: "en",
    });
    await i18n.changeLanguage("en");
  });

  it("uses default values if localStorage is empty", () => {
    render(<TestComponent />);

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("currency")).toHaveTextContent("USD");
    expect(screen.getByTestId("uiLanguage")).toHaveTextContent("en");
  });

  it("persists uiLanguage and calls i18n.changeLanguage on change", async () => {
    const spy = vi.spyOn(i18n, "changeLanguage");

    render(
      <>
        <NumberFormatEffects />
        <TestComponent />
      </>,
    );

    fireEvent.click(screen.getByText("Set UI Language ES"));
    expect(screen.getByTestId("uiLanguage")).toHaveTextContent("es");

    await waitFor(() => {
      expect(localStorage.getItem("hb_ui_language")).toBe("es");
      expect(spy).toHaveBeenCalledWith("es");
    });

    spy.mockRestore();
  });

  it("updates rendered UI translations after language change", async () => {
    function Translated() {
      const { t } = useTranslation();
      return <div data-testid="translated">{t("settings.language")}</div>;
    }

    render(
      <>
        <NumberFormatEffects />
        <Translated />
        <TestComponent />
      </>,
    );

    expect(screen.getByTestId("translated")).toHaveTextContent("Language");

    fireEvent.click(screen.getByText("Set UI Language ES"));

    await waitFor(() => {
      expect(screen.getByTestId("translated")).toHaveTextContent("Idioma");
    });
  });

  it("updates state and persists to localStorage", async () => {
    render(<TestComponent />);

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
