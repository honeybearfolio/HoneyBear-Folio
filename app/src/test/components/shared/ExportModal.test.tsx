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

const {
  mockInvoke,
  mockSave,
  mockWriteTextFile,
  mockWriteFile,
  mockShowToast,
} = vi.hoisted(() => ({
  mockInvoke:
    vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
  mockSave: vi.fn<(opts?: Record<string, unknown>) => Promise<string | null>>(),
  mockWriteTextFile:
    vi.fn<(filePath: string, content: string) => Promise<void>>(),
  mockWriteFile:
    vi.fn<
      (filePath: string, content: Uint8Array | number[]) => Promise<void>
    >(),
  mockShowToast: vi.fn(),
}));

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: mockSave,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: mockWriteTextFile,
  writeFile: mockWriteFile,
}));

// Mock toast
vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// Mock format utility
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

describe("ExportModal", () => {
  type ExportJson = {
    assets: Array<{
      name: string;
      category: string;
      currency: string;
      notes: string | null;
      valuations: Array<{ date: string; value: number }>;
      latest_value: number;
      latest_date: string;
    }>;
  };

  const defaultProps = {
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useNumberFormatStore.setState({
      dateFormat: "DD/MM/YYYY",
      firstDayOfWeek: 0,
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_accounts") {
        return Promise.resolve([
          { id: 1, name: "Checking" },
          { id: 2, name: "Savings" },
        ]);
      }
      if (cmd === "get_all_transactions") {
        return Promise.resolve([
          { account_id: 1, date: "2024-01-15", amount: 100, payee: "Store" },
        ]);
      }
      if (cmd === "get_assets") {
        return Promise.resolve([
          {
            id: 1,
            name: "House",
            category: "real_estate",
            currency: "USD",
            notes: null,
            latest_value: 350000,
            latest_date: "2024-06-01",
            exchange_rate: 1.0,
          },
        ]);
      }
      if (cmd === "get_valuations") {
        return Promise.resolve([
          { id: 1, asset_id: 1, date: "2024-01-01", value: 300000 },
          { id: 2, asset_id: 1, date: "2024-06-01", value: 350000 },
        ]);
      }
      if (cmd === "get_liabilities") {
        return Promise.resolve([]);
      }
      if (cmd === "get_liability_valuations") {
        return Promise.resolve([]);
      }
      if (cmd === "compute_report_data") {
        return Promise.resolve({
          date_range_start: "2024-01-01",
          date_range_end: "2024-12-31",
          summary: {},
        });
      }
      return Promise.resolve(null);
    });
    mockSave.mockResolvedValue("/path/to/export.json");
    mockWriteTextFile.mockResolvedValue(undefined);
  });

  it("renders export modal with title", () => {
    render(<ExportModal {...defaultProps} />);

    expect(screen.getByText("Export Data")).toBeInTheDocument();
  });

  it("has format selection buttons", () => {
    render(<ExportModal {...defaultProps} />);

    // Look for format options
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("Excel")).toBeInTheDocument();
  });

  it("JSON format is selected by default", () => {
    render(<ExportModal {...defaultProps} />);

    // JSON should be the default format - has active class
    const jsonButton = screen.getByText("JSON").closest("button");
    expect(jsonButton).toHaveClass("format-button-active");
  });

  it("calls onClose when cancel is clicked", () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Cancel"));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("fetches accounts, transactions, and assets on export", async () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_accounts");
      expect(mockInvoke).toHaveBeenCalledWith("get_all_transactions");
      expect(mockInvoke).toHaveBeenCalledWith("get_assets");
      expect(mockInvoke).toHaveBeenCalledWith("get_valuations", {
        assetId: 1,
      });
    });
  });

  it("includes assets with valuations in JSON export", async () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalled();
    });

    const [, content] = mockWriteTextFile.mock.calls[0] as [string, string];
    const parsed = JSON.parse(content) as ExportJson;
    expect(parsed.assets).toEqual([
      {
        name: "House",
        category: "real_estate",
        currency: "USD",
        notes: null,
        valuations: [
          { date: "2024-01-01", value: 300000 },
          { date: "2024-06-01", value: 350000 },
        ],
        latest_value: 350000,
        latest_date: "2024-06-01",
      },
    ]);
  });

  it("opens save dialog with JSON filter for JSON format", async () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: "JSON", extensions: ["json"] }],
        }),
      );
    });
  });

  it("does not write file if save dialog is cancelled", async () => {
    mockSave.mockResolvedValue(null);

    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });

    expect(mockWriteTextFile).not.toHaveBeenCalled();
  });

  it("allows selecting CSV format", () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("CSV"));

    const csvButton = screen.getByText("CSV").closest("button");
    expect(csvButton).toHaveClass("format-button-active");
  });

  it("allows selecting Excel format", () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Excel"));

    const xlsxButton = screen.getByText("Excel").closest("button");
    expect(xlsxButton).toHaveClass("format-button-active");
  });

  it("calls write_xlsx with assets sheet for Excel format", async () => {
    mockSave.mockResolvedValue("/path/to/export.xlsx");
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("Excel"));
    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      const writeXlsxCall = mockInvoke.mock.calls.find(
        (call) => call[0] === "write_xlsx",
      );
      expect(writeXlsxCall).toBeDefined();
      const payload = writeXlsxCall?.[1] as {
        filePath: string;
        sheets: Array<{ name: string }>;
      };
      expect(payload.filePath).toBe("/path/to/export.xlsx");
      expect(payload.sheets.map((sheet) => sheet.name)).toEqual(
        expect.arrayContaining(["Transactions", "Accounts", "Assets"]),
      );
    });
  });

  it("allows selecting PDF format", () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("PDF Report"));
    const pdfButton = screen.getByText("PDF Report").closest("button");
    expect(pdfButton).toHaveClass("format-button-active");
  });

  it("opens save dialog with PDF filter for PDF format", async () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("PDF Report"));
    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: "PDF Report", extensions: ["pdf"] }],
        }),
      );
    });
  });

  it("calls generate_pdf_report when PDF format selected", async () => {
    mockSave.mockResolvedValue("/path/to/export.pdf");
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("PDF Report"));
    fireEvent.click(screen.getByText("Select Location & Export"));

    await waitFor(() => {
      const computeCall = mockInvoke.mock.calls.find(
        (call) => call[0] === "compute_report_data",
      );
      expect(computeCall).toBeDefined();
      const computePayload = computeCall?.[1] as {
        input: { startDate: string; endDate: string };
      };
      expect(typeof computePayload.input.startDate).toBe("string");
      expect(typeof computePayload.input.endDate).toBe("string");

      const generateCall = mockInvoke.mock.calls.find(
        (call) => call[0] === "generate_pdf_report",
      );
      expect(generateCall).toBeDefined();
      const generatePayload = generateCall?.[1] as {
        filePath: string;
        data: { date_range_start: string };
      };
      expect(generatePayload.filePath).toBe("/path/to/export.pdf");
      expect(typeof generatePayload.data.date_range_start).toBe("string");
    });
  });

  it("uses date format settings from number format store for PDF custom range", () => {
    render(<ExportModal {...defaultProps} />);

    fireEvent.click(screen.getByText("PDF Report"));
    fireEvent.change(screen.getByTestId("custom-select-ytd"), {
      target: { value: "custom" },
    });

    expect(mockGetDatePickerFormat).toHaveBeenCalledWith("DD/MM/YYYY");
    expect(mockDatePicker).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFormat: "picker-DD/MM/YYYY",
        calendarStartDay: 0,
      }),
    );
  });
});
