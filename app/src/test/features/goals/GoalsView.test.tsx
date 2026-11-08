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

  it("shows a load error and retries", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.reject(new Error("nope"));
      return Promise.resolve([]);
    });
    render(<GoalsView />);
    await waitFor(() => {
      expect(
        screen.getByText("Operation failed. Please try again."),
      ).toBeInTheDocument();
    });

    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.getByText("No goals yet")).toBeInTheDocument();
    });
  });

  it("still shows goals when quotes fail", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve(GOALS);
      if (cmd === "get_accounts") return Promise.resolve(ACCOUNTS);
      if (cmd === "get_all_transactions")
        return Promise.reject(new Error("quotes"));
      return Promise.resolve([]);
    });
    render(<GoalsView />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });
  });

  it("archives, restores, and labels holding sources", async () => {
    const house = GOALS[0];
    expect(house).toBeDefined();
    if (!house) return;
    const archived = {
      ...house,
      id: 8,
      name: "Cabin",
      archived: true,
      color: "nope",
      links: [
        {
          id: 2,
          goal_id: 8,
          source_type: "holding",
          account_id: null,
          ticker: "AAPL",
          allocation_percent: 40,
        },
        {
          id: 3,
          goal_id: 8,
          source_type: "holding",
          account_id: 99,
          ticker: "VTI",
          allocation_percent: 100,
        },
      ],
    };
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve([...GOALS, archived]);
      if (cmd === "get_accounts") return Promise.resolve(ACCOUNTS);
      if (cmd === "update_goal") return Promise.resolve(null);
      return Promise.resolve([]);
    });
    render(<GoalsView />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });
    expect(screen.queryByText("Cabin")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show archived" }));
    expect(screen.getByText("Cabin")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    const sourceButtons = screen.getAllByRole("button", {
      name: "Show sources",
    });
    const cabinSources = sourceButtons[1];
    expect(cabinSources).toBeDefined();
    if (!cabinSources) return;
    fireEvent.click(cabinSources);
    expect(screen.getByText(/AAPL · All accounts/)).toBeInTheDocument();
    expect(screen.getByText(/VTI/)).toBeInTheDocument();
    expect(screen.getByText(/40%/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Goal archived", {
        type: "success",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Goal restored", {
        type: "success",
      });
    });
  });

  it("deletes a goal only after confirmation", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve(GOALS);
      if (cmd === "get_accounts") return Promise.resolve(ACCOUNTS);
      if (cmd === "delete_goal") return Promise.resolve(null);
      return Promise.resolve([]);
    });
    mockConfirm.mockResolvedValue(false);
    render(<GoalsView />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    expect(
      mockedInvoke.mock.calls.some((call) => call[0] === "delete_goal"),
    ).toBe(false);

    mockConfirm.mockResolvedValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("delete_goal", { id: 4 });
    });
    expect(mockShowToast).toHaveBeenCalledWith("Goal deleted", {
      type: "success",
    });
  });

  it("toasts when archive or delete fails", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve(GOALS);
      if (cmd === "get_accounts") return Promise.resolve(ACCOUNTS);
      return Promise.reject(new Error("disk"));
    });
    mockConfirm.mockResolvedValue(true);
    render(<GoalsView />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        "Failed to save. Please try again.",
        { type: "error" },
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        "Failed to save. Please try again.",
        { type: "error" },
      );
    });
  });

  it("saves an edit and hides sources again", async () => {
    const user = userEvent.setup();
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_goals") return Promise.resolve(GOALS);
      if (cmd === "get_accounts") return Promise.resolve(ACCOUNTS);
      if (cmd === "update_goal") return Promise.resolve(null);
      return Promise.resolve([]);
    });
    render(<GoalsView />);
    await waitFor(() => {
      expect(screen.getByText("House")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Show sources" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide sources" }));
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit goal" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Cabin");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("update_goal", {
        args: {
          id: 4,
          archived: false,
          name: "Cabin",
          targetAmount: 10000,
          currency: "USD",
          targetDate: "2030-01-01",
          monthlyContribution: null,
          notes: null,
          color: "emerald",
          links: [
            {
              sourceType: "account",
              accountId: 1,
              ticker: null,
              allocationPercent: 100,
            },
          ],
        },
      });
    });
  });
});
