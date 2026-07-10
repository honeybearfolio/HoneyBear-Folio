import React, { useRef, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ScheduledForm from "../../../features/scheduled/ScheduledForm";
import { createDefaultScheduledForm } from "../../../constants/app";
import type { ScheduledFormState } from "../../../features/scheduled/scheduled-helpers";

vi.mock("react-datepicker", () => ({
  default: ({
    selected,
    onChange,
    className,
  }: {
    selected?: Date | null;
    onChange: (date: Date | null) => void;
    className?: string;
  }) => (
    <input
      data-testid="datepicker"
      className={className}
      value={selected ? selected.toISOString().split("T")[0] : ""}
      onChange={(e) => {
        onChange(e.target.value ? new Date(e.target.value) : null);
      }}
    />
  ),
}));

vi.mock("../../../components/ui/NumberInput", () => ({
  default: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value: string | number | null | undefined;
    onChange: (v: number) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="number-input"
      className={className}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        onChange(Number(e.target.value));
      }}
    />
  ),
}));

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string | number | undefined;
    onChange: (v: string | number) => void;
    options: { value: string | number; label: string }[];
    placeholder?: string;
  }) => (
    <select
      data-testid={`custom-select-${placeholder ?? "select"}`}
      aria-label={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span>Plus</span>,
  Edit: () => <span>Edit</span>,
  Save: () => <span>Save</span>,
  X: () => <span>X</span>,
  TrendingUp: () => <span>Trend</span>,
  ArrowDownLeft: () => <span>Down</span>,
  ArrowUpRight: () => <span>Up</span>,
}));

vi.mock("../../../utils/format", () => ({
  getDatePickerFormat: (key: string) => key,
}));

const accountOptions = [
  { value: 1, label: "Checking" },
  { value: 2, label: "Savings" },
];

function renderScheduledForm(
  overrides: Partial<ScheduledFormState> = {},
  options: {
    isEditing?: boolean;
    tickerSuggestions?: Array<{
      symbol: string;
      shortname?: string;
      longname?: string;
      exchange?: string;
      typeDisp?: string;
      currency?: string;
    }>;
  } = {},
) {
  const handleSubmit = vi.fn((e: React.SyntheticEvent) => {
    e.preventDefault();
  });
  const resetForm = vi.fn();
  const handleTickerChange = vi.fn();
  const toggleDayOfWeek = vi.fn();

  function Wrapper() {
    const formRef = useRef<HTMLDivElement>(null);
    const [formState, setFormState] = useState<ScheduledFormState>({
      ...createDefaultScheduledForm(),
      ...overrides,
    });
    const [showTickerSuggestions, setShowTickerSuggestions] = useState(
      (options.tickerSuggestions?.length ?? 0) > 0,
    );

    return (
      <ScheduledForm
        formRef={formRef}
        isEditing={options.isEditing ?? false}
        formState={formState}
        setFormState={setFormState}
        showTickerSuggestions={showTickerSuggestions}
        setShowTickerSuggestions={setShowTickerSuggestions}
        tickerSuggestions={options.tickerSuggestions ?? []}
        accountOptions={accountOptions}
        dateFormat="YYYY-MM-DD"
        firstDayOfWeek={1}
        handleTickerChange={handleTickerChange}
        handleSubmit={handleSubmit}
        resetForm={resetForm}
        toggleDayOfWeek={toggleDayOfWeek}
      />
    );
  }

  const view = render(<Wrapper />);
  return {
    ...view,
    handleSubmit,
    resetForm,
    handleTickerChange,
    toggleDayOfWeek,
  };
}

describe("ScheduledForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders create mode with regular transaction fields", () => {
    renderScheduledForm();

    expect(screen.getByRole("heading", { name: /Create/ })).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Investment")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Account").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Payee")).toBeInTheDocument();
  });

  it("renders edit mode title", () => {
    renderScheduledForm({}, { isEditing: true });
    expect(screen.getByRole("heading", { name: /Update/ })).toBeInTheDocument();
  });

  it("updates payee when typing", async () => {
    renderScheduledForm();
    const payeeInput = screen.getByPlaceholderText("Payee");
    await userEvent.type(payeeInput, "Rent");
    expect(payeeInput).toHaveValue("Rent");
  });

  it("switches to investment fields when investment type is selected", async () => {
    renderScheduledForm();
    await userEvent.click(screen.getByText("Investment"));

    expect(screen.getByPlaceholderText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Buy")).toBeInTheDocument();
    expect(screen.getByText("Sell")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Payee")).not.toBeInTheDocument();
  });

  it("switches buy/sell in investment mode", async () => {
    renderScheduledForm({ transactionType: "investment" });
    await userEvent.click(screen.getByText("Sell"));
    expect(screen.getByText("Sell").closest("button")).toHaveClass(
      "bg-rose-500",
    );
  });

  it("uppercases ticker and calls handleTickerChange", async () => {
    const { handleTickerChange } = renderScheduledForm({
      transactionType: "investment",
    });
    const tickerInput = screen.getByPlaceholderText("AAPL");
    await userEvent.type(tickerInput, "msft");
    expect(tickerInput).toHaveValue("MSFT");
    expect(handleTickerChange).toHaveBeenCalled();
  });

  it("selects ticker suggestion and sets currency", async () => {
    renderScheduledForm(
      { transactionType: "investment", ticker: "AA" },
      {
        tickerSuggestions: [
          {
            symbol: "AAPL",
            shortname: "Apple",
            exchange: "NMS",
            typeDisp: "Equity",
            currency: "USD",
          },
        ],
      },
    );

    fireEvent.click(screen.getByText("AAPL"));
    expect(screen.getByDisplayValue("AAPL")).toBeInTheDocument();
  });

  it("toggles day-of-week buttons for day_of_week recurrence", async () => {
    const { toggleDayOfWeek } = renderScheduledForm({
      recurrenceType: "day_of_week",
    });

    const mondayButton = screen.getByRole("button", { name: "Mon" });
    fireEvent.click(mondayButton);
    expect(toggleDayOfWeek).toHaveBeenCalledWith(1);
  });

  it("shows interval controls for every_n recurrence", () => {
    renderScheduledForm({ recurrenceType: "every_n", intervalValue: 2 });

    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByText("Every")).toBeInTheDocument();
  });

  it("calls resetForm when close button is clicked", () => {
    const { resetForm } = renderScheduledForm();
    fireEvent.click(screen.getByText("X"));
    expect(resetForm).toHaveBeenCalled();
  });

  it("submits the form via save button", () => {
    const { handleSubmit } = renderScheduledForm();
    fireEvent.click(screen.getByRole("button", { name: /Create/i }));
    expect(handleSubmit).toHaveBeenCalled();
  });
});
