import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScheduledTable from "../../../features/scheduled/ScheduledTable";
import type {
  ScheduleRecord,
  AccountRecord,
} from "../../../features/scheduled/scheduled-types";
import { useNumberFormatStore } from "../../../stores/number-format";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number, opts?: { style?: string }) =>
    opts?.style === "currency" ? `$${val.toFixed(2)}` : String(val),
}));

const accounts: AccountRecord[] = [
  { id: 1, name: "Checking" },
  { id: 2, name: "Brokerage" },
];

const schedules: ScheduleRecord[] = [
  {
    id: 1,
    account_id: 1,
    payee: "Netflix",
    amount: -15.99,
    category: "Entertainment",
    recurrence_type: "every_n",
    interval_value: 1,
    interval_unit: "month",
    start_date: "2023-01-01",
    enabled: true,
    occurrences_count: 5,
    days_of_week: [],
    ordinal: 1,
    weekday: 1,
  },
  {
    id: 2,
    account_id: 2,
    transaction_type: "investment",
    payee: "AAPL buy",
    ticker: "AAPL",
    amount: -500,
    recurrence_type: "every_n",
    interval_value: 2,
    interval_unit: "week",
    start_date: "2023-06-01",
    enabled: false,
    occurrences_count: 2,
    days_of_week: [],
    ordinal: 1,
    weekday: 1,
  },
];

function renderTable(overrides: Record<string, unknown> = {}) {
  const props = {
    schedules,
    accounts,
    menuOpenId: null as number | null,
    menuCoords: null as { x: number; y: number } | null,
    setMenuOpenId: vi.fn(),
    setMenuCoords: vi.fn(),
    handleEdit: vi.fn(),
    handleDelete: vi.fn().mockResolvedValue(undefined),
    handleToggleEnabled: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return { props, ...render(<ScheduledTable {...props} />) };
}

describe("ScheduledTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNumberFormatStore.setState({ locale: "en-US", currency: "USD" });
  });

  it("renders empty state when no schedules", () => {
    renderTable({ schedules: [] });

    expect(
      screen.getByText("No scheduled transactions defined"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create a recurring transaction to get started"),
    ).toBeInTheDocument();
  });

  it("renders schedule rows with account, payee, amount, and category", () => {
    renderTable();

    expect(screen.getByText("Checking")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("$-15.99")).toBeInTheDocument();
    expect(screen.getByText("Entertainment")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders investment ticker badge", () => {
    renderTable();

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("AAPL buy")).toBeInTheDocument();
  });

  it("calls handleToggleEnabled from row action button", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();

    const toggleButtons = screen.getAllByRole("button", { name: "Enabled" });
    await user.click(toggleButtons[0]!);

    expect(props.handleToggleEnabled).toHaveBeenCalledWith(schedules[0]);
  });

  it("calls handleEdit from row action button", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();

    const editButtons = screen.getAllByRole("button", { name: "Update" });
    await user.click(editButtons[0]!);

    expect(props.handleEdit).toHaveBeenCalledWith(schedules[0]);
  });

  it("calls handleDelete from row action button", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]!);

    expect(props.handleDelete).toHaveBeenCalledWith(1);
  });

  it("opens context menu portal on right-click", () => {
    renderTable({
      menuOpenId: 1,
      menuCoords: { x: 120, y: 200 },
    });

    const portal = document.querySelector(".sched-action-menu-portal");
    expect(portal).toBeInTheDocument();
    expect(portal).toHaveTextContent("Update");
    expect(portal).toHaveTextContent("Delete");
  });

  it("calls handleEdit from context menu and closes menu", async () => {
    const user = userEvent.setup();
    const setMenuOpenId = vi.fn();
    const setMenuCoords = vi.fn();
    const handleEdit = vi.fn();

    renderTable({
      menuOpenId: 1,
      menuCoords: { x: 120, y: 200 },
      setMenuOpenId,
      setMenuCoords,
      handleEdit,
    });

    const portalButtons = document.querySelectorAll(
      ".sched-action-menu-portal button",
    );
    const editBtn = Array.from(portalButtons).find((btn) =>
      btn.textContent.includes("Update"),
    );
    expect(editBtn).toBeDefined();
    await user.click(editBtn!);

    expect(handleEdit).toHaveBeenCalledWith(schedules[0]);
    expect(setMenuOpenId).toHaveBeenCalledWith(null);
    expect(setMenuCoords).toHaveBeenCalledWith(null);
  });

  it("calls handleToggleEnabled from context menu and closes menu", async () => {
    const user = userEvent.setup();
    const setMenuOpenId = vi.fn();
    const setMenuCoords = vi.fn();
    const handleToggleEnabled = vi.fn().mockResolvedValue(undefined);

    renderTable({
      menuOpenId: 1,
      menuCoords: { x: 120, y: 200 },
      setMenuOpenId,
      setMenuCoords,
      handleToggleEnabled,
    });

    const portalButtons = document.querySelectorAll(
      ".sched-action-menu-portal button",
    );
    const toggleBtn = Array.from(portalButtons).find((btn) =>
      btn.textContent.includes("Enabled"),
    );
    expect(toggleBtn).toBeDefined();
    await user.click(toggleBtn!);

    expect(handleToggleEnabled).toHaveBeenCalledWith(schedules[0]);
    expect(setMenuOpenId).toHaveBeenCalledWith(null);
    expect(setMenuCoords).toHaveBeenCalledWith(null);
  });

  it("sets menu state on row context menu", () => {
    const setMenuOpenId = vi.fn();
    const setMenuCoords = vi.fn();

    renderTable({ setMenuOpenId, setMenuCoords });

    const rows = document.querySelectorAll("tbody tr");
    fireEvent.contextMenu(rows[0]!);

    expect(setMenuCoords).toHaveBeenCalled();
    expect(setMenuOpenId).toHaveBeenCalledWith(1);
  });
});
