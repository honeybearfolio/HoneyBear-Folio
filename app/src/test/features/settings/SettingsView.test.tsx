import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SettingsView from "../../../features/settings/SettingsView";

// Mock i18n (provide AVAILABLE_LANGUAGES used by the component)
vi.mock("../../../i18n/i18n", () => ({
  default: { t: (key: string) => key },
  AVAILABLE_LANGUAGES: [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ],
}));

const mockSetUiLanguage = vi.fn();
const mockSetLocale = vi.fn();
const mockSetCurrency = vi.fn();
// Mock theme + number-format contexts
vi.mock("../../../stores/theme", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));
vi.mock("../../../stores/number-format", () => ({
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
vi.mock("../../../stores/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

// Mock Tauri invoke (reset_db_path is called during reset)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

// Mock CustomSelect to expose options easily and provide sensible test ids based on placeholder
vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }) => {
    const p = (placeholder || "").toLowerCase();
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
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
          onChange(e.target.value);
        }}
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

describe("SettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows language selector in General section", () => {
    render(<SettingsView activeSection="general" />);

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByTestId("language-select")).toBeInTheDocument();
    expect(screen.getByText("Select language")).toBeInTheDocument();
  });

  it("does not show language selector in Formats section", () => {
    render(<SettingsView activeSection="formats" />);

    expect(screen.queryByText("Language")).not.toBeInTheDocument();
  });

  it("shows exchange rates in General section", () => {
    render(<SettingsView activeSection="general" />);

    expect(screen.getByText("Exchange Rates")).toBeInTheDocument();
  });

  it("does not show exchange rates in Formats section", () => {
    render(<SettingsView activeSection="formats" />);

    expect(screen.queryByText("Exchange Rates")).not.toBeInTheDocument();
  });

  it("uses AVAILABLE_LANGUAGES for options and calls setter on change", () => {
    render(<SettingsView activeSection="general" />);
    const sel = screen.getByTestId("language-select");

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();

    fireEvent.change(sel, { target: { value: "es" } });
    expect(mockSetUiLanguage).toHaveBeenCalledWith("es");
  });

  it("asks for confirmation and resets when confirmed", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockConfirmLocal = mockConfirm;
    mockConfirmLocal.mockResolvedValueOnce(true);

    const mockOnChangeSidebarVisibility = vi.fn();
    render(
      <SettingsView
        activeSection="general"
        onChangeSidebarVisibility={mockOnChangeSidebarVisibility}
      />,
    );

    const btn = screen.getByRole("button", { name: /Reset to defaults/i });
    fireEvent.click(btn);

    expect(mockConfirmLocal).toHaveBeenCalledWith(
      "Reset all settings to their default values? This cannot be undone.",
      expect.objectContaining({ kind: "warning" }),
    );

    await waitFor(() => {
      expect(mockSetLocale).toHaveBeenCalledWith("en-US");
      expect(mockSetCurrency).toHaveBeenCalledWith("USD");
      expect(mockSetUiLanguage).toHaveBeenCalledWith("en");
      expect(mockOnChangeSidebarVisibility).toHaveBeenCalledWith({
        dashboard: true,
        investments: true,
        fire: true,
        rules: true,
        scheduled: true,
        all: true,
        chat: true,
        assets: true,
        liabilities: true,
      });
      expect(invoke).toHaveBeenCalledWith("reset_db_path");
    });
  });

  it("does not reset when confirmation is cancelled", async () => {
    const mockConfirmLocal = mockConfirm;
    mockConfirmLocal.mockResolvedValueOnce(false);

    const { useNumberFormat } = await import("../../../stores/number-format");
    const setters = useNumberFormat();

    render(<SettingsView activeSection="general" />);

    const btn = screen.getByRole("button", { name: /Reset to defaults/i });
    fireEvent.click(btn);

    expect(mockConfirmLocal).toHaveBeenCalled();
    expect(mockSetLocale).not.toHaveBeenCalled();
    expect(mockSetUiLanguage).not.toHaveBeenCalled();
    expect(setters.setUiLanguage).not.toHaveBeenCalled();
  });

  it("shows theme selector and font size in Customization section", () => {
    const sidebarVisibility = {
      dashboard: true,
      investments: true,
      fire: true,
      rules: true,
      scheduled: true,
      all: true,
      chat: true,
      assets: true,
      liabilities: true,
    };
    render(
      <SettingsView
        activeSection="customization"
        sidebarVisibility={sidebarVisibility}
        onChangeSidebarVisibility={vi.fn()}
      />,
    );

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByTestId("theme-select")).toBeInTheDocument();
    expect(screen.getByText("Font size")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();

    // verify order: Theme -> Font size -> sidebar switches
    const themeLabel = screen.getByText("Theme");
    const fontLabel = screen.getByText("Font size");
    const firstSwitch = screen.getAllByRole("switch")[0]!;

    expect(
      themeLabel.compareDocumentPosition(fontLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      fontLabel.compareDocumentPosition(firstSwitch) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
