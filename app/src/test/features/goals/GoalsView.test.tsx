import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GoalsView from "../../../features/goals/GoalsView";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (value: unknown) =>
    typeof value === "number" ? String(Math.round(value)) : "",
  useFormatDate: () => (value: unknown) =>
    typeof value === "string" ? value : "",
  useParseNumber: () => (value: string) => Number(value),
}));

vi.mock("../../../stores/number-format", () => ({
  useNumberFormat: () => ({
    locale: "en-US",
    currency: "USD",
    dateFormat: "YYYY-MM-DD",
  }),
}));

const mockConfirm = vi.fn();
vi.mock("../../../stores/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

const mockShowToast = vi.fn();
vi.mock("../../../stores/toast", () => ({
  useToast: () => ({
    showToast: mockShowToast,
    toasts: [],
    removeToast: vi.fn(),
  }),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span>Plus</span>,
  Trash2: () => <span>Delete</span>,
  Edit: () => <span>Edit</span>,
  ChevronDown: () => <span>Down</span>,
  ChevronUp: () => <span>Up</span>,
  Archive: () => <span>Archive</span>,
  ArchiveRestore: () => <span>Restore</span>,
  X: () => <span>X</span>,
  ChevronDownIcon: () => <span>Down</span>,
  Check: () => <span>Check</span>,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockedInvoke = vi.mocked(invoke);

const ACCOUNTS = [
  {
    id: 1,
    name: "Savings",
    balance: 5000,
    currency: "USD",
    exchange_rate: 1,
  },
];

const GOALS = [
  {
    id: 4,
    name: "House",
    target_amount: 10000,
    currency: "USD",
    target_date: "2030-01-01",
    monthly_contribution: null,
    notes: null,
    color: "emerald",
    created_at: "2026-01-01",
    archived: false,
    exchange_rate: 1,
    links: [
      {
        id: 1,
        goal_id: 4,
        source_type: "account",
        account_id: 1,
        ticker: null,
        allocation_percent: 100,
      },
    ],
  },
];

describe("GoalsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve(GOALS);
      if (cmd === "get_accounts") return Promise.resolve(ACCOUNTS);
      if (cmd === "get_all_transactions") return Promise.resolve([]);
      return Promise.resolve([]);
    });
  });

  it("shows an empty state when there are no goals", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve([]);
      if (cmd === "get_accounts") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    render(<GoalsView />);
    await waitFor(() => {
      expect(screen.getByText("No goals yet")).toBeInTheDocument();
    });
  });

  it("renders progress from a linked account", async () => {
    render(<GoalsView />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/10000/)).toBeInTheDocument();
    expect(screen.getAllByText("5000").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Show sources" }));
    expect(screen.getByText("Savings")).toBeInTheDocument();
  });

  it("creates a goal from the editor", async () => {
    const user = userEvent.setup();
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve([]);
      if (cmd === "get_accounts") return Promise.resolve(ACCOUNTS);
      if (cmd === "create_goal") return Promise.resolve(1);
      return Promise.resolve([]);
    });
    render(<GoalsView />);
    await waitFor(() => {
      expect(screen.getByText("No goals yet")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /New goal/ }));
    await user.type(screen.getByLabelText("Name"), "Vacation");
    await user.type(screen.getByLabelText("Target amount"), "2000");
    await user.click(screen.getByRole("button", { name: "Create goal" }));

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("create_goal", {
        args: {
          name: "Vacation",
          targetAmount: 2000,
          currency: null,
          targetDate: null,
          monthlyContribution: null,
          notes: null,
          color: "brand",
          links: [],
        },
      });
    });
  });
});
