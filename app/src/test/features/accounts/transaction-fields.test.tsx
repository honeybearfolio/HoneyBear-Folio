import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PayeeField from "../../../features/accounts/transaction-fields/PayeeField";
import CategoryField from "../../../features/accounts/transaction-fields/CategoryField";
import NotesField from "../../../features/accounts/transaction-fields/NotesField";
import TransactionDateField from "../../../features/accounts/transaction-fields/TransactionDateField";
import AmountField, {
  TransactionAmountFields,
} from "../../../features/accounts/transaction-fields/TransactionAmountFields";
import BuySellField from "../../../features/accounts/transaction-fields/BuySellField";
import TickerField from "../../../features/accounts/transaction-fields/TickerField";
import CurrencyField from "../../../features/accounts/transaction-fields/CurrencyField";
import InvestmentFields, {
  SharesField,
  PricePerShareField,
  FeeField,
} from "../../../features/accounts/transaction-fields/InvestmentFields";

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
  useFormatNumber: () => (val: number) => `fmt-${String(val)}`,
  getDatePickerFormat: (key: string) => key,
}));

const accounts = [
  { id: "1", name: "Savings", kind: "cash", balance: 0, currency: "USD" },
];
const suggestions = [
  { value: "Grocery", type: "payee" as const },
  { value: "Food", type: "category" as const },
];
const tickerSuggestions = [
  {
    symbol: "AAPL",
    shortname: "Apple Inc.",
    longname: "Apple Inc.",
    exchange: "NMS",
    typeDisp: "Equity",
    currency: "USD",
  },
];

describe("transaction-fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PayeeField", () => {
    it("renders form variant with label and forwards changes", () => {
      const onChange = vi.fn();
      render(
        <PayeeField
          value=""
          onChange={onChange}
          suggestions={suggestions}
          availableAccounts={accounts}
        />,
      );

      expect(screen.getByText("Payee")).toBeInTheDocument();
      const input = screen.getByLabelText("Who got paid?");
      fireEvent.change(input, { target: { value: "Savings" } });
      expect(onChange).toHaveBeenCalledWith("Savings", true);
    });

    it("renders inline variant without label", () => {
      render(
        <PayeeField
          value="Test"
          onChange={vi.fn()}
          suggestions={suggestions}
          availableAccounts={accounts}
          variant="inline"
        />,
      );

      expect(screen.queryByText("Payee")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("Test")).toBeInTheDocument();
    });
  });

  describe("CategoryField", () => {
    it("disables input when payee is a transfer account", () => {
      render(
        <CategoryField
          value="Food"
          onChange={vi.fn()}
          suggestions={suggestions}
          payee="Savings"
          availableAccounts={accounts}
        />,
      );

      expect(screen.getByLabelText("Category")).toBeDisabled();
    });

    it("allows editing for non-transfer payees", async () => {
      const onChange = vi.fn();
      render(
        <CategoryField
          value=""
          onChange={onChange}
          suggestions={suggestions}
          payee="Grocery"
          availableAccounts={accounts}
        />,
      );

      await userEvent.type(screen.getByLabelText("Category"), "Food");
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("NotesField", () => {
    it("renders and updates notes", async () => {
      const onChange = vi.fn();
      render(<NotesField value="" onChange={onChange} />);

      expect(screen.getByText("Notes")).toBeInTheDocument();
      await userEvent.type(
        screen.getByPlaceholderText("What was this for?"),
        "memo",
      );
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("TransactionDateField", () => {
    it("renders datepicker and emits ISO date string", () => {
      const onChange = vi.fn();
      render(
        <TransactionDateField
          value="2024-06-15"
          onChange={onChange}
          dateFormat="YYYY-MM-DD"
          firstDayOfWeek={1}
          required
        />,
      );

      expect(screen.getByText("Date")).toBeInTheDocument();
      const picker = screen.getByTestId("datepicker");
      expect(picker).toHaveValue("2024-06-15");
      fireEvent.change(picker, { target: { value: "2024-07-01" } });
      expect(onChange).toHaveBeenCalledWith("2024-07-01");
    });
  });

  describe("AmountField", () => {
    it("renders form variant with text input", async () => {
      const onChange = vi.fn();
      render(<AmountField value="10" onChange={onChange} variant="form" />);

      expect(screen.getByText("Amount")).toBeInTheDocument();
      const input = screen.getByDisplayValue("10");
      await userEvent.clear(input);
      await userEvent.type(input, "25");
      expect(onChange).toHaveBeenCalled();
    });

    it("renders inline variant with NumberInput mock", () => {
      render(<AmountField value={100} onChange={vi.fn()} variant="inline" />);
      expect(screen.getByTestId("number-input")).toBeInTheDocument();
    });
  });

  describe("TransactionAmountFields", () => {
    it("renders amount and currency fields in form variant", () => {
      render(
        <TransactionAmountFields
          amount="50"
          onAmountChange={vi.fn()}
          currency="USD"
          onCurrencyChange={vi.fn()}
          variant="form"
        />,
      );

      expect(screen.getByText("Amount")).toBeInTheDocument();
      expect(screen.getByText("Currency")).toBeInTheDocument();
    });

    it("renders only amount in inline variant", () => {
      render(
        <TransactionAmountFields
          amount={10}
          onAmountChange={vi.fn()}
          currency="EUR"
          onCurrencyChange={vi.fn()}
          variant="inline"
        />,
      );

      expect(screen.getByTestId("number-input")).toBeInTheDocument();
      expect(screen.queryByTestId("currency-select")).not.toBeInTheDocument();
    });
  });

  describe("BuySellField", () => {
    it("toggles buy/sell in form variant", () => {
      const onChange = vi.fn();
      render(<BuySellField isBuy={true} onChange={onChange} variant="form" />);

      fireEvent.click(screen.getByText("Sell"));
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it("uses radio buttons in inline variant", () => {
      const onChange = vi.fn();
      render(
        <BuySellField
          isBuy={false}
          onChange={onChange}
          variant="inline"
          radioName="test-type"
        />,
      );

      const buyRadio = screen.getByRole("radio", { name: "Buy" });
      fireEvent.click(buyRadio);
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe("TickerField", () => {
    it("uppercases ticker input and shows suggestions", () => {
      const onChange = vi.fn();
      const onShowChange = vi.fn();
      render(
        <TickerField
          value=""
          onChange={onChange}
          suggestions={tickerSuggestions}
          showSuggestions={true}
          onShowSuggestionsChange={onShowChange}
          onSuggestionSelect={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByPlaceholderText("AAPL"), {
        target: { value: "aa" },
      });
      expect(onChange).toHaveBeenCalledWith("AA");
      expect(screen.getByText("AAPL")).toBeInTheDocument();
    });

    it("selects a suggestion", () => {
      const onSelect = vi.fn();
      const onShowChange = vi.fn();
      render(
        <TickerField
          value="AA"
          onChange={vi.fn()}
          suggestions={tickerSuggestions}
          showSuggestions={true}
          onShowSuggestionsChange={onShowChange}
          onSuggestionSelect={onSelect}
        />,
      );

      fireEvent.click(screen.getByText("AAPL"));
      expect(onSelect).toHaveBeenCalledWith(tickerSuggestions[0]);
      expect(onShowChange).toHaveBeenCalledWith(false);
    });
  });

  describe("CurrencyField", () => {
    it("calls onCurrencySelected when a currency is picked", () => {
      const onCurrencyChange = vi.fn();
      const onCurrencySelected = vi.fn();
      render(
        <CurrencyField
          value="USD"
          onChange={onCurrencyChange}
          onCurrencySelected={onCurrencySelected}
        />,
      );

      fireEvent.change(screen.getByTestId("currency-select"), {
        target: { value: "EUR" },
      });
      expect(onCurrencyChange).toHaveBeenCalledWith("EUR");
      expect(onCurrencySelected).toHaveBeenCalledWith("EUR");
    });
  });

  describe("InvestmentFields sub-fields", () => {
    it("renders shares, price, and fee fields", () => {
      render(
        <>
          <SharesField value={10} onChange={vi.fn()} variant="form" />
          <PricePerShareField value={150} onChange={vi.fn()} variant="form" />
          <FeeField value={1} onChange={vi.fn()} variant="form" />
        </>,
      );

      expect(screen.getByText("Shares")).toBeInTheDocument();
      expect(screen.getByText("Price per Share")).toBeInTheDocument();
      expect(screen.getByText("Fee")).toBeInTheDocument();
    });
  });

  describe("InvestmentFields", () => {
    function ControlledInvestmentFields() {
      const [date, setDate] = useState("2024-01-01");
      const [isBuy, setIsBuy] = useState(true);
      const [ticker, setTicker] = useState("");
      const [shares, setShares] = useState<number | string>("");
      const [price, setPrice] = useState<number | string>("");
      const [fee, setFee] = useState<number | string>("");
      const [currency, setCurrency] = useState("USD");
      const [showSuggestions, setShowSuggestions] = useState(false);

      return (
        <InvestmentFields
          date={date}
          onDateChange={setDate}
          dateFormat="YYYY-MM-DD"
          firstDayOfWeek={1}
          isBuy={isBuy}
          onBuySellChange={setIsBuy}
          ticker={ticker}
          onTickerChange={setTicker}
          onTickerQueryChange={vi.fn()}
          shares={shares}
          onSharesChange={setShares}
          pricePerShare={price}
          onPricePerShareChange={setPrice}
          fee={fee}
          onFeeChange={setFee}
          currency={currency}
          onCurrencyChange={setCurrency}
          tickerSuggestions={tickerSuggestions}
          showTickerSuggestions={showSuggestions}
          onShowTickerSuggestionsChange={setShowSuggestions}
          onTickerSuggestionSelect={(s) => {
            setTicker(s.symbol);
          }}
        />
      );
    }

    it("renders full form layout with date, buy/sell, and currency", () => {
      render(<ControlledInvestmentFields />);

      expect(screen.getByText("Date")).toBeInTheDocument();
      expect(screen.getByText("Operation")).toBeInTheDocument();
      expect(screen.getByText("Ticker")).toBeInTheDocument();
      expect(screen.getByText("Currency")).toBeInTheDocument();
    });

    it("renders inline variant without labels", () => {
      render(
        <InvestmentFields
          variant="inline"
          date="2024-01-01"
          onDateChange={vi.fn()}
          dateFormat="YYYY-MM-DD"
          firstDayOfWeek={1}
          isBuy={true}
          onBuySellChange={vi.fn()}
          ticker="MSFT"
          onTickerChange={vi.fn()}
          onTickerQueryChange={vi.fn()}
          shares={5}
          onSharesChange={vi.fn()}
          pricePerShare={300}
          onPricePerShareChange={vi.fn()}
          fee={0}
          onFeeChange={vi.fn()}
          currency="USD"
          onCurrencyChange={vi.fn()}
          tickerSuggestions={[]}
          showTickerSuggestions={false}
          onShowTickerSuggestionsChange={vi.fn()}
          onTickerSuggestionSelect={vi.fn()}
        />,
      );

      expect(screen.queryByText("Date")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("MSFT")).toBeInTheDocument();
    });
  });
});
