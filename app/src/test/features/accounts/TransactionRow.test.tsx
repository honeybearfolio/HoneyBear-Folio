import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionRow from "../../../features/accounts/TransactionRow";

vi.mock("../../../utils/format", () => ({
  useParseNumber: () => (val: unknown) => Number(val),
  useFormatDate: () => (date: string) => `fmt:${date}`,
  useFormatNumber: () => (val: number) => `$${val.toFixed(2)}`,
}));

vi.mock("../../../features/accounts/transaction-fields", () => ({
  TransactionDateField: () => <input data-testid="edit-date" />,
  PayeeField: () => <input data-testid="edit-payee" />,
  CategoryField: () => <input data-testid="edit-category" />,
  NotesField: () => <input data-testid="edit-notes" />,
  TransactionAmountFields: () => <input data-testid="edit-amount" />,
  BuySellField: () => <div data-testid="edit-buy-sell" />,
  TickerField: () => <input data-testid="edit-ticker" />,
  SharesField: () => <input data-testid="edit-shares" />,
  PricePerShareField: () => <input data-testid="edit-price" />,
  FeeField: () => <input data-testid="edit-fee" />,
  resolveInlineBuySell: () => true,
}));

const tx = {
  id: "tx1",
  date: "2024-01-15",
  payee: "Grocery Store",
  category: "Food",
  amount: -42.5,
  notes: "Weekly shop",
  cleared: true,
  currency: "USD",
};

const account = {
  id: "acc1",
  name: "Checking",
  kind: "cash",
  balance: 1000,
  currency: "USD",
};

function renderRow(overrides: Record<string, unknown> = {}) {
  const props = {
    tx,
    account,
    hasInvestment: false,
    editingId: null as string | number | null,
    editForm: {},
    setEditForm: vi.fn(),
    startEditing: vi.fn(),
    saveEdit: vi.fn().mockResolvedValue(undefined),
    setEditingId: vi.fn(),
    menuOpenId: null as string | number | null,
    setMenuOpenId: vi.fn(),
    menuCoords: null as { x?: number; y?: number; top?: number; left?: number; right?: number; bottom?: number; width?: number; height?: number } | null,
    setMenuCoords: vi.fn(),
    duplicateTransaction: vi.fn().mockResolvedValue(undefined),
    deleteTransaction: vi.fn().mockResolvedValue(undefined),
    payeeSuggestions: [],
    categorySuggestions: [],
    availableAccounts: [],
    tickerSuggestions: [],
    handleTickerChange: vi.fn(),
    setTickerSuggestions: vi.fn(),
    appCurrency: "USD",
    dateFormat: "YYYY-MM-DD",
    firstDayOfWeek: 1,
    getTagClasses: () => "tag-food",
    ...overrides,
  };

  return {
    props,
    ...render(
      <table>
        <tbody>
          <TransactionRow {...props} />
        </tbody>
      </table>,
    ),
  };
}

describe("TransactionRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders transaction data in display mode", () => {
    renderRow();

    expect(screen.getByText("fmt:2024-01-15")).toBeInTheDocument();
    expect(screen.getByText("Grocery Store")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Weekly shop")).toBeInTheDocument();
  });

  it("starts editing when a cell is clicked", () => {
    const { props } = renderRow();

    fireEvent.click(screen.getByText("Grocery Store"));

    expect(props.startEditing).toHaveBeenCalledWith(tx);
  });

  it("shows context menu on right-click with duplicate and delete", () => {
    renderRow({
      menuOpenId: "tx1",
      menuCoords: { x: 100, y: 200 },
    });

    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls duplicateTransaction from context menu", async () => {
    const user = userEvent.setup();
    const { props } = renderRow({
      menuOpenId: "tx1",
      menuCoords: { x: 100, y: 200 },
    });

    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    expect(props.duplicateTransaction).toHaveBeenCalledWith(tx);
    expect(props.setMenuOpenId).toHaveBeenCalledWith(null);
  });

  it("calls deleteTransaction from context menu", async () => {
    const user = userEvent.setup();
    const { props } = renderRow({
      menuOpenId: "tx1",
      menuCoords: { x: 100, y: 200 },
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(props.deleteTransaction).toHaveBeenCalledWith("tx1");
  });

  it("renders inline edit fields when editing", () => {
    renderRow({
      editingId: "tx1",
      editForm: { date: "2024-01-15", payee: "Grocery Store", category: "Food", amount: -42.5 },
    });

    expect(screen.getByTestId("edit-payee")).toBeInTheDocument();
    expect(screen.getByTestId("edit-category")).toBeInTheDocument();
    expect(screen.getByTestId("edit-amount")).toBeInTheDocument();
  });

  it("cancels editing via cancel button", async () => {
    const user = userEvent.setup();
    const { props } = renderRow({
      editingId: "tx1",
      editForm: { payee: "Grocery Store" },
    });

    const buttons = screen.getAllByRole("button");
    const cancelBtn = buttons[buttons.length - 1];
    await user.click(cancelBtn);

    expect(props.setEditingId).toHaveBeenCalledWith(null);
  });
});
