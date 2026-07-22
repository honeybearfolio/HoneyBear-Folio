import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ExportModal from "../../../components/shared/ExportModal";
import { useNumberFormatStore } from "../../../stores/number-format";

const { mockGetDatePickerFormat, mockDatePicker } = vi.hoisted(() => ({
  mockGetDatePickerFormat: vi.fn((key: string) => `picker-${key}`),
  mockDatePicker: vi.fn(
    (_props: { dateFormat?: string; calendarStartDay?: number }) => (
      <input data-testid="datepicker" />
    ),
  ),
}));

const { mockInvoke, mockSave, mockWriteTextFile, mockShowToast } = vi.hoisted(
  () => ({
    mockInvoke:
      vi.fn<
        (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
      >(),
    mockSave:
      vi.fn<(opts?: Record<string, unknown>) => Promise<string | null>>(),
    mockWriteTextFile:
      vi.fn<(filePath: string, content: string) => Promise<void>>(),
    mockShowToast: vi.fn(),
  }),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: mockSave,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: mockWriteTextFile,
}));

vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("../../../utils/format", () => ({
  formatNumberForExport: (v: unknown) =>
    typeof v === "number" || typeof v === "string" ? String(v) : "",
  getDatePickerFormat: (key: string) => mockGetDatePickerFormat(key),
}));

vi.mock("react-datepicker", () => ({
  default: (props: unknown) =>
    mockDatePicker(props as { dateFormat?: string; calendarStartDay?: number }),
}));

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
  }: {
    value: string | number;
    onChange: (v: string | number) => void;
    options: { value: string | number; label: string }[];
  }) => (
    <select
      data-testid={`custom-select-${String(value)}`}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("../../../utils/investments", () => ({
  buildHoldingsFromTransactions: () =>
    Promise.resolve({ currentHoldings: [{ ticker: "AAPL" }] }),
}));

describe("ExportModal extended", () => {
  const defaultProps = { onClose: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    useNumberFormatStore.setState({
      dateFormat: "DD/MM/YYYY",
      firstDayOfWeek: 0,
      currency: "USD",
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_accounts") {
        return Promise.resolve([
          { id: 1, name: "Checking", balance: 500, currency: "USD" },
        ]);
      }
      if (cmd === "get_all_transactions") {
        return Promise.resolve([
          {
            account_id: 1,
            date: "2024-01-15",
            amount: 100,
            payee: "Store",
            category: "Food",
            notes: "groceries",
            ticker: null,
            shares: null,
            price_per_share: null,
            fee: null,
            currency: "USD",
          },
        ]);
      }
      if (cmd === "get_assets") return Promise.resolve([]);
      if (cmd === "get_liabilities") return Promise.resolve([]);
      if (cmd === "get_liability_valuations") return Promise.resolve([]);
      if (cmd === "compute_report_data") {
        return Promise.resolve({
          date_range_start: "2024-01-01",
          date_range_end: "2024-12-31",
          summary: {},
        });
      }
      if (cmd === "get_all_exchange_rates") {
        return Promise.resolve([{ currency: "EUR", rate: 1.1 }]);
      }
      if (cmd === "get_daily_stock_prices") {
        return Promise.resolve([{ date: "2024-01-01", price: 1.1 }]);
      }
      if (cmd === "get_stock_quotes") {
        return Promise.resolve([{ ticker: "AAPL", price: 150 }]);
      }
      return Promise.resolve(null);
    });
    mockSave.mockResolvedValue("/path/to/export.csv");
    mockWriteTextFile.mockResolvedValue(undefined);
  });

  it("maps account names in JSON export", async () => {
    mockSave.mockResolvedValue("/path/to/export.json");
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalled();
    });

    const [, content] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(content) as {
      transactions: Array<{ account: string }>;
    };
    expect(parsed.transactions[0]?.account).toBe("Checking");
  });

  it("writes CSV with headers and escaped values", async () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("CSV"));
    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalled();
    });

    const [, content] = mockWriteTextFile.mock.calls[0] as [string, string];
    const lines = content.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Account");
    expect(lines[1]).toContain("Checking");
    expect(lines[1]).toContain("Store");
    expect(lines[1]).toContain("100");
  });

  it("opens save dialog with CSV filter", async () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("CSV"));
    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: "CSV", extensions: ["csv"] }],
        }),
      );
    });
  });

  it("shows success toast and closes on successful export", async () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("/path/to/export.csv"),
        { type: "success" },
      );
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it("shows annual year selector for PDF annual range", () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("PDF Report"));
    fireEvent.change(screen.getByTestId("custom-select-ytd"), {
      target: { value: "annual" },
    });

    expect(screen.getByText("Select Year")).toBeInTheDocument();
    expect(screen.getByTestId("custom-select-2026")).toBeInTheDocument();
  });

  it("shows month selector for PDF monthly range", () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("PDF Report"));
    fireEvent.change(screen.getByTestId("custom-select-ytd"), {
      target: { value: "month" },
    });

    expect(screen.getByText("Select Month")).toBeInTheDocument();
  });

  it("fetches exchange rates and stock quotes for PDF export", async () => {
    mockSave.mockResolvedValue("/path/to/report.pdf");
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("PDF Report"));
    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_all_exchange_rates", {
        appCurrency: "USD",
      });
      expect(mockInvoke).toHaveBeenCalledWith("get_stock_quotes", {
        tickers: ["AAPL"],
      });
      expect(mockInvoke).toHaveBeenCalledWith(
        "generate_pdf_report",
        expect.objectContaining({
          filePath: "/path/to/report.pdf",
        }),
      );
    });
  });

  it("shows error toast when export fails", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_accounts") return Promise.reject(new Error("boom"));
      return Promise.resolve(null);
    });

    render(<ExportModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), {
        type: "error",
      });
    });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("disables export button while exporting", async () => {
    let resolveAccounts: (v: unknown) => void;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_accounts") {
        return new Promise((resolve) => {
          resolveAccounts = resolve;
        });
      }
      return Promise.resolve([]);
    });

    render(<ExportModal {...defaultProps} />);
    const exportButton = screen.getByRole("button", {
      name: /Select Location & Export/i,
    });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText("Exporting...")).toBeInTheDocument();
    });
    expect(exportButton).toBeDisabled();

    resolveAccounts!([{ id: 1, name: "Checking" }]);
    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalled();
    });
  });
});
