import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
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

const mockShowToast = vi.fn();
vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
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
        onChange(e.target.value, e.target.value === "Savings");
      }}
    />
  ),
  CategoryField: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid="category-field"
      value={value}
      disabled={disabled}
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
  InvestmentFields: ({
    onTickerChange,
    onSharesChange,
    onPricePerShareChange,
  }: {
    onTickerChange: (v: string) => void;
    onSharesChange: (v: number) => void;
    onPricePerShareChange: (v: number) => void;
  }) => (
    <div data-testid="investment-fields">
      <input
        data-testid="inv-ticker"
        onChange={(e) => {
          onTickerChange(e.target.value);
        }}
      />
      <input
        data-testid="inv-shares"
        onChange={(e) => {
          onSharesChange(Number(e.target.value));
        }}
      />
      <input
        data-testid="inv-price"
        onChange={(e) => {
          onPricePerShareChange(Number(e.target.value));
        }}
      />
    </div>
  ),
  BuySellField: () => <div data-testid="edit-buy-sell" />,
  TickerField: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      data-testid="edit-ticker"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  ),
  SharesField: ({
    value,
    onChange,
  }: {
    value: string | number | undefined;
    onChange: (v: number) => void;
  }) => (
    <input
      data-testid="edit-shares"
      value={value ?? ""}
      onChange={(e) => {
        onChange(Number(e.target.value));
      }}
    />
  ),
  PricePerShareField: ({
    value,
    onChange,
  }: {
    value: string | number | undefined;
    onChange: (v: number) => void;
  }) => (
    <input
      data-testid="edit-price"
      value={value ?? ""}
      onChange={(e) => {
        onChange(Number(e.target.value));
      }}
    />
  ),
  FeeField: () => <input data-testid="edit-fee" />,
  resolveInlineBuySell: () => true,
}));

const account = {
  id: "acc1",
  name: "Test Account",
  kind: "brokerage",
  balance: 1000,
  currency: "USD",
};

const allAccount = {
  id: "all",
  name: "All Transactions",
  kind: "all",
  balance: 0,
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
];

const investmentTx = {
  id: "tx-inv",
  account_id: "acc1",
  date: "2023-02-01",
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
};

describe("AccountDetails coverage", () => {
  const mockFormatNumber = vi.fn((val: unknown) => `fmt(${String(val)})`);
  const mockParseNumber = vi.fn((str: unknown) => Number(str));
  const mockFormatDate = vi.fn((d: string | Date | null | undefined): string =>
    d ? (new Date(d).toISOString().split("T")[0] ?? "") : "",
  );
  const mockConfirm = vi.fn();
  const mockInvoke = vi.mocked(invoke);
  const onUpdate = vi.fn();

  function setupInvoke(
    overrides: Partial<Record<string, () => Promise<unknown>>> = {},
  ) {
    mockInvoke.mockImplementation((cmd: string, _args?: unknown) => {
      if (overrides[cmd]) return overrides[cmd]();
      if (cmd === "get_transactions") return Promise.resolve(cashTransactions);
      if (cmd === "get_all_transactions") {
        return Promise.resolve([
          {
            ...cashTransactions[0],
            account_id: "acc1",
          },
        ]);
      }
      if (cmd === "get_pending_occurrences") return Promise.resolve([]);
      if (cmd === "get_payees") return Promise.resolve(["Grocery Store"]);
      if (cmd === "get_categories") return Promise.resolve(["Food", "Income"]);
      if (cmd === "get_accounts") {
        return Promise.resolve([
          {
            id: "acc1",
            name: "Test Account",
            kind: "brokerage",
            currency: "USD",
          },
          { id: "acc2", name: "Savings", kind: "cash", currency: "USD" },
        ]);
      }
      if (cmd === "get_rules") return Promise.resolve([]);
      if (cmd === "create_transaction") return Promise.resolve(undefined);
      if (cmd === "create_investment_transaction")
        return Promise.resolve(undefined);
      if (cmd === "update_transaction") return Promise.resolve(undefined);
      if (cmd === "update_investment_transaction")
        return Promise.resolve(undefined);
      return Promise.resolve([]);
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockShowToast.mockClear();

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

    setupInvoke();
  });

  it("duplicates a transaction from the context menu", async () => {
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    const row = (await screen.findByText("Grocery Store")).closest("tr")!;
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole("button", { name: "Duplicate" }));

    await waitFor(() => {
      const createCall = mockInvoke.mock.calls.find(
        ([cmd]) => cmd === "create_transaction",
      );
      expect(createCall?.[1]).toMatchObject({
        args: {
          payee: "Grocery Store",
          amount: -50,
        },
      });
    });
    expect(onUpdate).toHaveBeenCalled();
  });

  it("adds an investment transaction", async () => {
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await screen.findByText("Grocery Store");
    await user.click(screen.getByRole("button", { name: /add transaction/i }));
    await user.click(screen.getByRole("button", { name: /investment/i }));

    fireEvent.change(screen.getByTestId("inv-ticker"), {
      target: { value: "MSFT" },
    });
    fireEvent.change(screen.getByTestId("inv-shares"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByTestId("inv-price"), {
      target: { value: "300" },
    });

    fireEvent.submit(
      screen
        .getByRole("button", { name: /save transaction/i })
        .closest("form")!,
    );

    await waitFor(() => {
      const createCall = mockInvoke.mock.calls.find(
        ([cmd]) => cmd === "create_investment_transaction",
      );
      expect(createCall?.[1]).toMatchObject({
        args: {
          ticker: "MSFT",
          shares: 5,
          pricePerShare: 300,
        },
      });
    });
  });

  it("saves investment transaction edits via update_investment_transaction", async () => {
    setupInvoke({
      get_transactions: () => Promise.resolve([investmentTx]),
    });

    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await user.click(await screen.findByText("AAPL"));

    const editRow = screen.getByTestId("edit-ticker").closest("tr")!;
    const saveButton = within(editRow).getAllByRole("button")[0]!;
    await user.click(saveButton);

    await waitFor(() => {
      const updateCall = mockInvoke.mock.calls.find(
        ([cmd]) => cmd === "update_investment_transaction",
      );
      expect(updateCall?.[1]).toMatchObject({
        args: {
          id: "tx-inv",
          ticker: "AAPL",
        },
      });
    });
  });

  it("sets transfer category when payee matches another account", async () => {
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await screen.findByText("Grocery Store");
    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    fireEvent.change(screen.getByTestId("payee-field"), {
      target: { value: "Savings" },
    });

    expect(screen.getByTestId("category-field")).toHaveValue("Transfer");
  });

  it("applies rules when payee changes in the add form", async () => {
    setupInvoke({
      get_rules: () =>
        Promise.resolve([
          {
            id: 1,
            name: "Coffee rule",
            priority: 10,
            conditions: [
              { field: "payee", operator: "contains", value: "Coffee" },
            ],
            actions: [{ field: "category", value: "Food & Drink" }],
          },
        ]),
    });

    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await screen.findByText("Grocery Store");
    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    fireEvent.change(screen.getByTestId("payee-field"), {
      target: { value: "Coffee Shop" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("category-field")).toHaveValue("Food & Drink");
    });
  });

  it("renders all-accounts view with account column and fetches all transactions", async () => {
    setupInvoke({
      get_all_transactions: () =>
        Promise.resolve([
          {
            id: "tx-all",
            account_id: "acc1",
            date: "2023-03-01",
            payee: "Shared Payee",
            category: "Misc",
            amount: -10,
            notes: "",
            cleared: true,
            currency: "USD",
          },
        ]),
    });

    render(<AccountDetails account={allAccount} onUpdate={onUpdate} />);

    expect(await screen.findByText("Shared Payee")).toBeInTheDocument();
    expect(screen.getByText("Test Account")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_all_transactions");
      expect(mockInvoke).toHaveBeenCalledWith("get_pending_occurrences", {
        accountId: null,
      });
    });
  });

  it("sorts transactions when a column header is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await screen.findByText("Grocery Store");

    await user.click(screen.getByText("Payee"));

    expect(screen.getByText("Grocery Store")).toBeInTheDocument();
  });

  it("applies legacy single-action rules format", async () => {
    setupInvoke({
      get_rules: () =>
        Promise.resolve([
          {
            id: 2,
            name: "Legacy rule",
            priority: 5,
            match_field: "payee",
            match_pattern: "Amazon",
            action_field: "category",
            action_value: "Shopping",
          },
        ]),
    });

    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await screen.findByText("Grocery Store");
    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    fireEvent.change(screen.getByTestId("payee-field"), {
      target: { value: "Amazon" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("category-field")).toHaveValue("Shopping");
    });
  });

  it("shows toast when transaction fetch fails", async () => {
    setupInvoke({
      get_transactions: () => Promise.reject(new Error("DB locked")),
    });

    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringMatching(/failed/i),
        expect.objectContaining({ type: "error" }),
      );
    });
  });

  it("duplicates an investment transaction from the context menu", async () => {
    setupInvoke({
      get_transactions: () => Promise.resolve([investmentTx]),
    });

    const user = userEvent.setup();
    render(<AccountDetails account={account} onUpdate={onUpdate} />);

    const row = (await screen.findByText("AAPL")).closest("tr")!;
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole("button", { name: "Duplicate" }));

    await waitFor(() => {
      const createCall = mockInvoke.mock.calls.find(
        ([cmd]) => cmd === "create_transaction",
      );
      expect(createCall?.[1]).toMatchObject({
        args: {
          ticker: "AAPL",
          shares: 10,
        },
      });
    });
  });
});
