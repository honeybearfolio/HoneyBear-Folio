import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLabelClassName, type FieldVariant } from "./styles";

interface BuySellFieldProps {
  isBuy: boolean;
  onChange: (isBuy: boolean) => void;
  variant?: FieldVariant;
  radioName?: string;
}

export default function BuySellField({
  isBuy,
  onChange,
  variant = "form",
  radioName = "txType",
}: BuySellFieldProps) {
  const { t } = useTranslation();

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={isBuy}
            onChange={() => {
              onChange(true);
            }}
            className="w-4 h-4 text-slate-600 dark:text-slate-400 accent-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {t("transaction.type.buy")}
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={!isBuy}
            onChange={() => {
              onChange(false);
            }}
            className="w-4 h-4 text-slate-600 dark:text-slate-400 accent-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {t("transaction.type.sell")}
          </span>
        </label>
      </div>
    );
  }

  return (
    <div>
      <label className={getLabelClassName(variant)}>
        {t("scheduled.field.operation")}
      </label>
      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
        <button
          type="button"
          onClick={() => {
            onChange(true);
          }}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            isBuy
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <ArrowDownLeft size={13} />
          {t("transaction.type.buy")}
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(false);
          }}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            !isBuy
              ? "bg-rose-500 text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <ArrowUpRight size={13} />
          {t("transaction.type.sell")}
        </button>
      </div>
    </div>
  );
}
