import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import ImportModal from "../../../components/shared/ImportModal";

// Mock Tauri/Event
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

// Mock Toast
const mockShowToast = vi.fn();
vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// Mock children
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

describe("ImportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(
      (cmd: string, args?: Record<string, unknown>) => {
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
      },
    );
  });

  it("renders upload interface initially", () => {
    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    expect(screen.getByText("Import Transactions")).toBeInTheDocument();
    expect(
      screen.getByText("Drag and drop or click to select file"),
    ).toBeInTheDocument();
  });

  it("handles file selection", () => {
    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    expect(
      screen.getByText("Supports .csv, .xlsx, .xls, .json"),
    ).toBeInTheDocument();
  });

  it("imports assets from legacy HoneyBear JSON export", async () => {
    const onImportComplete = vi.fn();
    const exportPayload = {
      accounts: [{ id: 1, name: "Checking", balance: 0, kind: "cash" }],
      transactions: [
        {
          date: "2024-01-15",
          payee: "Store",
          amount: 100,
          account: "Checking",
        },
      ],
      assets: [
        {
          id: 1,
          name: "House",
          category: "real_estate",
          currency: "USD",
          notes: null,
          latest_value: 350000,
          latest_date: "2024-06-01",
          exchange_rate: 1,
        },
      ],
      exportDate: "2024-06-01T00:00:00.000Z",
    };

    const file = new File(
      [JSON.stringify(exportPayload)],
      "legacy-export.json",
      {
        type: "application/json",
      },
    );

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText(blob: Blob) {
        blob.text().then((text) => {
          this.result = text;
          this.onload?.({
            target: this,
          } as unknown as ProgressEvent<FileReader>);
        });
      }
      readAsArrayBuffer() {}
    }

    vi.stubGlobal("FileReader", MockFileReader);

    render(
      <ImportModal onClose={vi.fn()} onImportComplete={onImportComplete} />,
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("legacy-export.json")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_accounts");
      expect(mockInvoke).toHaveBeenCalledWith("create_asset", {
        name: "House",
        category: "real_estate",
        currency: "USD",
        notes: undefined,
      });
      expect(mockInvoke).toHaveBeenCalledWith("create_valuation", {
        assetId: 99,
        date: "2024-06-01",
        value: 350000,
      });
    });

    vi.unstubAllGlobals();
  });

  it("imports assets from HoneyBear JSON export", async () => {
    const onImportComplete = vi.fn();
    const exportPayload = {
      accounts: [{ id: 1, name: "Checking", balance: 0, kind: "cash" }],
      transactions: [
        {
          date: "2024-01-15",
          payee: "Store",
          amount: 100,
          account: "Checking",
        },
      ],
      assets: [
        {
          name: "House",
          category: "real_estate",
          currency: "USD",
          valuations: [{ date: "2024-06-01", value: 350000 }],
        },
      ],
    };

    const file = new File([JSON.stringify(exportPayload)], "export.json", {
      type: "application/json",
    });

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText(blob: Blob) {
        blob.text().then((text) => {
          this.result = text;
          this.onload?.({
            target: this,
          } as unknown as ProgressEvent<FileReader>);
        });
      }
      readAsArrayBuffer() {}
    }

    vi.stubGlobal("FileReader", MockFileReader);

    render(
      <ImportModal onClose={vi.fn()} onImportComplete={onImportComplete} />,
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("export.json")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(screen.getByText("Start Import")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_accounts");
      expect(mockInvoke).toHaveBeenCalledWith("create_asset", {
        name: "House",
        category: "real_estate",
        currency: "USD",
        notes: undefined,
      });
      expect(mockInvoke).toHaveBeenCalledWith("create_valuation", {
        assetId: 99,
        date: "2024-06-01",
        value: 350000,
      });
      expect(onImportComplete).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });

  it("imports accounts from HoneyBear JSON export", async () => {
    const onImportComplete = vi.fn();
    const exportPayload = {
      accounts: [
        { id: 1, name: "Checking", balance: 0, kind: "cash" },
        {
          id: 2,
          name: "Savings",
          balance: 5000,
          kind: "cash",
          currency: "USD",
        },
      ],
      transactions: [
        {
          date: "2024-01-15",
          payee: "Store",
          amount: 100,
          account: "Checking",
        },
      ],
      assets: [],
    };

    const file = new File([JSON.stringify(exportPayload)], "accounts.json", {
      type: "application/json",
    });

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText(blob: Blob) {
        blob.text().then((text) => {
          this.result = text;
          this.onload?.({
            target: this,
          } as unknown as ProgressEvent<FileReader>);
        });
      }
      readAsArrayBuffer() {}
    }

    vi.stubGlobal("FileReader", MockFileReader);

    render(
      <ImportModal onClose={vi.fn()} onImportComplete={onImportComplete} />,
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("accounts.json")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_accounts");
      expect(mockInvoke).toHaveBeenCalledWith("create_account", {
        name: "Savings",
        balance: 5000,
        kind: "cash",
        currency: "USD",
      });
      expect(onImportComplete).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });

  it("imports accounts without transactions from HoneyBear JSON export", async () => {
    const onImportComplete = vi.fn();
    mockInvoke.mockImplementation(
      (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "get_accounts") return Promise.resolve([]);
        if (cmd === "get_assets") return Promise.resolve([]);
        if (cmd === "create_account") {
          return Promise.resolve({
            id: 3,
            name: args?.name ?? "Account",
            balance: args?.balance ?? 0,
            kind: args?.kind ?? "cash",
          });
        }
        return Promise.resolve([]);
      },
    );

    const exportPayload = {
      accounts: [{ name: "Vacation Fund", balance: 1200, kind: "cash" }],
      transactions: [],
      assets: [],
    };

    const file = new File(
      [JSON.stringify(exportPayload)],
      "accounts-only.json",
      {
        type: "application/json",
      },
    );

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText(blob: Blob) {
        blob.text().then((text) => {
          this.result = text;
          this.onload?.({
            target: this,
          } as unknown as ProgressEvent<FileReader>);
        });
      }
      readAsArrayBuffer() {}
    }

    vi.stubGlobal("FileReader", MockFileReader);

    render(
      <ImportModal onClose={vi.fn()} onImportComplete={onImportComplete} />,
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("accounts-only.json")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Start Import"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_accounts");
      expect(mockInvoke).toHaveBeenCalledWith("create_account", {
        name: "Vacation Fund",
        balance: 1200,
        kind: "cash",
        currency: undefined,
      });
      expect(onImportComplete).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });
});
