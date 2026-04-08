import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SessionPicker from "../../../features/session/SessionPicker";

// Mock i18n
vi.mock("../../../i18n/i18n", () => ({
  t: (key: string) => key,
}));

// Mock Tauri dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
  open: vi.fn(),
}));

// Mock rust API — must be inline (vi.mock is hoisted)
vi.mock("../../../api/tauri-client", () => ({
  rust: {
    get_recent_sessions: vi.fn().mockResolvedValue([]),
    open_session: vi.fn(),
    create_session: vi.fn(),
    remove_recent_session: vi.fn().mockResolvedValue(undefined),
    rename_session: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mock so we can reference the mocked module
import { rust } from "../../../api/tauri-client";

// Mock lucide-react icons
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

describe("SessionPicker", () => {
  const mockOnSessionReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rust.get_recent_sessions).mockResolvedValue([]);
  });

  it("renders title and action buttons", async () => {
    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("session.title")).toBeInTheDocument();
    });
    expect(screen.getByText("session.create_new")).toBeInTheDocument();
    expect(screen.getByText("session.open_existing")).toBeInTheDocument();
  });

  it("shows empty state when no recent sessions", async () => {
    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("session.recent_sessions")).toBeInTheDocument();
    });
  });

  it("renders recent sessions when available", async () => {
    vi.mocked(rust.get_recent_sessions).mockResolvedValue([
      {
        path: "/home/user/personal.db",
        name: "Personal Finances",
        last_opened: new Date().toISOString(),
        file_exists: true,
        file_size: 1048576,
      },
      {
        path: "/home/user/business.db",
        name: "Business",
        last_opened: "2026-01-01T00:00:00Z",
        file_exists: true,
        file_size: 512000,
      },
    ]);

    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("Personal Finances")).toBeInTheDocument();
    });
    expect(screen.getByText("Business")).toBeInTheDocument();
  });

  it("shows file not found badge for missing sessions", async () => {
    vi.mocked(rust.get_recent_sessions).mockResolvedValue([
      {
        path: "/home/user/deleted.db",
        name: "Deleted DB",
        last_opened: "2026-01-01T00:00:00Z",
        file_exists: false,
        file_size: 0,
      },
    ]);

    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("session.file_not_found")).toBeInTheDocument();
    });
  });

  it("calls open_session and onSessionReady when clicking a session", async () => {
    const session = {
      path: "/home/user/personal.db",
      name: "Personal",
      last_opened: new Date().toISOString(),
      file_exists: true,
      file_size: 1024,
    };
    vi.mocked(rust.get_recent_sessions).mockResolvedValue([session]);
    vi.mocked(rust.open_session).mockResolvedValue(session);

    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("Personal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Personal"));

    await waitFor(() => {
      expect(rust.open_session).toHaveBeenCalledWith({
        path: "/home/user/personal.db",
      });
      expect(mockOnSessionReady).toHaveBeenCalledWith(session);
    });
  });

  it("removes a session from the list when trash is clicked", async () => {
    vi.mocked(rust.get_recent_sessions).mockResolvedValue([
      {
        path: "/home/user/old.db",
        name: "Old DB",
        last_opened: "2026-01-01T00:00:00Z",
        file_exists: true,
        file_size: 512,
      },
    ]);

    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("Old DB")).toBeInTheDocument();
    });

    // The trash button is inside the session row
    const removeBtn = screen.getByTitle("Remove from list");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(vi.mocked(rust.remove_recent_session)).toHaveBeenCalledWith({
        path: "/home/user/old.db",
      });
    });
  });

  it("displays error when open_session fails", async () => {
    vi.mocked(rust.get_recent_sessions).mockResolvedValue([
      {
        path: "/home/user/broken.db",
        name: "Broken",
        last_opened: new Date().toISOString(),
        file_exists: true,
        file_size: 100,
      },
    ]);
    vi.mocked(rust.open_session).mockRejectedValue("File is corrupted");

    render(<SessionPicker onSessionReady={mockOnSessionReady} />);

    await waitFor(() => {
      expect(screen.getByText("Broken")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Broken"));

    await waitFor(() => {
      expect(screen.getByText("File is corrupted")).toBeInTheDocument();
    });
  });
});
