import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AssetTracker from "../../../features/assets/AssetTracker";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (v: unknown) => (v == null ? "" : String(v)),
  useParseNumber: () => (s: string) => Number(s),
  formatNumberForExport: (v: unknown) => String(v ?? ""),
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
    fireEvent.click(expandButtons[0]);

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
});
