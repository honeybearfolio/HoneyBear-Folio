import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormatsSection from "../../../features/settings/FormatsSection";

vi.mock("../../../utils/currencies", () => ({
  CURRENCIES: [
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
  ],
}));

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string | number;
    onChange: (v: string | number) => void;
    options: { value: string | number; label: string }[];
    placeholder?: string;
  }) => {
    const testId = placeholder?.toLowerCase().includes("currency")
      ? "currency-select"
      : placeholder?.toLowerCase().includes("date")
        ? "date-format-select"
        : placeholder?.toLowerCase().includes("first")
          ? "first-day-select"
          : "locale-select";

    return (
      <select
        data-testid={testId}
        aria-label={placeholder}
        value={value}
        onChange={(e) => {
          onChange(
            testId === "first-day-select"
              ? Number(e.target.value)
              : e.target.value,
          );
        }}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },
}));

describe("FormatsSection", () => {
  const setLocale = vi.fn();
  const setCurrency = vi.fn();
  const setDateFormat = vi.fn();
  const setFirstDayOfWeek = vi.fn();
  const checkAndPrompt = vi.fn().mockResolvedValue(true);
  const showTooltip = vi.fn();
  const hideTooltip = vi.fn();

  const defaultProps = {
    locale: "en-US",
    setLocale,
    currency: "USD",
    setCurrency,
    dateFormat: "YYYY-MM-DD",
    setDateFormat,
    firstDayOfWeek: 1,
    setFirstDayOfWeek,
    checkAndPrompt,
    showTooltip,
    hideTooltip,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders format settings labels", () => {
    render(<FormatsSection {...defaultProps} />);

    expect(screen.getByText("Currency")).toBeInTheDocument();
    expect(screen.getByText("Number format")).toBeInTheDocument();
    expect(screen.getByText("Date format")).toBeInTheDocument();
    expect(screen.getByText("First Day of Week")).toBeInTheDocument();
  });

  it("shows locale example based on current settings", () => {
    render(<FormatsSection {...defaultProps} />);

    const examplePara = screen.getByText(/Example:/);
    expect(examplePara.textContent).toMatch(/1,234\.56/);
  });

  it("calls setLocale when number format changes", async () => {
    const user = userEvent.setup();
    render(<FormatsSection {...defaultProps} />);

    await user.selectOptions(screen.getByTestId("locale-select"), "de-DE");

    expect(setLocale).toHaveBeenCalledWith("de-DE");
  });

  it("calls setCurrency when currency changes and prompt confirms", async () => {
    const user = userEvent.setup();
    render(<FormatsSection {...defaultProps} />);

    await user.selectOptions(screen.getByTestId("currency-select"), "EUR");

    await vi.waitFor(() => {
      expect(setCurrency).toHaveBeenCalledWith("EUR");
    });
    expect(checkAndPrompt).toHaveBeenCalledWith("EUR");
  });

  it("reverts currency when checkAndPrompt rejects", async () => {
    const user = userEvent.setup();
    checkAndPrompt.mockResolvedValueOnce(false);
    render(<FormatsSection {...defaultProps} />);

    await user.selectOptions(screen.getByTestId("currency-select"), "EUR");

    await vi.waitFor(() => {
      expect(setCurrency).toHaveBeenCalledWith("USD");
    });
  });

  it("calls setDateFormat when date format changes", async () => {
    const user = userEvent.setup();
    render(<FormatsSection {...defaultProps} />);

    await user.selectOptions(
      screen.getByTestId("date-format-select"),
      "DD/MM/YYYY",
    );

    expect(setDateFormat).toHaveBeenCalledWith("DD/MM/YYYY");
  });

  it("calls setFirstDayOfWeek when first day changes", async () => {
    const user = userEvent.setup();
    render(<FormatsSection {...defaultProps} />);

    await user.selectOptions(screen.getByTestId("first-day-select"), "0");

    expect(setFirstDayOfWeek).toHaveBeenCalledWith(0);
  });
});
