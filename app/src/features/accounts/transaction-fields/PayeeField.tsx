import { useTranslation } from "react-i18next";
import AutocompleteInput from "../AutocompleteInput";
import type {
  AutocompleteSuggestion,
  AvailableAccount,
} from "../account-details-types";
import { getInputClassName, type FieldVariant } from "./styles";
import { isTransferPayee } from "./utils";

interface PayeeFieldProps {
  value: string;
  onChange: (value: string, isTransfer: boolean) => void;
  suggestions: AutocompleteSuggestion[];
  availableAccounts: AvailableAccount[];
  variant?: FieldVariant;
  className?: string;
  placeholder?: string;
}

export default function PayeeField({
  value,
  onChange,
  suggestions,
  availableAccounts,
  variant = "form",
  className,
  placeholder,
}: PayeeFieldProps) {
  const { t } = useTranslation();
  const inputClass = className ?? getInputClassName(variant);

  const handleChange = (nextValue: string) => {
    onChange(nextValue, isTransferPayee(nextValue, availableAccounts));
  };

  const input = (
    <AutocompleteInput
      suggestions={suggestions}
      placeholder={placeholder ?? t("account.placeholder.payee")}
      className={inputClass}
      value={value}
      onChange={handleChange}
    />
  );

  if (variant === "inline") {
    return input;
  }

  return (
    <div>
      <label className="form-label">{t("import.field.payee")}</label>
      {input}
    </div>
  );
}
