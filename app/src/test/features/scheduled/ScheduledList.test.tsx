import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ScheduledList from "../../../features/scheduled/ScheduledList";
import { useNumberFormatStore } from "../../../stores/number-format";
import { invoke } from "@tauri-apps/api/core";

// Mock dependencies
vi.mock("../../../utils/currencies", () => ({
  CURRENCIES: [{ code: "USD", symbol: "$" }],
}));

vi.mock("react-datepicker", () => ({
  default: (props: {
    selected?: Date | null;
    onChange: (date: Date) => void;
    [key: string]: unknown;
  }) => (
    <input
      data-testid="datepicker"
      value={props.selected ? props.selected.toISOString().split("T")[0] : ""}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        props.onChange(new Date(e.target.value))
      }
    />
  ),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  Trash2: () => <span data-testid="trash-icon">Trash</span>,
  Edit: () => <span data-testid="edit-icon">Edit</span>,
  Save: () => <span data-testid="save-icon">Save</span>,
  X: () => <span data-testid="x-icon">X</span>,
  CalendarClock: () => <span data-testid="calendar-icon">Calendar</span>,
  ToggleLeft: () => <span data-testid="toggle-left">ToggleOff</span>,
  ToggleRight: () => <span data-testid="toggle-right">ToggleOn</span>,
  TrendingUp: () => <span data-testid="trending-icon">Trend</span>,
  ArrowDownLeft: () => <span data-testid="arrow-down">Down</span>,
  ArrowUpRight: () => <span data-testid="arrow-up">Up</span>,
}));

// Mock hooks
const mockConfirm = vi.fn();
const mockShowToast = vi.fn();

vi.mock("../../../stores/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// Mock CustomSelect
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
  }) => (
    <select
      data-testid="custom-select"
      value={value || ""}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
        onChange(e.target.value)
      }
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options.map((opt: { value: string; label: string }) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

// Mock NumberInput
vi.mock("../../../components/ui/NumberInput", () => ({
  default: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value: number;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      type="number"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onChange(e.target.value)
      }
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("../../../utils/format", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useFormatNumber: () => (val: number) => String(val),
    useFormatDate: () => (date: string) => String(date).split("T")[0],
  };
});

const renderWithContext = (ui: React.ReactElement) => {
  useNumberFormatStore.setState({
    dateFormat: "YYYY-MM-DD",
    firstDayOfWeek: 0,
  });
  return render(ui);
};

describe("ScheduledList", () => {
  const mockSchedules = [
    {
      id: 1,
      account_id: 1,
      payee: "Netflix",
      amount: 15.99,
      recurrence_type: "every_n",
      interval_value: 1,
      interval_unit: "month",
      start_date: "2023-01-01",
      enabled: true,
      currency: "USD",
      occurrences_count: 5,
      days_of_week: [],
      ordinal: 1,
      weekday: 1,
    },
  ];

  const mockAccounts = [{ id: 1, name: "Checking", currency: "USD" }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_scheduled_transactions")
        return Promise.resolve(mockSchedules);
      if (cmd === "get_accounts") return Promise.resolve(mockAccounts);
      return Promise.resolve(null);
    });
  });

  it("renders list of schedules", async () => {
    renderWithContext(<ScheduledList />);

    await waitFor(() => {
      expect(screen.getByText("Netflix")).toBeInTheDocument();
    });
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("opens form when Create button is clicked", async () => {
    renderWithContext(<ScheduledList />);
    await waitFor(() => screen.getByText("Netflix"));

    const createButton = screen.getByText("Create");
    fireEvent.click(createButton);

    expect(screen.getByPlaceholderText("Payee")).toBeInTheDocument();

    // ensure type toggle buttons render
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Investment")).toBeInTheDocument();
  });

  it("handles creating a new schedule", async () => {
    renderWithContext(<ScheduledList />);
    await waitFor(() => screen.getByText("Netflix"));

    // Open form
    fireEvent.click(screen.getByText("Create"));

    // Fill payee and account (regular transaction)
    fireEvent.change(screen.getByPlaceholderText("Payee"), {
      target: { value: "Amazon" },
    });
    const accountSelect = screen.getAllByTestId("custom-select")[0];
    fireEvent.change(accountSelect, { target: { value: "1" } });

    // Submit
    const buttons = screen.getAllByRole("button");
    const submitButton = buttons.find(
      (b) => b.textContent && b.textContent.includes("Create"),
    );
    if (!submitButton) throw new Error("Submit button not found");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "create_scheduled_transaction",
        expect.anything(),
      );
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      "Scheduled transaction created",
      {
        type: "success",
      },
    );
  });

  it("handles creating an investment schedule", async () => {
    renderWithContext(<ScheduledList />);
    await waitFor(() => screen.getByText("Netflix"));

    // Open form and toggle to investment type
    fireEvent.click(screen.getByText("Create"));
    const investToggle = screen.getByText("Investment");
    fireEvent.click(investToggle);

    // ticker field should appear via placeholder
    const tickerInput = screen.getByPlaceholderText("AAPL");
    expect(tickerInput).toBeInTheDocument();

    // Fill investment-specific fields
    fireEvent.change(tickerInput, {
      target: { value: "AAPL" },
    });
    const accountSelect2 = screen.getAllByTestId("custom-select")[0];
    fireEvent.change(accountSelect2, { target: { value: "1" } });

    // Submit
    const buttons2 = screen.getAllByRole("button");
    const submitButton2 = buttons2.find(
      (b) => b.textContent && b.textContent.includes("Create"),
    );
    if (!submitButton2) throw new Error("Submit button not found");
    fireEvent.click(submitButton2);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "create_scheduled_transaction",
        expect.objectContaining({
          args: expect.objectContaining({
            transactionType: "investment",
            ticker: "AAPL",
          }),
        }),
      );
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      "Scheduled transaction created",
      {
        type: "success",
      },
    );
  });

  it("handles deleting a schedule", async () => {
    mockConfirm.mockResolvedValue(true);

    renderWithContext(<ScheduledList />);
    await waitFor(() => screen.getByText("Netflix"));

    const trashBtn = screen.getByTestId("trash-icon").closest("button")!;
    fireEvent.click(trashBtn);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("delete_scheduled_transaction", {
        id: 1,
      });
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      "Scheduled transaction deleted",
      {
        type: "success",
      },
    );
  });

  it("shows context menu with toggle/edit/delete on right-click", async () => {
    renderWithContext(<ScheduledList />);
    await waitFor(() => screen.getByText("Netflix"));

    const rows = document.querySelectorAll("tbody tr");
    fireEvent.contextMenu(rows[0]);

    const portal = document.querySelector(".sched-action-menu-portal");
    expect(portal).toBeInTheDocument();
    expect(portal).toHaveTextContent("Update");
    expect(portal).toHaveTextContent("Delete");
  });

  it("dismisses context menu on outside click", async () => {
    renderWithContext(<ScheduledList />);
    await waitFor(() => screen.getByText("Netflix"));

    const rows = document.querySelectorAll("tbody tr");
    fireEvent.contextMenu(rows[0]);

    expect(
      document.querySelector(".sched-action-menu-portal"),
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(
      document.querySelector(".sched-action-menu-portal"),
    ).not.toBeInTheDocument();
  });
});
