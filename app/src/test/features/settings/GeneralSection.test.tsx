import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GeneralSection from "../../../features/settings/GeneralSection";

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
    "data-testid": testId,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    "data-testid"?: string;
  }) => (
    <select
      data-testid={testId ?? "language-select"}
      aria-label={placeholder}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value);
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("../../../components/shared/ExchangeRatesList", () => ({
  default: () => (
    <div data-testid="exchange-rates-list">Exchange Rates List</div>
  ),
}));

vi.mock("../../../features/settings/LlmSettingsSection", () => ({
  default: () => <div data-testid="llm-settings">LLM Settings</div>,
}));

describe("GeneralSection", () => {
  const setUiLanguage = vi.fn();
  const handleSelectDb = vi.fn();
  const showTooltip = vi.fn();
  const hideTooltip = vi.fn();

  const defaultProps = {
    uiLanguage: "en",
    setUiLanguage,
    dbPath: "",
    handleSelectDb,
    showTooltip,
    hideTooltip,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders language selector and exchange rates", () => {
    render(<GeneralSection {...defaultProps} />);

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByTestId("language-select")).toBeInTheDocument();
    expect(screen.getByText("Exchange Rates")).toBeInTheDocument();
    expect(screen.getByTestId("exchange-rates-list")).toBeInTheDocument();
    expect(screen.getByTestId("llm-settings")).toBeInTheDocument();
  });

  it("calls setUiLanguage when language changes", async () => {
    const user = userEvent.setup();
    render(<GeneralSection {...defaultProps} />);

    await user.selectOptions(screen.getByTestId("language-select"), "es");

    expect(setUiLanguage).toHaveBeenCalledWith("es");
  });

  it("shows placeholder when no db path is set", () => {
    render(<GeneralSection {...defaultProps} />);

    expect(screen.getByText("Select DB file")).toBeInTheDocument();
  });

  it("shows db path and calls handleSelectDb on click", async () => {
    const user = userEvent.setup();
    const dbPath = "/home/user/data/folio.db";
    render(<GeneralSection {...defaultProps} dbPath={dbPath} />);

    expect(screen.getByText(dbPath)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: dbPath }));
    expect(handleSelectDb).toHaveBeenCalledTimes(1);
  });
});
