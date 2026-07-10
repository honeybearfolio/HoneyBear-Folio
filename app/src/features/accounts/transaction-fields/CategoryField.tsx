import { useTranslation } from "react-i18next";
import AutocompleteInput from "../AutocompleteInput";
import type {
  AutocompleteSuggestion,
  AvailableAccount,
} from "../account-details-types";
import {
  getInputClassName,
  getLabelClassName,
  type FieldVariant,
} from "./styles";
import { isTransferPayee } from "./utils";

interface CategoryFieldProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: AutocompleteSuggestion[];
  payee: string;
  availableAccounts: AvailableAccount[];
  variant?: FieldVariant;
  className?: string;
  placeholder?: string;
}

export default function CategoryField({
  value,
  onChange,
  suggestions,
  payee,
  availableAccounts,
  variant = "form",
  className,
  placeholder,
}: CategoryFieldProps) {
  const { t } = useTranslation();
  const isTransfer = isTransferPayee(payee, availableAccounts);
  const transferClass =
    variant === "form"
      ? "!bg-slate-100 dark:!bg-slate-800 !text-slate-500 dark:!text-slate-400"
      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400";
  const inputClass = `${className ?? getInputClassName(variant)} ${
    isTransfer ? transferClass : ""
  }`.trim();

  const input = (
    <AutocompleteInput
      suggestions={suggestions}
      placeholder={placeholder ?? t("import.field.category")}
      className={inputClass}
      value={value}
      onChange={onChange}
      disabled={isTransfer}
    />
  );

  if (variant === "inline") {
    return input;
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("import.field.category")}
      </label>
      {input}
    </div>
  );
}
