import { useTranslation } from "react-i18next";
import {
  getInputClassName,
  getLabelClassName,
  type FieldVariant,
} from "./styles";

interface NotesFieldProps {
  value: string;
  onChange: (value: string) => void;
  variant?: FieldVariant;
  className?: string;
  placeholder?: string;
}

export default function NotesField({
  value,
  onChange,
  variant = "form",
  className,
  placeholder,
}: NotesFieldProps) {
  const { t } = useTranslation();
  const inputClass = className ?? getInputClassName(variant);

  const input = (
    <input
      type="text"
      placeholder={placeholder ?? t("account.notes_placeholder")}
      className={inputClass}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );

  if (variant === "inline") {
    return input;
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("import.field.notes")}
      </label>
      {input}
    </div>
  );
}
