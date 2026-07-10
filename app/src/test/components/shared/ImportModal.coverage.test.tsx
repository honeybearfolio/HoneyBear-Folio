import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import ImportModal from "../../../components/shared/ImportModal";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args) as Promise<unknown>,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const mockShowToast = vi.fn();
vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("../../../components/ui/Modal", () => {
  const Modal = ({ children }: { children?: ReactNode }) => (
    <div data-testid="modal">{children}</div>
  );
  const ModalHeader = ({ title }: { title?: ReactNode }) => (
    <div data-testid="modal-header">{title}</div>
  );
  const ModalBody = ({ children }: { children?: ReactNode }) => (
    <div data-testid="modal-body">{children}</div>
  );
  const ModalFooter = ({ children }: { children?: ReactNode }) => (
    <div data-testid="modal-footer">{children}</div>
  );
  return { Modal, ModalHeader, ModalBody, ModalFooter };
});

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
      data-testid={`mapping-select-${placeholder ?? "column"}`}
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

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;

  readAsText(blob: Blob) {
    void blob.text().then((text) => {
      this.result = text;
      this.onload?.({
        target: this,
      } as unknown as ProgressEvent<FileReader>);
    });
  }

  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onload?.({
        target: this,
      } as unknown as ProgressEvent<FileReader>);
    });
  }
}

function stubFileReader() {
  vi.stubGlobal("FileReader", MockFileReader);
}

function uploadFile(file: File) {
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

async function goToMappingStep() {
  await waitFor(() => {
    expect(screen.getByText("Next")).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText("Next"));
}

function defaultInvokeHandler(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  if (cmd === "get_accounts") {
    return Promise.resolve([
      { id: 1, name: "Checking", balance: 0, kind: "cash" },
    ]);
  }
  if (cmd === "get_assets") return Promise.resolve([]);
  if (cmd === "read_xlsx") {
    return Promise.resolve({
      sheets: [
        {
          name: "Transactions",
          data: [
            ["date", "payee", "amount", "account"],
            ["2024-03-01", "XLSX Store", "42", "Checking"],
          ],
        },
      ],
    });
  }
  if (cmd === "create_account") {
    return Promise.resolve({
      id: 5,
      name: args?.name ?? "Account",
      balance: 0,
      kind: args?.kind ?? "cash",
    });
  }
  if (cmd === "create_asset") {
    return Promise.resolve({
      id: 99,
      name: "House",
      category: "real_estate",
    });
  }
  if (cmd === "create_valuation") {
    return Promise.resolve({
      id: 1,
      asset_id: 99,
      date: "2024-06-01",
      value: 350000,
    });
  }
  if (cmd === "create_transaction") return Promise.resolve({});
  return Promise.resolve([]);
}

describe("ImportModal coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubFileReader();
    mockInvoke.mockImplementation(defaultInvokeHandler);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses and imports transactions from an xlsx file", async () => {
    const onImportComplete = vi.fn();
    const file = new File([new ArrayBuffer(8)], "transactions.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(
      <ImportModal onClose={vi.fn()} onImportComplete={onImportComplete} />,
    );

    uploadFile(file);

    await waitFor(() => {
      expect(screen.getByText("transactions.xlsx")).toBeInTheDocument();
    });

    await goToMappingStep();

    expect(screen.getByText("XLSX Store")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      const readCall = mockInvoke.mock.calls.find(
        ([cmd]) => cmd === "read_xlsx",
      );
      const readArgs = readCall![1] as { data?: unknown };
      expect(Array.isArray(readArgs.data)).toBe(true);

      const createCall = mockInvoke.mock.calls.find(
        ([cmd]) => cmd === "create_transaction",
      );
      expect(createCall?.[1]).toMatchObject({
        args: {
          payee: "XLSX Store",
          amount: 42,
        },
      });
      expect(onImportComplete).toHaveBeenCalled();
    });
  });

  it("shows excel parse error when read_xlsx fails", async () => {
    mockInvoke.mockImplementation(
      (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "read_xlsx") {
          return Promise.reject(new Error("Corrupt workbook"));
        }
        return defaultInvokeHandler(cmd, args);
      },
    );

    const file = new File([new ArrayBuffer(4)], "broken.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();

    expect(screen.getByText(/Corrupt workbook/)).toBeInTheDocument();
  });

  it("creates a new brokerage account during csv import when account is unknown", async () => {
    const file = new File(
      [
        "date,payee,amount,account,ticker,shares\n2024-04-01,Buy,-500,Brokerage,AAPL,10",
      ],
      "brokerage.csv",
      { type: "text/csv" },
    );

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_account", {
        name: "Brokerage",
        balance: 0,
        kind: "brokerage",
      });
      const createCall = mockInvoke.mock.calls.find(
        ([cmd]) => cmd === "create_transaction",
      );
      expect(createCall?.[1]).toMatchObject({
        args: {
          payee: "Buy",
          ticker: "AAPL",
        },
      });
    });
  });

  it("skips duplicate assets and reports asset import errors", async () => {
    mockInvoke.mockImplementation(
      (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "get_assets") {
          return Promise.resolve([
            { id: 1, name: "House", category: "real_estate" },
          ]);
        }
        if (cmd === "create_asset") {
          return Promise.reject(new Error("Asset DB locked"));
        }
        return defaultInvokeHandler(cmd, args);
      },
    );

    const exportPayload = {
      accounts: [{ id: 1, name: "Checking", balance: 0, kind: "cash" }],
      transactions: [],
      assets: [
        {
          name: "House",
          category: "real_estate",
          currency: "USD",
          valuations: [{ date: "2024-06-01", value: 350000 }],
        },
        {
          name: "Car",
          category: "vehicle",
          currency: "USD",
          valuations: [{ date: "2024-06-01", value: 25000 }],
        },
      ],
    };

    const file = new File([JSON.stringify(exportPayload)], "assets-edge.json", {
      type: "application/json",
    });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringMatching(/failed|error/i),
        { type: "error" },
      );
    });

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "create_asset",
      expect.objectContaining({ name: "House" }),
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      "create_asset",
      expect.objectContaining({ name: "Car" }),
    );
  });

  it("records row failures when create_account fails during import", async () => {
    mockInvoke.mockImplementation(
      (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "create_account") {
          return Promise.reject(new Error("Name already taken"));
        }
        if (cmd === "get_accounts") return Promise.resolve([]);
        return defaultInvokeHandler(cmd, args);
      },
    );

    const csv = "date,payee,amount,account\n2024-05-01,Store,10,New Account";
    const file = new File([csv], "create-fail.csv", { type: "text/csv" });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(
        screen.getByText("Import completed with errors"),
      ).toBeInTheDocument();
      expect(screen.getByText(/Name already taken/)).toBeInTheDocument();
    });
  });

  it("reports rows without account information as import errors", async () => {
    const csv = "date,payee,amount,account\n2024-01-15,Store,10,";
    const file = new File([csv], "missing-account.csv", { type: "text/csv" });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(
        screen.getByText("Import completed with errors"),
      ).toBeInTheDocument();
    });
  });

  it("accepts files dropped via browser drag-and-drop", async () => {
    const csv = "date,payee,amount,account\n2024-06-01,Drop Store,15,Checking";
    const file = new File([csv], "dropped.csv", { type: "text/csv" });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    const dropZone = screen
      .getByText("Drag and drop or click to select file")
      .closest("div")!;

    const dataTransfer = { files: [file], dropEffect: "none" };
    fireEvent.dragEnter(dropZone, { dataTransfer });
    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(screen.getByText("dropped.csv")).toBeInTheDocument();
    });
  });

  it("imports accounts and assets from xlsx sheets during import", async () => {
    mockInvoke.mockImplementation(
      (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "read_xlsx") {
          return Promise.resolve({
            sheets: [
              {
                name: "Transactions",
                data: [
                  ["date", "payee", "amount", "account"],
                  ["2024-07-01", "Shop", "20", "Checking"],
                ],
              },
              {
                name: "Accounts",
                data: [
                  ["name", "balance", "kind", "currency"],
                  ["New Savings", "2500", "cash", "USD"],
                ],
              },
              {
                name: "Assets",
                data: [
                  ["name", "category", "currency", "value", "date"],
                  ["Boat", "vehicle", "USD", "15000", "2024-07-01"],
                ],
              },
            ],
          });
        }
        return defaultInvokeHandler(cmd, args);
      },
    );

    const file = new File([new ArrayBuffer(8)], "full.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "create_account",
        expect.objectContaining({ name: "New Savings" }),
      );
      expect(mockInvoke).toHaveBeenCalledWith(
        "create_asset",
        expect.objectContaining({ name: "Boat" }),
      );
    });
  });

  it("ignores unsupported files dropped via browser drag-and-drop", () => {
    const file = new File(["data"], "notes.txt", { type: "text/plain" });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    const dropZone = screen
      .getByText("Drag and drop or click to select file")
      .closest("div")!;

    const dataTransfer = { files: [file], dropEffect: "none" };
    fireEvent.drop(dropZone, { dataTransfer });

    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("clears drag state when pointer leaves the drop zone", () => {
    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    const dropZone = screen
      .getByText("Drag and drop or click to select file")
      .closest("div")!;

    const dataTransfer = { files: [], dropEffect: "none" };
    fireEvent.dragEnter(dropZone, { dataTransfer });
    expect(screen.getByText("Drop file here")).toBeInTheDocument();

    fireEvent.dragLeave(dropZone, {
      dataTransfer,
      relatedTarget: document.body,
    });

    expect(screen.queryByText("Drop file here")).not.toBeInTheDocument();
  });
});
