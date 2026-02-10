import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ScheduledList from "../../../features/scheduled/ScheduledList";
import { NumberFormatContext } from "../../../contexts/number-format";
import { invoke } from "@tauri-apps/api/core";

// Mock dependencies
vi.mock("../../../utils/currencies", () => ({
  CURRENCIES: [{ code: "USD", symbol: "$" }],
}));

vi.mock("react-datepicker", () => ({
  default: (props) => <input data-testid="datepicker" {...props} value={props.selected ? props.selected.toISOString().split("T")[0] : ""} onChange={(e) => props.onChange(new Date(e.target.value))} />,
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
}));

vi.mock("../../../i18n/i18n", () => ({
  t: (key) => key,
}));

// Mock hooks
const mockConfirm = vi.fn();
const mockShowToast = vi.fn();

vi.mock("../../../contexts/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

vi.mock("../../../contexts/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// Mock CustomSelect
vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({ value, onChange, options, placeholder }) => (
    <select 
      data-testid="custom-select" 
      value={value || ""} 
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
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

// Mock NumberInput
vi.mock("../../../components/ui/NumberInput", () => ({
  default: ({ value, onChange, placeholder, className }) => (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("../../../utils/format", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useFormatNumber: () => (val) => String(val),
    useFormatDate: () => (date) => String(date).split("T")[0],
  };
});

const renderWithContext = (ui) => {
  return render(
    <NumberFormatContext.Provider value={{ 
      formatNumber: (v) => String(v), 
      dateFormat: "YYYY-MM-DD",
      firstDayOfWeek: 0
    }}>
      {ui}
    </NumberFormatContext.Provider>
  );
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
      weekday: 1
    }
  ];
  
  const mockAccounts = [
    { id: 1, name: "Checking", currency: "USD" }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockImplementation((cmd) => {
      if (cmd === "get_scheduled_transactions") return Promise.resolve(mockSchedules);
      if (cmd === "get_accounts") return Promise.resolve(mockAccounts);
      return Promise.resolve(null);
    });
  });

  it("renders list of schedules", async () => {
    renderWithContext(<ScheduledList />);
    
    await waitFor(() => {
      expect(screen.getByText("Netflix")).toBeInTheDocument();
    });
    expect(screen.getByText("scheduled.create")).toBeInTheDocument();
  });

  it("opens form when Create button is clicked", async () => {
    renderWithContext(<ScheduledList />);
    await waitFor(() => screen.getByText("Netflix"));

    const createButton = screen.getByText("scheduled.create");
    fireEvent.click(createButton);

    expect(screen.getByPlaceholderText("scheduled.field.payee")).toBeInTheDocument();
  });

  it("handles creating a new schedule", async () => {
     renderWithContext(<ScheduledList />);
     await waitFor(() => screen.getByText("Netflix"));

     // Open form
     fireEvent.click(screen.getByText("scheduled.create"));

     // Fill form
     fireEvent.change(screen.getByPlaceholderText("scheduled.field.payee"), { target: { value: "Amazon" } });
     
     // Select account
     const accountSelect = screen.getAllByTestId("custom-select")[0];
     fireEvent.change(accountSelect, { target: { value: "1" } });
     
     // Submit
     const buttons = screen.getAllByRole('button');
     // Find button that contains "scheduled.create"
     const submitButton = buttons.find(b => b.textContent && b.textContent.includes("scheduled.create"));
     if (!submitButton) throw new Error("Submit button not found");
     fireEvent.click(submitButton);

     await waitFor(() => {
       expect(invoke).toHaveBeenCalledWith("create_scheduled_transaction", expect.anything());
     });
     
     expect(mockShowToast).toHaveBeenCalledWith("scheduled.created_success", "success");
  });

  it("handles deleting a schedule", async () => {
    mockConfirm.mockResolvedValue(true);
    
    renderWithContext(<ScheduledList />);
    await waitFor(() => screen.getByText("Netflix"));

    const trashBtn = screen.getByTestId("trash-icon").closest("button");
    fireEvent.click(trashBtn);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    
    await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("delete_scheduled_transaction", { id: 1 });
    });
    
    expect(mockShowToast).toHaveBeenCalledWith("scheduled.deleted_success", "success");
  });
});
