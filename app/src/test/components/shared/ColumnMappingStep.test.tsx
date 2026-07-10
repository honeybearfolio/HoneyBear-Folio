import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ColumnMappingStep from "../../../components/shared/ColumnMappingStep";
import type { FieldMapping } from "../../../components/shared/import-types";

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
      data-testid={`mapping-select-${placeholder}`}
      aria-label={placeholder}
      value={value}
      onChange={(e) => {
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

const defaultMapping: FieldMapping = {
  date: "",
  payee: "",
  amount: "",
  category: "",
  notes: "",
  account: "",
  ticker: "",
  shares: "",
  price: "",
  fee: "",
  currency: "",
};

const file = new File(["date,payee,amount\n2024-01-01,Store,-10"], "transactions.csv", {
  type: "text/csv",
});

function renderStep(overrides: Record<string, unknown> = {}) {
  const setMapping = vi.fn();
  const setFile = vi.fn();

  const props = {
    file,
    columns: ["date", "payee", "amount", "category"],
    mapping: defaultMapping,
    setMapping,
    setFile,
    previewRows: [{ date: "2024-01-01", payee: "Store", amount: "-10", category: "Food" }],
    parseError: null,
    importing: false,
    progress: { current: 0, total: 0, success: 0, failed: 0 },
    showImportSummary: false,
    importErrors: [],
    ...overrides,
  };

  return { props, setMapping, setFile, ...render(<ColumnMappingStep {...props} />) };
}

describe("ColumnMappingStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders file name and mapping controls", () => {
    renderStep();

    expect(screen.getByText("transactions.csv")).toBeInTheDocument();
    expect(screen.getByText("Map Columns")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("shows preview table with parsed rows", () => {
    renderStep();

    expect(screen.getByText("Store")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("-10")).toBeInTheDocument();
  });

  it("updates mapping when a column is selected", async () => {
    const user = userEvent.setup();
    const { setMapping } = renderStep();

    const selects = screen.getAllByLabelText("Select column");
    await user.selectOptions(selects[0]!, "date");

    expect(setMapping).toHaveBeenCalledWith({ ...defaultMapping, date: "date" });
  });

  it("clears file when change file is clicked", async () => {
    const user = userEvent.setup();
    const { setFile } = renderStep();

    await user.click(screen.getByRole("button", { name: "Change File" }));

    expect(setFile).toHaveBeenCalledWith(null);
  });

  it("shows parse error when provided", () => {
    renderStep({ parseError: "Invalid CSV format", previewRows: [] });

    expect(screen.getByText("Invalid CSV format")).toBeInTheDocument();
  });

  it("shows import progress while importing", () => {
    renderStep({
      importing: true,
      progress: { current: 5, total: 10, success: 4, failed: 1 },
    });

    expect(screen.getByText("Importing...")).toBeInTheDocument();
    expect(screen.getByText("5 / 10")).toBeInTheDocument();
    const progressSection = screen.getByText("Importing...").closest(".bg-slate-100");
    expect(progressSection?.textContent).toContain("Success");
    expect(progressSection?.textContent).toContain("Import failed");
  });

  it("shows error summary after import with failures", () => {
    renderStep({
      showImportSummary: true,
      importErrors: [{ row: 2, error: "Invalid amount" }],
    });

    expect(screen.getByText("Import completed with errors")).toBeInTheDocument();
    expect(screen.getByText(/Invalid amount/)).toBeInTheDocument();
    expect(screen.getByText(/Row 3/)).toBeInTheDocument();
  });
});
