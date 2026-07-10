import { useTranslation } from "react-i18next";
import type { TickerSuggestion } from "../account-details-types";
import {
  getInputClassName,
  getLabelClassName,
  type FieldVariant,
} from "./styles";

interface TickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: TickerSuggestion[];
  showSuggestions: boolean;
  onShowSuggestionsChange: (show: boolean) => void;
  onSuggestionSelect: (suggestion: TickerSuggestion) => void;
  variant?: FieldVariant;
  className?: string;
  required?: boolean;
}

export default function TickerField({
  value,
  onChange,
  suggestions,
  showSuggestions,
  onShowSuggestionsChange,
  onSuggestionSelect,
  variant = "form",
  className,
  required = false,
}: TickerFieldProps) {
  const { t } = useTranslation();
  const inputClass =
    `${className ?? getInputClassName(variant)} uppercase`.trim();
  const dropdownVisible = showSuggestions && suggestions.length > 0;

  const handleInputChange = (nextValue: string) => {
    const normalized = nextValue.toUpperCase();
    onChange(normalized);
    onShowSuggestionsChange(true);
  };

  const field = (
    <div className="relative">
      <input
        type="text"
        required={required}
        placeholder="AAPL"
        className={inputClass}
        value={value}
        onChange={(event) => {
          handleInputChange(event.target.value);
        }}
        onBlur={() => {
          if (variant === "form") {
            setTimeout(() => {
              onShowSuggestionsChange(false);
            }, 200);
          }
        }}
        onFocus={() => {
          if (value.length >= 2) {
            onShowSuggestionsChange(true);
          }
        }}
      />
      {dropdownVisible && (
        <div
          className={`absolute z-50 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 mt-1 max-h-60 overflow-y-auto ${
            variant === "inline"
              ? "z-[100] w-64 border-2 rounded-xl shadow-xl"
              : ""
          }`}
        >
          {suggestions.map((suggestion, index) => (
            <SuggestionItem
              key={suggestion.symbol || String(index)}
              suggestion={suggestion}
              variant={variant}
              onSelect={() => {
                onSuggestionSelect(suggestion);
                onShowSuggestionsChange(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (variant === "inline") {
    return field;
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("import.field.ticker")}
      </label>
      {field}
    </div>
  );
}

function SuggestionItem({
  suggestion,
  variant,
  onSelect,
}: {
  suggestion: TickerSuggestion;
  variant: FieldVariant;
  onSelect: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span
          className={`font-bold text-slate-900 dark:text-slate-100 ${
            variant === "inline" ? "uppercase" : ""
          }`}
        >
          {suggestion.symbol}
        </span>
        {suggestion.currency && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
            {suggestion.currency}
          </span>
        )}
      </div>
      <div
        className={`text-xs text-slate-500 dark:text-slate-400 truncate ${
          variant === "inline" ? "" : ""
        }`}
      >
        {suggestion.shortname || suggestion.longname}
      </div>
      {variant === "form" && (
        <div className="text-xs text-slate-400 dark:text-slate-500">
          {suggestion.exchange} - {suggestion.typeDisp}
        </div>
      )}
    </>
  );

  if (variant === "inline") {
    return (
      <button
        type="button"
        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex flex-col gap-0.5 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm"
      onClick={onSelect}
    >
      {content}
    </div>
  );
}
