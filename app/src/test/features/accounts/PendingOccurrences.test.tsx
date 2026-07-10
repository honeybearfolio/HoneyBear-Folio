import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PendingOccurrences from "../../../features/accounts/PendingOccurrences";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => (val: number) => `$${val.toFixed(2)}`,
  useFormatDate: () => (date: string) => `fmt:${date}`,
}));

const occurrence = {
  scheduled_tx_id: 1,
  date: "2024-02-01",
  payee: "Rent",
  category: "Housing",
  amount: -1200,
  notes: "",
  status: "upcoming" as const,
  account_id: "acc1",
  account_name: "Checking",
};

const account = {
  id: "acc1",
  name: "Checking",
  kind: "cash",
  balance: 1000,
  currency: "USD",
};

function renderPending(overrides: Record<string, unknown> = {}) {
  const handleApplyOccurrence = vi.fn().mockResolvedValue(undefined);
  const handleSkipOccurrence = vi.fn().mockResolvedValue(undefined);
  const setMenuOpenId = vi.fn();
  const setMenuCoords = vi.fn();

  const props = {
    pendingOccurrences: [occurrence],
    account,
    hasInvestment: false,
    menuOpenId: null as string | null,
    setMenuOpenId,
    menuCoords: null as {
      top: number;
      left: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    } | null,
    setMenuCoords,
    handleApplyOccurrence,
    handleSkipOccurrence,
    filteredTransactions: [
      {
        id: "tx1",
        date: "2024-01-01",
        payee: "Store",
        amount: -10,
        account_id: "acc1",
      },
    ],
    ...overrides,
  };

  return {
    props,
    handleApplyOccurrence,
    handleSkipOccurrence,
    setMenuOpenId,
    ...render(
      <table>
        <tbody>
          <PendingOccurrences {...props} />
        </tbody>
      </table>,
    ),
  };
}

describe("PendingOccurrences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when there are no pending occurrences", () => {
    const { container } = renderPending({ pendingOccurrences: [] });

    expect(container.querySelector("tr")).toBeNull();
  });

  it("renders pending transactions header and occurrence row", () => {
    renderPending();

    expect(
      screen.getByText("Pending scheduled transactions"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Housing")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("$-1200.00")).toBeInTheDocument();
  });

  it("shows missed status badge", () => {
    renderPending({
      pendingOccurrences: [{ ...occurrence, status: "missed" }],
    });

    expect(screen.getByText("Missed")).toBeInTheDocument();
  });

  it("opens action menu and applies occurrence today", async () => {
    const user = userEvent.setup();
    const occId = "sched-1-2024-02-01-0";
    const { handleApplyOccurrence } = renderPending({
      menuOpenId: occId,
      menuCoords: {
        top: 100,
        left: 100,
        right: 120,
        bottom: 120,
        width: 20,
        height: 20,
      },
    });

    await user.click(screen.getByRole("button", { name: "Apply today" }));

    expect(handleApplyOccurrence).toHaveBeenCalledWith(occurrence, true);
  });

  it("skips occurrence from action menu", async () => {
    const user = userEvent.setup();
    const occId = "sched-1-2024-02-01-0";
    const { handleSkipOccurrence } = renderPending({
      menuOpenId: occId,
      menuCoords: {
        top: 100,
        left: 100,
        right: 120,
        bottom: 120,
        width: 20,
        height: 20,
      },
    });

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(handleSkipOccurrence).toHaveBeenCalledWith(occurrence);
  });
});
