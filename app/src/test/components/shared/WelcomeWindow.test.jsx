import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WelcomeWindow from "../../../components/shared/WelcomeWindow";

// Mock i18n
vi.mock("../../../i18n/i18n", () => ({
  t: (key) => {
    const translations = {
      "Welcome to HoneyBear Folio": "Welcome to HoneyBear Folio",
      "Let's set up your preferences to get started.":
        "Let's set up your preferences to get started.",
      Theme: "Theme",
      Currency: "Currency",
      "settings.theme.light": "Light",
      "settings.theme.dark": "Dark",
      "settings.theme.system": "System",
      "settings.select_theme_placeholder": "Select theme",
      "settings.select_currency_placeholder": "Select currency",
      "settings.language": "Language",
      "settings.select_language_placeholder": "Select language",
      "Get Started": "Get Started",
    };
    return translations[key] || key;
  },
  AVAILABLE_LANGUAGES: [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ],
}));

// Mock theme context
const mockSetTheme = vi.fn();
vi.mock("../../../contexts/theme-core", () => ({
  useTheme: () => ({ theme: "system", setTheme: mockSetTheme }),
}));

// Mock number format context
const mockSetLocale = vi.fn();
const mockSetCurrency = vi.fn();
const mockSetDateFormat = vi.fn();
const mockSetFirstDayOfWeek = vi.fn();
const mockSetUiLanguage = vi.fn();
vi.mock("../../../contexts/number-format", () => ({
  useNumberFormat: () => ({
    locale: "en-US",
    setLocale: mockSetLocale,
    currency: "USD",
    setCurrency: mockSetCurrency,
    dateFormat: "YYYY-MM-DD",
    setDateFormat: mockSetDateFormat,
    firstDayOfWeek: 0,
    setFirstDayOfWeek: mockSetFirstDayOfWeek,
    uiLanguage: "en",
    setUiLanguage: mockSetUiLanguage,
  }),
}));

// Mock currencies
vi.mock("../../../utils/currencies", () => ({
  CURRENCIES: [
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
  ],
}));

// Mock format utility
vi.mock("../../../utils/format", () => ({
  formatDateForUI: (date, format) => format,
}));

// Mock CustomSelect to expose options/change easily (matches other tests)
vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({ value, onChange, options, placeholder }) => (
    <select
      data-testid="language-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

// Mock dev settings
let devSettings = {};
vi.mock("../../../config/dev-settings", () => ({
  getDevSetting: (key) => devSettings[key],
}));

describe("WelcomeWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    devSettings = {};
  });

  it("renders when first run is not completed", () => {
    render(<WelcomeWindow />);

    expect(screen.getByText("Welcome to HoneyBear Folio")).toBeInTheDocument();
    expect(
      screen.getByText("Let's set up your preferences to get started."),
    ).toBeInTheDocument();
  });

  it("does not render when first run is completed", () => {
    localStorage.setItem("hb_first_run_completed", "true");

    render(<WelcomeWindow />);

    expect(
      screen.queryByText("Welcome to HoneyBear Folio"),
    ).not.toBeInTheDocument();
  });

  it("renders when FORCE_WELCOME_SCREEN is enabled", () => {
    localStorage.setItem("hb_first_run_completed", "true");
    devSettings.FORCE_WELCOME_SCREEN = true;

    render(<WelcomeWindow />);

    expect(screen.getByText("Welcome to HoneyBear Folio")).toBeInTheDocument();
  });

  it("shows theme selection options", () => {
    render(<WelcomeWindow />);

    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("shows currency selection options", () => {
    render(<WelcomeWindow />);

    expect(screen.getByText("Currency")).toBeInTheDocument();
  });

  it("shows language selector and calls setter on change", () => {
    render(<WelcomeWindow />);

    expect(screen.getByText("Language")).toBeInTheDocument();
    const sel = screen.getByTestId("language-select");

    // options rendered by the mocked CustomSelect
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();

    fireEvent.change(sel, { target: { value: "es" } });
    expect(mockSetUiLanguage).toHaveBeenCalledWith("es");
  });

  it("closes and sets localStorage when Get Started is clicked", () => {
    render(<WelcomeWindow />);

    fireEvent.click(screen.getByText("Get Started"));

    expect(localStorage.getItem("hb_first_run_completed")).toBe("true");
    expect(
      screen.queryByText("Welcome to HoneyBear Folio"),
    ).not.toBeInTheDocument();
  });
});
