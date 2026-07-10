import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
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

  readAsArrayBuffer() {}
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
  if (cmd === "create_account") {
    return Promise.resolve({
      id: 2,
      name: args?.name ?? "Account",
      balance: args?.balance ?? 0,
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

describe("ImportModal extended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubFileReader();
    mockInvoke.mockImplementation(defaultInvokeHandler);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps CSV columns on the mapping step and imports transactions", async () => {
    const user = userEvent.setup();
    const onImportComplete = vi.fn();
    const csv =
      "date,payee,amount,account,category\n2024-01-15,Store,-25,Checking,Food";
    const file = new File([csv], "transactions.csv", { type: "text/csv" });

    render(
      <ImportModal onClose={vi.fn()} onImportComplete={onImportComplete} />,
    );

    uploadFile(file);

    await waitFor(() => {
      expect(screen.getByText("transactions.csv")).toBeInTheDocument();
    });

    await goToMappingStep();

    expect(screen.getByText("Map Columns")).toBeInTheDocument();
    expect(screen.getByText("Store")).toBeInTheDocument();

    const mappingSelects = screen.getAllByLabelText("Select column");
    await user.selectOptions(mappingSelects[4]!, "category");

    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "create_transaction",
        expect.objectContaining({
          args: expect.objectContaining({
            payee: "Store",
            amount: -25,
            category: "Food",
          }),
        }),
      );
      expect(onImportComplete).toHaveBeenCalled();
    });
  });

  it("shows import progress while rows are being processed", async () => {
    let resolveCreate: (() => void) | undefined;
    const createPromise = new Promise<void>((resolve) => {
      resolveCreate = resolve;
    });

    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "create_transaction") return createPromise;
      return defaultInvokeHandler(cmd, args);
    });

    const csv =
      "date,payee,amount,account\n2024-01-15,Store,10,Checking\n2024-01-16,Shop,20,Checking";
    const file = new File([csv], "progress.csv", { type: "text/csv" });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    expect((await screen.findAllByText("Importing...")).length).toBeGreaterThan(
      0,
    );

    resolveCreate?.();
    await waitFor(() => {
      expect(screen.queryAllByText("Importing...")).toHaveLength(0);
    });
  });

  it("shows error summary when some rows fail to import", async () => {
    let callCount = 0;
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "create_transaction") {
        callCount += 1;
        if (callCount === 2) {
          return Promise.reject(new Error("Invalid amount"));
        }
        return Promise.resolve({});
      }
      return defaultInvokeHandler(cmd, args);
    });

    const csv =
      "date,payee,amount,account\n2024-01-15,Store,10,Checking\n2024-01-16,Bad,20,Checking";
    const file = new File([csv], "partial-fail.csv", { type: "text/csv" });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(screen.getByText("Import completed with errors")).toBeInTheDocument();
      expect(screen.getByText(/Invalid amount/)).toBeInTheDocument();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("failed"),
      { type: "error" },
    );
  });

  it("imports transactions from a top-level JSON array", async () => {
    const onImportComplete = vi.fn();
    const payload = [
      {
        date: "2024-01-15",
        payee: "Array Store",
        amount: 55,
        account: "Checking",
      },
    ];
    const file = new File([JSON.stringify(payload)], "array.json", {
      type: "application/json",
    });

    render(
      <ImportModal onClose={vi.fn()} onImportComplete={onImportComplete} />,
    );

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "create_transaction",
        expect.objectContaining({
          args: expect.objectContaining({ payee: "Array Store", amount: 55 }),
        }),
      );
      expect(onImportComplete).toHaveBeenCalled();
    });
  });

  it("imports transactions from JSON with a data property", async () => {
    const onImportComplete = vi.fn();
    const payload = {
      data: [
        {
          date: "2024-02-01",
          payee: "Data Store",
          amount: 75,
          account: "Checking",
        },
      ],
    };
    const file = new File([JSON.stringify(payload)], "data-key.json", {
      type: "application/json",
    });

    render(
      <ImportModal onClose={vi.fn()} onImportComplete={onImportComplete} />,
    );

    uploadFile(file);
    await goToMappingStep();
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "create_transaction",
        expect.objectContaining({
          args: expect.objectContaining({ payee: "Data Store", amount: 75 }),
        }),
      );
      expect(onImportComplete).toHaveBeenCalled();
    });
  });

  it("shows unsupported JSON structure error on the mapping step", async () => {
    const file = new File([JSON.stringify({ meta: "only metadata" })], "bad.json", {
      type: "application/json",
    });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();

    expect(
      screen.getByText(/unsupported json structure/i),
    ).toBeInTheDocument();
  });

  it("shows JSON parse error for invalid JSON files", async () => {
    const file = new File(["{ not valid json"], "broken.json", {
      type: "application/json",
    });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();

    expect(screen.getByText(/failed to parse json/i)).toBeInTheDocument();
  });

  it("disables start import when CSV has no account column mapped", async () => {
    const csv = "date,payee,amount\n2024-01-15,Store,10";
    const file = new File([csv], "no-account.csv", { type: "text/csv" });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();

    const startImportButton = screen.getByText("Start Import").closest("button");
    expect(startImportButton).toBeDisabled();

    fireEvent.click(screen.getByText("Start Import"));

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "create_transaction",
      expect.anything(),
    );
  });

  it("navigates back from mapping step to file review", async () => {
    const csv = "date,payee,amount,account\n2024-01-15,Store,10,Checking";
    const file = new File([csv], "back-nav.csv", { type: "text/csv" });

    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    uploadFile(file);
    await goToMappingStep();

    expect(screen.getByText("Map Columns")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back"));

    expect(
      screen.getByText(/file loaded/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Map Columns")).not.toBeInTheDocument();
  });
});
