import { useTranslation } from "react-i18next";
import NumberInput from "../../../components/ui/NumberInput";
import { useFormatNumber } from "../../../utils/format";
import CurrencyField from "./CurrencyField";
import {
  getInputClassName,
  getLabelClassName,
  type FieldVariant,
} from "./styles";

interface AmountFieldProps {
  value: string | number | undefined;
  onChange: (value: number | string) => void;
  variant?: FieldVariant;
  className?: string;
}

export default function AmountField({
  value,
  onChange,
  variant = "form",
  className,
}: AmountFieldProps) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const placeholder = formatNumber(0, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  if (variant === "inline") {
    return (
      <NumberInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className ?? `${getInputClassName("inline")} text-right`}
        maximumFractionDigits={2}
        minimumFractionDigits={2}
      />
    );
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("import.field.amount")}
      </label>
      <input
        type="text"
        inputMode="decimal"
        required
        step="0.01"
        placeholder={placeholder}
        className={`${getInputClassName("form")} font-semibold`}
        value={typeof value === "number" ? String(value) : (value ?? "")}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

interface TransactionAmountFieldsProps {
  amount: string | number | undefined;
  onAmountChange: (value: number | string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  onCurrencySelected?: (currency: string) => void;
  variant?: FieldVariant;
  amountClassName?: string;
}

export function TransactionAmountFields({
  amount,
  onAmountChange,
  currency,
  onCurrencyChange,
  onCurrencySelected,
  variant = "form",
  amountClassName,
}: TransactionAmountFieldsProps) {
  if (variant === "form") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AmountField value={amount} onChange={onAmountChange} variant="form" />
        <CurrencyField
          value={currency}
          onChange={onCurrencyChange}
          {...(onCurrencySelected ? { onCurrencySelected } : {})}
          variant="form"
        />
      </div>
    );
  }

  return (
    <AmountField
      value={amount}
      onChange={onAmountChange}
      variant="inline"
      {...(amountClassName ? { className: amountClassName } : {})}
    />
  );
}
