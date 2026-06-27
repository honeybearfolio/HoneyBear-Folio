import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AssetTracker from "../../../features/assets/AssetTracker";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (v: unknown) => (v == null ? "" : String(v)),
  useParseNumber: () => (s: string) => Number(s),
  formatNumberForExport: (v: unknown) => String(v ?? ""),
  getDatePickerFormat: () => "yyyy-MM-dd",
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

vi.mock("../../../stores/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
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

const MOCK_ASSETS = [
  {
    id: 1,
    name: "House",
    category: "real_estate",
    currency: "USD",
    notes: "Primary residence",
    latest_value: 350000,
    latest_date: "2024-06-01",
    exchange_rate: 1.0,
  },
  {
    id: 2,
    name: "Car",
    category: "vehicle",
    currency: "EUR",
    notes: null,
    latest_value: 25000,
    latest_date: "2024-03-01",
    exchange_rate: 1.1,
  },
];

describe("AssetTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_assets") return MOCK_ASSETS;
      if (cmd === "get_valuations") return [];
      return undefined;
    });
  });

  it("renders the asset list", async () => {
    render(<AssetTracker />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
      expect(screen.getByText("Car")).toBeInTheDocument();
    });
  });

  it("shows empty state when no assets", async () => {
    mockedInvoke.mockImplementation(async () => []);
    render(<AssetTracker />);
    await waitFor(() => {
      expect(screen.getByText("No assets yet")).toBeInTheDocument();
    });
  });

  it("calls get_assets on mount", async () => {
    render(<AssetTracker />);
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("get_assets", {
        targetCurrency: "USD",
      });
    });
  });

  it("expands asset to show valuations panel", async () => {
    const mockValuations = [
      { id: 1, asset_id: 1, date: "2024-06-01", value: 350000 },
      { id: 2, asset_id: 1, date: "2024-01-01", value: 300000 },
    ];
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_assets") return MOCK_ASSETS;
      if (cmd === "get_valuations") return mockValuations;
      return undefined;
    });

    render(<AssetTracker />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });

    const expandButtons = screen.getAllByTitle("Show valuations");
    fireEvent.click(expandButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText("Value History")).toBeInTheDocument();
    });
  });

  it("opens add asset modal when clicking add button", async () => {
    render(<AssetTracker />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });

    const addButton = screen.getByText("Add Asset");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Name")).toBeInTheDocument();
    });
  });

  it("calls onUpdate after saving a valuation", async () => {
    const onUpdate = vi.fn();
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_assets") return MOCK_ASSETS;
      if (cmd === "get_valuations") return [];
      if (cmd === "create_valuation")
        return { id: 99, asset_id: 1, date: "2024-07-01", value: 400000 };
      return undefined;
    });

    render(<AssetTracker onUpdate={onUpdate} />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });

    // Open the add valuation modal for the first asset
    const addValuationButtons = screen.getAllByText("Add Valuation");
    fireEvent.click(addValuationButtons[0]!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    // Fill in value and submit
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "400000" },
    });
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it("calls onUpdate after deleting a valuation", async () => {
    const onUpdate = vi.fn();
    const mockValuations = [
      { id: 1, asset_id: 1, date: "2024-06-01", value: 350000 },
    ];
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_assets") return MOCK_ASSETS;
      if (cmd === "get_valuations") return mockValuations;
      if (cmd === "delete_valuation") return undefined;
      return undefined;
    });
    mockConfirm.mockResolvedValue(true);

    render(<AssetTracker onUpdate={onUpdate} />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });

    // Assets are auto-expanded; wait for the valuation delete button
    await waitFor(() => {
      expect(screen.getAllByTitle("Delete").length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByTitle("Delete");
    fireEvent.click(deleteButtons[0]!);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it("calls onUpdate after saving an asset", async () => {
    const onUpdate = vi.fn();
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_assets") return MOCK_ASSETS;
      if (cmd === "get_valuations") return [];
      if (cmd === "create_asset")
        return { id: 3, name: "Boat", category: "other", currency: "USD" };
      return undefined;
    });

    render(<AssetTracker onUpdate={onUpdate} />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add Asset"));
    await waitFor(() => {
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("e.g. Primary Residence"), {
      target: { value: "Boat" },
    });
    fireEvent.submit(
      screen.getByPlaceholderText("e.g. Primary Residence").closest("form")!,
    );

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
