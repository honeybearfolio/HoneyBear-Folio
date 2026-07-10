import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionRow from "../../../features/accounts/TransactionRow";

const mockAutocomplete = vi.fn(
  ({
    value,
    onChange,
    placeholder,
    disabled,
    className,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <input
      data-testid="autocomplete"
      aria-label={placeholder}
      className={className}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  ),
);

vi.mock("../../../features/accounts/AutocompleteInput", () => ({
  default: (props: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }) => mockAutocomplete(props),
}));

vi.mock("../../../components/ui/NumberInput", () => ({
  default: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value: string | number | null | undefined;
    onChange: (v: number) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="number-input"
      className={className}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        onChange(Number(e.target.value));
      }}
    />
  ),
}));

vi.mock("react-datepicker", () => ({
  default: ({
    selected,
    onChange,
    className,
    required,
  }: {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    className?: string;
    required?: boolean;
  }) => (
    <input
      data-testid="datepicker"
      className={className}
      required={required}
      value={selected ? selected.toISOString().split("T")[0] : ""}
      onChange={(e) => {
        onChange(e.target.value ? new Date(e.target.value) : null);
      }}
    />
  ),
}));

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
      data-testid="currency-select"
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

vi.mock("../../../utils/format", () => ({
  useParseNumber: () => (val: unknown) => Number(val),
  useFormatDate: () => (date: string) => `fmt:${date}`,
  useFormatNumber: () => (val: number) => `$${val.toFixed(2)}`,
  getDatePickerFormat: (key: string) => key,
}));

const cashTx = {
  id: "tx1",
  date: "2024-01-15",
  payee: "Grocery Store",
  category: "Food",
  amount: -42.5,
  notes: "Weekly shop",
  cleared: true,
  currency: "USD",
};

const investmentTx = {
  id: "tx2",
  date: "2024-02-01",
  payee: "Buy",
  category: "Investment",
  amount: -500,
  notes: "Bought shares",
  cleared: true,
  currency: "USD",
  ticker: "AAPL",
  shares: 10,
  price_per_share: 50,
  fee: 1.5,
};

const account = {
  id: "acc1",
  name: "Brokerage",
  kind: "brokerage",
  balance: 1000,
  currency: "USD",
};

function renderRow(overrides: Record<string, unknown> = {}) {
  const saveEdit = vi.fn().mockResolvedValue(undefined);
  const setEditForm = vi.fn();
  const props = {
    tx: cashTx,
    account,
    hasInvestment: false,
    editingId: null as string | number | null,
    editForm: {},
    setEditForm,
    startEditing: vi.fn(),
    saveEdit,
    setEditingId: vi.fn(),
    menuOpenId: null as string | number | null,
    setMenuOpenId: vi.fn(),
    menuCoords: null,
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
    dateFormat: "yyyy-MM-dd",
    firstDayOfWeek: 1,
    getTagClasses: () => "tag-food",
    ...overrides,
  };

  return {
    props,
  saveEdit,
    ...render(
      <table>
        <tbody>
          <TransactionRow {...props} />
        </tbody>
      </table>,
    ),
  };
}

describe("TransactionRow coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders investment columns in display mode", () => {
    renderRow({ tx: investmentTx, hasInvestment: true });

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("$1.50")).toBeInTheDocument();
  });

  it("opens action menu when the menu button is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderRow();

    const menuButtons = screen.getAllByRole("button");
    await user.click(menuButtons[menuButtons.length - 1]!);

    expect(props.setMenuOpenId).toHaveBeenCalledWith("tx1");
    expect(props.setMenuCoords).toHaveBeenCalled();
  });

  it("saves cash transaction edits using real transaction-fields", async () => {
    const user = userEvent.setup();
    const { saveEdit } = renderRow({
      editingId: "tx1",
      editForm: {
        date: "2024-01-15",
        payee: "Updated Store",
        category: "Food",
        amount: -55,
        notes: "Updated",
        currency: "USD",
      },
    });

    const payeeInput = screen.getByDisplayValue("Updated Store");
    fireEvent.change(payeeInput, { target: { value: "New Payee" } });

    const saveButtons = screen.getAllByRole("button");
    await user.click(saveButtons[0]!);

    expect(saveEdit).toHaveBeenCalled();
  });

  it("saves investment transaction edits with ticker fields", async () => {
    const user = userEvent.setup();
    const { saveEdit } = renderRow({
      tx: investmentTx,
      hasInvestment: true,
      editingId: "tx2",
      editForm: {
        date: "2024-02-01",
        payee: "Buy",
        category: "Investment",
        ticker: "AAPL",
        shares: 10,
        price_per_share: 50,
        fee: 1.5,
        currency: "USD",
      },
    });

    expect(screen.getByDisplayValue("AAPL")).toBeInTheDocument();

    const saveButtons = screen.getAllByRole("button");
    await user.click(saveButtons[0]!);

    expect(saveEdit).toHaveBeenCalled();
  });

  it("shows account column in all-accounts display mode", () => {
    renderRow({
      tx: { ...cashTx, account_id: "acc2", account_name: "Savings" },
      account: { ...account, id: "all", name: "All" },
    });

    expect(screen.getByText("Savings")).toBeInTheDocument();
  });

  it("opens duplicate menu from portal when menu is open", async () => {
    const user = userEvent.setup();
    const { props } = renderRow({
      menuOpenId: "tx1",
      menuCoords: { top: 100, left: 100, width: 20, height: 20, right: 120, bottom: 120 },
    });

    await user.click(await screen.findByRole("button", { name: "Duplicate" }));
    expect(props.duplicateTransaction).toHaveBeenCalledWith(cashTx);
  });

  it("enters edit mode when the date cell is clicked", () => {
    const { props } = renderRow();

    fireEvent.click(screen.getByText("fmt:2024-01-15"));

    expect(props.startEditing).toHaveBeenCalledWith(cashTx);
  });
});
