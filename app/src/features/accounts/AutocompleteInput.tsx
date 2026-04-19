import { useState, useMemo } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AutocompleteInputProps } from "./account-details-types";

export default function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  disabled,
  ...props
}: AutocompleteInputProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!value) {
      return suggestions;
    } else {
      const query = value.toLowerCase();
      return suggestions.filter((s) => s.value.toLowerCase().includes(query));
    }
  }, [value, suggestions]);

  return (
    <div className="relative w-full">
      <input
        {...props}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-auto text-left py-1">
          {filtered.map((s, i) => (
            <li
              key={i}
              className="px-3 py-2 hover:bg-brand-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center text-sm text-slate-700 dark:text-slate-200"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.value);
                setIsOpen(false);
              }}
            >
              <span className="font-medium">{s.value}</span>
              {s.type === "account" && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" />
                  {t("account.tag.transfer")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
