import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountDetails from "../../../features/accounts/AccountDetails";
import { invoke } from "@tauri-apps/api/core";
import * as formatInteractions from "../../../utils/format";
import * as confirmHook from "../../../stores/confirm";
import * as numberFormatContext from "../../../stores/number-format";
import * as customRateHook from "../../../hooks/useCustomRate";

vi.mock("../../../utils/format", () => ({
  useFormatNumber: vi.fn(),
  useParseNumber: vi.fn(),
  useFormatDate: vi.fn(),
  getDatePickerFormat: vi.fn(() => "yyyy-MM-dd"),
}));

vi.mock("../../../stores/confirm", () => ({
  useConfirm: vi.fn(),
}));

vi.mock("../../../stores/number-format", () => ({
  useNumberFormat: vi.fn(),
}));

vi.mock("../../../hooks/useCustomRate", () => ({
  useCustomRate: vi.fn(),
}));

vi.mock("react-datepicker", () => ({
  default: (props: { onChange: (date: Date) => void; selected?: Date }) => (
    <input
      onChange={(e) => {
        props.onChange(new Date(e.target.value));
      }}
      value={
        props.selected ? props.selected.toISOString().substring(0, 10) : ""
      }
      role="textbox"
      aria-label="Date"
    />
  ),
}));

vi.mock("../../../features/accounts/transaction-fields", () => ({
  TransactionDateField: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      data-testid="date-field"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  ),
  PayeeField: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string, isTransfer?: boolean) => void;
  }) => (
    <input
      data-testid="payee-field"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  ),
  CategoryField: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      data-testid="category-field"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  ),
  NotesField: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      data-testid="notes-field"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  ),
  TransactionAmountFields: ({
    amount,
    onAmountChange,
  }: {
    amount: string | number | undefined;
    onAmountChange: (v: number) => void;
  }) => (
    <input
      data-testid="amount-field"
      value={amount ?? ""}
      onChange={(e) => {
        onAmountChange(Number(e.target.value));
      }}
    />
  ),
  InvestmentFields: () => <div data-testid="investment-fields">Investment</div>,
  BuySellField: () => <div data-testid="edit-buy-sell" />,
  TickerField: () => <input data-testid="edit-ticker" />,
  SharesField: () => <input data-testid="edit-shares" />,
  PricePerShareField: () => <input data-testid="edit-price" />,
  FeeField: () => <input data-testid="edit-fee" />,
  resolveInlineBuySell: () => true,
}));

const account = {
  id: "acc1",
  name: "Test Account",
  kind: "Checking",
  balance: 1000,
  currency: "USD",
};

const cashTransactions = [
  {
    id: "tx1",
    account_id: "acc1",
    date: "2023-01-01",
    payee: "Grocery Store",
    category: "Food",
    amount: -50.0,
    notes: "Weekly groceries",
    cleared: true,
    currency: "USD",
  },
  {
    id: "tx2",
    account_id: "acc1",
    date: "2023-01-02",
    payee: "Salary",
    category: "Income",
    amount: 2000.0,
    notes: "Monthly",
    cleared: true,
    currency: "USD",
  },
];

const investmentTransactions = [
  ...cashTransactions,
  {
    id: "tx3",
    account_id: "acc1",
    date: "2023-01-03",
    payee: "Buy",
    category: "Investment",
    amount: -500.0,
    notes: "Bought shares",
    cleared: true,
    currency: "USD",
    ticker: "AAPL",
    shares: 10,
    price_per_share: 50,
    fee: 1.5,
  },
];

const pendingOccurrence = {
  scheduled_tx_id: 1,
  date: "2024-02-01",
  payee: "Rent",
  category: "Housing",
  amount: -1200,
  notes: "",
  status: "upcoming" as const,
  account_id: "acc1",
  account_name: "Test Account",
};

describe("AccountDetails extended integration", () => {
  const mockFormatNumber = vi.fn((val: unknown) => `fmt(${String(val)})`);
  const mockParseNumber = vi.fn((str: unknown) => Number(str));
  const mockFormatDate = vi.fn((d: string | Date | null | undefined): string =>
    d ? (new Date(d).toISOString().split("T")[0] ?? "") : "",
  );
  const mockConfirm = vi.fn();
  const mockInvoke = vi.mocked(invoke);
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(formatInteractions.useFormatNumber).mockReturnValue(
      mockFormatNumber,
    );
    vi.mocked(formatInteractions.useParseNumber).mockReturnValue(
      mockParseNumber,
    );
    vi.mocked(formatInteractions.useFormatDate).mockReturnValue(mockFormatDate);

    vi.mocked(confirmHook.useConfirm).mockReturnValue(mockConfirm);
    mockConfirm.mockResolvedValue(true);

    vi.mocked(numberFormatContext.useNumberFormat).mockReturnValue({
      dateFormat: "yyyy-MM-dd",
      firstDayOfWeek: 1,
      currency: "USD",
    } as never);

    vi.mocked(customRateHook.useCustomRate).mockReturnValue({
      checkAndPrompt: vi.fn().mockResolvedValue(true),
      dialog: <></>,
      isLoading: false,
    });

    mockInvoke.mockImplementation((cmd: string, _args?: unknown) => {
      if (cmd === "get_transactions") {
        return Promise.resolve(cashTransactions);
      }
      if (cmd === "get_pending_occurrences") {
        return Promise.resolve([pendingOccurrence]);
      }
      if (cmd === "get_payees") return Promise.resolve(["Grocery Store"]);
      if (cmd === "get_categories") return Promise.resolve(["Food", "Income"]);
      if (cmd === "get_accounts") {
        return Promise.resolve([
          { id: "acc2", name: "Savings", kind: "cash", currency: "USD" },
        ]);
      }
      if (cmd === "get_rules") return Promise.resolve([]);
      if (cmd === "create_transaction") return Promise.resolve(undefined);
      if (cmd === "update_transaction") return Promise.resolve(undefined);
      if (cmd === "delete_transaction") return Promise.resolve(undefined);
      return Promise.resolve([]);
    });
  });

  it("edits a transaction and saves changes", async () => {
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await user.click(await screen.findByText("Grocery Store"));

    const editRow = screen.getByTestId("payee-field").closest("tr")!;
    const saveButton = within(editRow).getAllByRole("button")[0]!;
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "update_transaction",
        expect.objectContaining({
          args: expect.objectContaining({
            id: "tx1",
            payee: "Grocery Store",
          }),
        }),
      );
    });

    expect(onUpdate).toHaveBeenCalled();
  });

  it("deletes a transaction after confirmation", async () => {
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    const row = (await screen.findByText("Grocery Store")).closest("tr")!;
    fireEvent.contextMenu(row);

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith("delete_transaction", {
        id: "tx1",
      });
    });

    expect(onUpdate).toHaveBeenCalled();
  });

  it("does not delete a transaction when confirmation is cancelled", async () => {
    mockConfirm.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    const row = (await screen.findByText("Grocery Store")).closest("tr")!;
    fireEvent.contextMenu(row);

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "delete_transaction",
      expect.anything(),
    );
  });

  it("filters transactions by search query", async () => {
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await screen.findByText("Grocery Store");

    const searchInput = screen.getByPlaceholderText("Search transactions...");
    await user.type(searchInput, "Salary");

    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.queryByText("Grocery Store")).not.toBeInTheDocument();
  });

  it("shows empty search message when filter matches nothing", async () => {
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await screen.findByText("Grocery Store");

    await user.type(
      screen.getByPlaceholderText("Search transactions..."),
      "nonexistent-payee",
    );

    expect(screen.getByText("No transactions found")).toBeInTheDocument();
    expect(
      screen.getByText("Try adjusting your search terms."),
    ).toBeInTheDocument();
  });

  it("renders investment columns when transactions include holdings", async () => {
    mockInvoke.mockImplementation((cmd: string, _args?: unknown) => {
      if (cmd === "get_transactions") {
        return Promise.resolve(investmentTransactions);
      }
      if (cmd === "get_pending_occurrences") return Promise.resolve([]);
      if (cmd === "get_payees") return Promise.resolve([]);
      if (cmd === "get_categories") return Promise.resolve([]);
      if (cmd === "get_accounts") return Promise.resolve([]);
      if (cmd === "get_rules") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await screen.findByText("AAPL");

    expect(screen.getByText("Ticker")).toBeInTheDocument();
    expect(screen.getByText("Shares")).toBeInTheDocument();
    expect(screen.getByText("Price per share")).toBeInTheDocument();
    expect(screen.getByText("Fee")).toBeInTheDocument();
  });

  it("renders pending scheduled occurrences above transactions", async () => {
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    expect(
      await screen.findByText("Pending scheduled transactions"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Housing")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_pending_occurrences", {
        accountId: "acc1",
      });
    });
  });
});
