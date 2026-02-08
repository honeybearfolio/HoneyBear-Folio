import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SettingsModal from "../../../components/shared/SettingsModal";

// Mock i18n (provide AVAILABLE_LANGUAGES used by the component)
vi.mock("../../../i18n/i18n", () => ({
  t: (key) => {
    const map = {
      "settings.title": "Settings",
      "settings.general": "General",
      "settings.formats": "Formats",
      "settings.language": "Language",
      "settings.select_language_placeholder": "Select language",
      "settings.language_help":
        "Select the language used by the UI (affects menus, labels and tooltips).",

      "settings.tooltip.theme":
        "Choose light/dark or follow system preference.",
      "settings.tooltip.database_file":
        "Path to your local SQLite database file.",
      "settings.tooltip.font_size":
        "Adjust font size to control UI scale (smaller = more content fits, larger = easier to read).",
      "settings.tooltip.currency":
        "Default currency used by the app when formatting amounts.",
      "settings.tooltip.number_format":
        "Choose how numbers are grouped and which decimal separator to use.",
      "settings.tooltip.date_format":
        "Choose how dates are shown in the app (UI only; does not change import/export formats).",
      "settings.tooltip.first_day_of_week":
        "Choose the first day of the week for calendars.",

      "settings.select_theme_placeholder": "Select theme",
      "settings.reset_to_defaults": "Reset to defaults",
      "settings.reset_confirm":
        "Reset all settings to their default values? This cannot be undone.",
    };
    return map[key] || key;
  },
  AVAILABLE_LANGUAGES: [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ],
}));

const mockSetUiLanguage = vi.fn();
const mockSetLocale = vi.fn();
const mockSetCurrency = vi.fn();
// Mock theme + number-format contexts
vi.mock("../../../contexts/theme-core", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));
vi.mock("../../../contexts/number-format", () => ({
  useNumberFormat: () => ({
    locale: "en-US",
    setLocale: mockSetLocale,
    currency: "USD",
    setCurrency: mockSetCurrency,
    dateFormat: "YYYY-MM-DD",
    setDateFormat: vi.fn(),
    firstDayOfWeek: 1,
    setFirstDayOfWeek: vi.fn(),
    uiLanguage: "en",
    setUiLanguage: mockSetUiLanguage,
  }),
}));

// Mock confirm context (used by the reset flow)
const mockConfirm = vi.fn();
vi.mock("../../../contexts/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

// Mock Tauri invoke (reset_db_path is called during reset)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

// Mock CustomSelect to expose options easily and provide sensible test ids based on placeholder
vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({ value, onChange, options, placeholder }) => {
    const p = String(placeholder || "").toLowerCase();
    const testId = p.includes("language")
      ? "language-select"
      : p.includes("theme")
        ? "theme-select"
        : p.includes("currency")
          ? "currency-select"
          : p.includes("format")
            ? "format-select"
            : `custom-select-${p.replace(/\s+/g, "-")}`;

    return (
      <select
        data-testid={testId}
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
    );
  },
}));

describe("SettingsModal (language placement)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows language selector in General tab and not in Formats tab", () => {
    render(<SettingsModal onClose={vi.fn()} />);

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByTestId("language-select")).toBeInTheDocument();
    expect(screen.getByText("Select language")).toBeInTheDocument();

    // switch to Formats tab — language should not be visible there
    fireEvent.click(screen.getByText("Formats"));
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
  });

  it("uses AVAILABLE_LANGUAGES for options and calls setter on change", () => {
    render(<SettingsModal onClose={vi.fn()} />);
    const sel = screen.getByTestId("language-select");

    // options are rendered by the mocked CustomSelect
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();

    fireEvent.change(sel, { target: { value: "es" } });
    expect(mockSetUiLanguage).toHaveBeenCalledWith("es");
  });

  it("asks for confirmation and resets when confirmed", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockConfirmLocal = mockConfirm;
    mockConfirmLocal.mockResolvedValueOnce(true);

    const { useNumberFormat } = await import("../../../contexts/number-format");

    render(<SettingsModal onClose={vi.fn()} />);

    const btn = screen.getByRole("button", { name: /Reset to defaults/i });
    fireEvent.click(btn);

    // confirm should be shown and resolved (use the mocked translator so the
    // assertion doesn't depend on the literal string)
    const { t } = await import("../../../i18n/i18n");
    await expect(mockConfirmLocal).toHaveBeenCalledWith(
      t("settings.reset_confirm"),
      expect.objectContaining({ kind: "warning" }),
    );

    // setters should be called to apply defaults (async effects may run
    // after the click — waitFor ensures we observe the final state)
    await waitFor(() => {
      expect(mockSetLocale).toHaveBeenCalledWith("en-US");
      expect(mockSetCurrency).toHaveBeenCalledWith("USD");
      expect(mockSetUiLanguage).toHaveBeenCalledWith("en");
      expect(invoke).toHaveBeenCalledWith("reset_db_path");
    });
  });

  it("does not reset when confirmation is cancelled", async () => {
    const mockConfirmLocal = mockConfirm;
    mockConfirmLocal.mockResolvedValueOnce(false);

    const { useNumberFormat } = await import("../../../contexts/number-format");
    const setters = useNumberFormat();

    render(<SettingsModal onClose={vi.fn()} />);

    const btn = screen.getByRole("button", { name: /Reset to defaults/i });
    fireEvent.click(btn);

    await expect(mockConfirmLocal).toHaveBeenCalled();
    expect(mockSetLocale).not.toHaveBeenCalled();
    expect(mockSetUiLanguage).not.toHaveBeenCalled();
    expect(setters.setUiLanguage).not.toHaveBeenCalled();
  });
});
