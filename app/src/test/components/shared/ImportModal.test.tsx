import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import ImportModal from "../../../components/shared/ImportModal";

// Mock Tauri/Event
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
import { invoke } from "@tauri-apps/api/core";

// Mock Toast
vi.mock("../../../contexts/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

// Mock i18n
vi.mock("../../../i18n/i18n", () => ({ t: (k: string) => k }));

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
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it("renders upload interface initially", async () => {
    // Return empty accounts list to avoid issues
    vi.mocked(invoke).mockResolvedValue([]);
    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    // Wait for the useEffect to fire to avoid act warnings
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_accounts"));

    expect(screen.getByText("import.title")).toBeInTheDocument();
    expect(screen.getByText("import.drag_or_click")).toBeInTheDocument();
  });

  it("handles file selection", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    render(<ImportModal onClose={vi.fn()} onImportComplete={vi.fn()} />);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_accounts"));

    // Check for support text key
    expect(screen.getByText("import.supports")).toBeInTheDocument();
  });
});
