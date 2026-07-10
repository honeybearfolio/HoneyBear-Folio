import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionForm from "../../../features/accounts/TransactionForm";

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string | number;
    onChange: (v: string | number) => void;
    options: { value: string | number; label: string }[];
    placeholder?: string;
  }) => (
    <select
      data-testid="account-select"
      aria-label={placeholder}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
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
}));

function createDefaultProps() {
  return {
    account: {
      id: "acc1",
      name: "Checking",
      kind: "cash",
      balance: 1000,
      currency: "USD",
    },
    availableAccounts: [
      {
        id: "acc1",
        name: "Checking",
        kind: "cash",
        balance: 1000,
        currency: "USD",
      },
      {
        id: "acc2",
        name: "Savings",
        kind: "cash",
        balance: 5000,
        currency: "USD",
      },
    ],
    addTargetAccount: null as {
      id: string;
      name: string;
      kind: string;
      balance: number;
      currency: string;
    } | null,
    setAddTargetAccount: vi.fn(),
    transactionType: "cash",
    setTransactionType: vi.fn(),
    date: "2024-01-15",
    setDate: vi.fn(),
    payee: "",
    setPayee: vi.fn(),
    category: "",
    setCategory: vi.fn(),
    notes: "",
    setNotes: vi.fn(),
    amount: "",
    setAmount: vi.fn(),
    ticker: "",
    setTicker: vi.fn(),
    shares: "",
    setShares: vi.fn(),
    pricePerShare: "",
    setPricePerShare: vi.fn(),
    fee: "",
    setFee: vi.fn(),
    isBuy: true,
    setIsBuy: vi.fn(),
    selectedCurrency: "USD",
    setSelectedCurrency: vi.fn(),
    tickerSuggestions: [],
    showTickerSuggestions: false,
    setShowTickerSuggestions: vi.fn(),
    handleTickerChange: vi.fn(),
    handleSharesChange: vi.fn(),
    handlePricePerShareChange: vi.fn(),
    payeeSuggestions: [],
    categorySuggestions: [],
    handleAddTransaction: vi.fn().mockResolvedValue(undefined),
    dateFormat: "YYYY-MM-DD",
    firstDayOfWeek: 1,
    appCurrency: "USD",
    checkAndPrompt: vi.fn().mockResolvedValue(true),
  };
}

describe("TransactionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders new transaction heading and cash fields", () => {
    render(<TransactionForm {...createDefaultProps()} />);

    expect(screen.getByText("New Transaction")).toBeInTheDocument();
    expect(screen.getByTestId("payee-field")).toBeInTheDocument();
    expect(screen.getByTestId("category-field")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save transaction/i }),
    ).toBeInTheDocument();
  });

  it("switches to investment fields when investment type is selected", async () => {
    const user = userEvent.setup();
    const props = createDefaultProps();
    render(<TransactionForm {...props} />);

    await user.click(screen.getByRole("button", { name: /investment/i }));

    expect(props.setTransactionType).toHaveBeenCalledWith("investment");
  });

  it("shows investment fields when transaction type is investment", () => {
    render(
      <TransactionForm
        {...createDefaultProps()}
        transactionType="investment"
      />,
    );

    expect(screen.getByTestId("investment-fields")).toBeInTheDocument();
    expect(screen.queryByTestId("payee-field")).not.toBeInTheDocument();
  });

  it("shows account selector when viewing all accounts", async () => {
    const user = userEvent.setup();
    const props = createDefaultProps();
    props.account = {
      id: "all",
      name: "All",
      kind: "cash",
      balance: 0,
      currency: "USD",
    };

    render(<TransactionForm {...props} />);

    const select = screen.getByTestId("account-select");
    await user.selectOptions(select, "acc2");

    expect(props.setAddTargetAccount).toHaveBeenCalledWith(
      expect.objectContaining({ id: "acc2", name: "Savings" }),
    );
  });

  it("submits the form via handleAddTransaction", () => {
    const props = createDefaultProps();
    render(<TransactionForm {...props} />);

    fireEvent.submit(
      screen
        .getByRole("button", { name: /save transaction/i })
        .closest("form")!,
    );

    expect(props.handleAddTransaction).toHaveBeenCalled();
  });
});
