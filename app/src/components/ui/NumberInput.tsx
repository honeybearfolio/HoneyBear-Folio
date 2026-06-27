import { useState, useRef, useCallback } from "react";
import { useFormatNumber, useParseNumber } from "../../utils/format";

interface NumberInputProps {
  value: number | string | undefined | null;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  useGrouping?: boolean;
  inputMode?:
    | "decimal"
    | "numeric"
    | "text"
    | "none"
    | "tel"
    | "search"
    | "email"
    | "url";
}

export default function NumberInput({
  value,
  onChange,
  className,
  placeholder,
  maximumFractionDigits,
  minimumFractionDigits,
  useGrouping = true,
  inputMode = "decimal",
}: NumberInputProps) {
  const formatNumber = useFormatNumber();
  const parseNumber = useParseNumber();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const formatDisplayValue = useCallback(
    (val: number | string | undefined | null) => {
      if (val === undefined || val === null || Number.isNaN(Number(val))) {
        return "";
      }
      return formatNumber(Number(val), {
        maximumFractionDigits,
        minimumFractionDigits,
        useGrouping,
      });
    },
    [formatNumber, maximumFractionDigits, minimumFractionDigits, useGrouping],
  );

  const displayValue = editing ? inputValue : formatDisplayValue(value);

  const commitValue = () => {
    const parsed = parseNumber(inputValue);
    const num = Number.isNaN(parsed) ? NaN : parsed;
    onChange(num);
    setEditing(false);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode={inputMode}
      className={className}
      placeholder={placeholder}
      value={displayValue}
      onFocus={() => {
        setEditing(true);
        if (
          value !== undefined &&
          value !== null &&
          !Number.isNaN(Number(value))
        ) {
          setInputValue(
            formatNumber(Number(value), {
              maximumFractionDigits,
              minimumFractionDigits,
              useGrouping,
              ignorePrivacy: true,
            }),
          );
        }
      }}
      onChange={(e) => {
        setInputValue(e.target.value);
      }}
      onBlur={() => {
        commitValue();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commitValue();
          ref.current?.blur();
        }
      }}
    />
  );
}
