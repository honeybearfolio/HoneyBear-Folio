import DatePicker from "react-datepicker";
import type { Day } from "date-fns";
import { useTranslation } from "react-i18next";
import { getDatePickerFormat } from "../../../utils/format";
import {
  getInputClassName,
  getLabelClassName,
  type FieldVariant,
} from "./styles";

interface TransactionDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  dateFormat: string;
  firstDayOfWeek: number;
  variant?: FieldVariant;
  required?: boolean;
  className?: string;
}

export default function TransactionDateField({
  value,
  onChange,
  dateFormat,
  firstDayOfWeek,
  variant = "form",
  required = false,
  className,
}: TransactionDateFieldProps) {
  const { t } = useTranslation();
  const inputClass = className ?? getInputClassName(variant);

  const picker = (
    <DatePicker
      selected={value ? new Date(value) : null}
      onChange={(date: Date | null) => {
        onChange(date ? (date.toISOString().split("T")[0] ?? "") : "");
      }}
      dateFormat={getDatePickerFormat(dateFormat)}
      calendarStartDay={firstDayOfWeek as Day}
      shouldCloseOnSelect={false}
      required={required}
      portalId="datepicker-portal"
      className={inputClass}
    />
  );

  if (variant === "inline") {
    return picker;
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("account.field.date")}
      </label>
      {picker}
    </div>
  );
}
