import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LiabilityTracker from "../../../features/liabilities/LiabilityTracker";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (v: unknown) =>
    typeof v === "number" ? String(v) : "",
  useParseNumber: () => (s: string) => Number(s),
  formatNumberForExport: (v: unknown) =>
    typeof v === "number" ? String(v) : "",
  getDatePickerFormat: () => "yyyy-MM-dd",
  parseCalendarDate: (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  },
  formatCalendarDate: (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${String(date.getFullYear())}-${month}-${day}`;
  },
  useFormatDate: () => (value: unknown) =>
    typeof value === "string" ? `shown:${value}` : "",
}));

vi.mock("../../../stores/number-format", () => ({
  useNumberFormat: () => ({
    locale: "en-US",
    setLocale: () => {},
    currency: "USD",
    setCurrency: () => {},
    dateFormat: "YYYY-MM-DD",
    setDateFormat: () => {},
    firstDayOfWeek: 1,
    setFirstDayOfWeek: () => {},
    uiLanguage: "en",
    setUiLanguage: () => {},
    formatNumber: (v: number) => String(v),
  }),
}));

const mockConfirm = vi.fn();
vi.mock("../../../stores/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

const mockShowToast = vi.fn();

vi.mock("../../../stores/toast", () => ({
  useToast: () => ({
    showToast: mockShowToast,
    toasts: [],
    removeToast: vi.fn(),
  }),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span>Plus</span>,
  Trash2: () => <span>Delete</span>,
  Edit: () => <span>Edit</span>,
  ChevronDown: () => <span>▼</span>,
  ChevronUp: () => <span>▲</span>,
  X: () => <span>X</span>,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockedInvoke = vi.mocked(invoke);

const MOCK_LIABILITIES = [
  {
    id: 1,
    name: "Mortgage",
    category: "mortgage",
    currency: "USD",
    notes: "Home loan",
    latest_value: 250000,
    latest_date: "2024-06-01",
    exchange_rate: 1.0,
  },
  {
    id: 2,
    name: "Credit Card",
    category: "credit_card",
    currency: "USD",
    notes: null,
    latest_value: 3000,
    latest_date: "2024-03-01",
    exchange_rate: 1.0,
  },
];

describe("LiabilityTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockReset();
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_liabilities") return Promise.resolve(MOCK_LIABILITIES);
      if (cmd === "get_liability_valuations") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  it("renders the liability list", async () => {
    render(<LiabilityTracker />);
    await waitFor(() => {
      expect(screen.getByText("Mortgage")).toBeInTheDocument();
      expect(screen.getByText("Credit Card")).toBeInTheDocument();
      expect(screen.getByText("Home loan")).toBeInTheDocument();
      expect(screen.getByText("shown:2024-06-01")).toBeInTheDocument();
    });
  });

  it("shows empty state when no liabilities", async () => {
    mockedInvoke.mockImplementation(() => Promise.resolve([]));
    render(<LiabilityTracker />);
    await waitFor(() => {
      expect(screen.getByText("No liabilities yet")).toBeInTheDocument();
    });
  });

  it("calls get_liabilities on mount", async () => {
    render(<LiabilityTracker />);
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("get_liabilities", {
        targetCurrency: "USD",
      });
    });
  });

  it("expands liability to show valuations panel", async () => {
    const mockValuations = [
      { id: 1, liability_id: 1, date: "2024-06-01", value: 250000 },
      { id: 2, liability_id: 1, date: "2024-01-01", value: 260000 },
    ];
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_liabilities") return Promise.resolve(MOCK_LIABILITIES);
      if (cmd === "get_liability_valuations")
        return Promise.resolve(mockValuations);
      return Promise.resolve(undefined);
    });

    render(<LiabilityTracker />);
    await waitFor(() => {
      expect(screen.getByText("Mortgage")).toBeInTheDocument();
      expect(screen.getAllByText("Balance History").length).toBeGreaterThan(0);
      expect(
        screen.getAllByTitle("Hide balance history").length,
      ).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByTitle("Hide balance history")[0]!);

    await waitFor(() => {
      expect(
        screen.getAllByTitle("Show balance history").length,
      ).toBeGreaterThan(0);
    });
  });

  it("opens add liability modal when clicking add button", async () => {
    render(<LiabilityTracker />);
    await waitFor(() => {
      expect(screen.getByText("Mortgage")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add Liability"));

    await waitFor(() => {
      expect(screen.getByText("Name")).toBeInTheDocument();
    });
  });

  it("calls onUpdate after saving a valuation", async () => {
    const onUpdate = vi.fn();
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_liabilities") return Promise.resolve(MOCK_LIABILITIES);
      if (cmd === "get_liability_valuations") return Promise.resolve([]);
      if (cmd === "create_liability_valuation")
        return Promise.resolve({
          id: 99,
          liability_id: 1,
          date: "2024-07-01",
          value: 240000,
        });
      return Promise.resolve(undefined);
    });

    render(<LiabilityTracker onUpdate={onUpdate} />);
    await waitFor(() => {
      expect(screen.getByText("Mortgage")).toBeInTheDocument();
    });

    const addValuationButtons = screen.getAllByText("Add Balance");
    fireEvent.click(addValuationButtons[0]!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "240000" },
    });
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
