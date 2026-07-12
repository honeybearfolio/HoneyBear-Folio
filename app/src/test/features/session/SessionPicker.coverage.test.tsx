import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import SessionPicker from "../../../features/session/SessionPicker";
import { save, open } from "@tauri-apps/plugin-dialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
  open: vi.fn(),
}));

vi.mock("../../../api/tauri-client", () => ({
  rust: {
    get_recent_sessions: vi.fn().mockResolvedValue([]),
    open_session: vi.fn(),
    create_session: vi.fn(),
    remove_recent_session: vi.fn().mockResolvedValue(undefined),
    rename_session: vi.fn().mockResolvedValue(undefined),
  },
}));

import { rust } from "../../../api/tauri-client";

vi.mock("lucide-react", () => ({
  Plus: () => <span>Plus</span>,
  FolderOpen: () => <span>FolderOpen</span>,
  Trash2: () => <span>Trash2</span>,
  Pencil: () => <span>Pencil</span>,
  Check: () => <span>Check</span>,
  X: () => <span>X</span>,
  Database: () => <span>Database</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
}));

describe("SessionPicker coverage", () => {
  const mockOnSessionReady = vi.fn();

  const sampleSession = {
    path: "/home/user/personal.db",
    name: "Personal Finances",
    last_opened: new Date().toISOString(),
    file_exists: true,
    file_size: 1048576,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rust.get_recent_sessions).mockResolvedValue([sampleSession]);
  });

  it("renames a session from the recent list", async () => {
    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("Personal Finances")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Rename"));

    const input = screen.getByDisplayValue("Personal Finances");
    fireEvent.change(input, { target: { value: "My Portfolio" } });

    const checkBtn = input.parentElement?.querySelectorAll("button")[0];
    fireEvent.click(checkBtn!);

    await waitFor(() => {
      expect(rust.rename_session).toHaveBeenCalledWith({
        path: "/home/user/personal.db",
        newName: "My Portfolio",
      });
      expect(screen.getByText("My Portfolio")).toBeInTheDocument();
    });
  });

  it("opens an existing session via file dialog", async () => {
    vi.mocked(open).mockResolvedValue("/home/user/existing.db");
    vi.mocked(rust.open_session).mockResolvedValue({
      path: "/home/user/existing.db",
      name: "Existing",
    });

    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => screen.getByText("Open Existing"));

    fireEvent.click(screen.getByText("Open Existing"));

    await waitFor(() => {
      expect(open).toHaveBeenCalled();
      expect(rust.open_session).toHaveBeenCalledWith({
        path: "/home/user/existing.db",
      });
      expect(mockOnSessionReady).toHaveBeenCalledWith({
        path: "/home/user/existing.db",
        name: "Existing",
      });
    });
  });

  it("shows error when create session fails", async () => {
    vi.mocked(save).mockResolvedValue("/home/user/new.db");
    vi.mocked(rust.create_session).mockRejectedValue("Disk full");

    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => screen.getByText("Create New Session"));

    fireEvent.click(screen.getByText("Create New Session"));

    await waitFor(() => {
      expect(screen.getByText("Disk full")).toBeInTheDocument();
    });
  });

  it("shows error when loading recent sessions fails", async () => {
    vi.mocked(rust.get_recent_sessions).mockRejectedValue(
      new Error("Registry unavailable"),
    );

    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("Registry unavailable")).toBeInTheDocument();
    });
  });

  it("deletes a session from the recent list", async () => {
    const user = userEvent.setup();
    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => screen.getByText("Personal Finances"));

    await user.click(screen.getByTitle("Remove from list"));

    await waitFor(() => {
      expect(rust.remove_recent_session).toHaveBeenCalledWith({
        path: "/home/user/personal.db",
      });
      expect(screen.queryByText("Personal Finances")).not.toBeInTheDocument();
    });
  });

  it("cancels session rename with escape key", async () => {
    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => screen.getByText("Personal Finances"));

    fireEvent.click(screen.getByTitle("Rename"));

    const input = screen.getByDisplayValue("Personal Finances");
    fireEvent.change(input, { target: { value: "Draft Name" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByText("Personal Finances")).toBeInTheDocument();
    expect(rust.rename_session).not.toHaveBeenCalled();
  });
});
