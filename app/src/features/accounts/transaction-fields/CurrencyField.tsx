import { useTranslation } from "react-i18next";
import CustomSelect from "../../../components/ui/CustomSelect";
import { CURRENCIES } from "../../../utils/currencies";
import { getLabelClassName, type FieldVariant } from "./styles";

interface CurrencyFieldProps {
  value: string;
  onChange: (value: string) => void;
  onCurrencySelected?: (currency: string) => void;
  variant?: FieldVariant;
}

export default function CurrencyField({
  value,
  onChange,
  onCurrencySelected,
  variant = "form",
}: CurrencyFieldProps) {
  const { t } = useTranslation();

  const select = (
    <CustomSelect
      options={CURRENCIES.map((currency) => ({
        value: currency.code,
        label: `${currency.code} - ${currency.name}`,
      }))}
      value={value}
      onChange={(nextValue: string | number) => {
        const currency = String(nextValue);
        onChange(currency);
        if (nextValue) {
          onCurrencySelected?.(currency);
        }
      }}
      placeholder="Select currency"
    />
  );

  if (variant === "inline") {
    return select;
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("import.field.currency")}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1">{select}</div>
      </div>
    </div>
  );
}
