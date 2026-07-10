import { useTranslation } from "react-i18next";
import NumberInput from "../../../components/ui/NumberInput";
import { useFormatNumber } from "../../../utils/format";
import type { TickerSuggestion } from "../account-details-types";
import BuySellField from "./BuySellField";
import CurrencyField from "./CurrencyField";
import TickerField from "./TickerField";
import TransactionDateField from "./TransactionDateField";
import {
  getInputClassName,
  getLabelClassName,
  type FieldVariant,
} from "./styles";

interface InvestmentFieldsProps {
  variant?: FieldVariant;
  date: string;
  onDateChange: (value: string) => void;
  dateFormat: string;
  firstDayOfWeek: number;
  isBuy: boolean;
  onBuySellChange: (isBuy: boolean) => void;
  ticker: string;
  onTickerChange: (value: string) => void;
  onTickerQueryChange: (query: string) => void;
  shares: string | number | undefined;
  onSharesChange: (value: number) => void;
  pricePerShare: string | number | undefined;
  onPricePerShareChange: (value: number) => void;
  fee: string | number | undefined;
  onFeeChange: (value: number) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  onCurrencySelected?: (currency: string) => void;
  tickerSuggestions: TickerSuggestion[];
  showTickerSuggestions: boolean;
  onShowTickerSuggestionsChange: (show: boolean) => void;
  onTickerSuggestionSelect: (suggestion: TickerSuggestion) => void;
  inputClassName?: string;
}

function SharesField({
  value,
  onChange,
  variant,
  className,
}: {
  value: string | number | undefined;
  onChange: (value: number) => void;
  variant: FieldVariant;
  className?: string;
}) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();

  const input = (
    <NumberInput
      value={value}
      onChange={onChange}
      className={
        className ??
        (variant === "inline"
          ? `${getInputClassName("inline")} text-right`
          : getInputClassName("form"))
      }
      placeholder={formatNumber(0, {
        maximumFractionDigits: 6,
        minimumFractionDigits: 0,
        useGrouping: false,
      })}
      maximumFractionDigits={6}
      useGrouping={false}
    />
  );

  if (variant === "inline") {
    return input;
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("import.field.shares")}
      </label>
      {input}
    </div>
  );
}

function PricePerShareField({
  value,
  onChange,
  variant,
  className,
}: {
  value: string | number | undefined;
  onChange: (value: number) => void;
  variant: FieldVariant;
  className?: string;
}) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();

  const input = (
    <NumberInput
      value={value}
      onChange={onChange}
      className={
        className ??
        (variant === "inline"
          ? `${getInputClassName("inline")} text-right`
          : getInputClassName("form"))
      }
      placeholder={formatNumber(0, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })}
      maximumFractionDigits={variant === "inline" ? 8 : 4}
      {...(variant === "form" ? { minimumFractionDigits: 2 } : {})}
      useGrouping={false}
    />
  );

  if (variant === "inline") {
    return input;
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("account.field.price_per_share")}
      </label>
      {input}
    </div>
  );
}

function FeeField({
  value,
  onChange,
  variant,
  className,
}: {
  value: string | number | undefined;
  onChange: (value: number) => void;
  variant: FieldVariant;
  className?: string;
}) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();

  const input = (
    <NumberInput
      value={value}
      onChange={onChange}
      className={
        className ??
        (variant === "inline"
          ? `${getInputClassName("inline")} text-right`
          : getInputClassName("form"))
      }
      placeholder={formatNumber(0, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })}
      maximumFractionDigits={2}
      {...(variant === "inline" ? { minimumFractionDigits: 2 } : {})}
    />
  );

  if (variant === "inline") {
    return input;
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("import.field.fee")}
      </label>
      {input}
    </div>
  );
}

export default function InvestmentFields({
  variant = "form",
  date,
  onDateChange,
  dateFormat,
  firstDayOfWeek,
  isBuy,
  onBuySellChange,
  ticker,
  onTickerChange,
  onTickerQueryChange,
  shares,
  onSharesChange,
  pricePerShare,
  onPricePerShareChange,
  fee,
  onFeeChange,
  currency,
  onCurrencyChange,
  onCurrencySelected,
  tickerSuggestions,
  showTickerSuggestions,
  onShowTickerSuggestionsChange,
  onTickerSuggestionSelect,
  inputClassName,
}: InvestmentFieldsProps) {
  const inlineClass = inputClassName ?? getInputClassName("inline");

  const inlineFieldProps =
    variant === "inline" ? { className: inlineClass } : {};

  const tickerField = (
    <TickerField
      value={ticker}
      onChange={(value) => {
        onTickerChange(value);
        onTickerQueryChange(value);
      }}
      suggestions={tickerSuggestions}
      showSuggestions={showTickerSuggestions}
      onShowSuggestionsChange={onShowTickerSuggestionsChange}
      onSuggestionSelect={onTickerSuggestionSelect}
      variant={variant}
      {...inlineFieldProps}
      required={variant === "form"}
    />
  );

  const sharesField = (
    <SharesField
      value={shares}
      onChange={onSharesChange}
      variant={variant}
      {...inlineFieldProps}
    />
  );

  const priceField = (
    <PricePerShareField
      value={pricePerShare}
      onChange={onPricePerShareChange}
      variant={variant}
      {...inlineFieldProps}
    />
  );

  const feeField = (
    <FeeField
      value={fee}
      onChange={onFeeChange}
      variant={variant}
      {...inlineFieldProps}
    />
  );

  if (variant === "inline") {
    return (
      <>
        {tickerField}
        {sharesField}
        {priceField}
        {feeField}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <TransactionDateField
          value={date}
          onChange={onDateChange}
          dateFormat={dateFormat}
          firstDayOfWeek={firstDayOfWeek}
          variant="form"
          required
        />
        <BuySellField isBuy={isBuy} onChange={onBuySellChange} variant="form" />
        {tickerField}
        {sharesField}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {priceField}
        {feeField}
        <CurrencyField
          value={currency}
          onChange={onCurrencyChange}
          {...(onCurrencySelected ? { onCurrencySelected } : {})}
          variant="form"
        />
      </div>
    </>
  );
}

export { BuySellField, SharesField, PricePerShareField, FeeField };
