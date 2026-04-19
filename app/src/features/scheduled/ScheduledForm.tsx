import DatePicker from "react-datepicker";
import type { Day } from "date-fns";
import {
  Plus,
  Edit,
  Save,
  X,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import CustomSelect from "../../components/ui/CustomSelect";
import NumberInput from "../../components/ui/NumberInput";
import { getDatePickerFormat } from "../../utils/format";
import { WEEKDAY_KEYS } from "./scheduled-helpers";
import { currencyOptions } from "./scheduled-types";
import type { TickerSuggestion } from "./scheduled-types";
import type { ScheduledFormState } from "./scheduled-helpers";
import type { RefObject } from "react";

interface ScheduledFormProps {
  formRef: RefObject<HTMLDivElement | null>;
  isEditing: boolean;
  formState: ScheduledFormState;
  setFormState: React.Dispatch<React.SetStateAction<ScheduledFormState>>;
  showTickerSuggestions: boolean;
  setShowTickerSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  tickerSuggestions: TickerSuggestion[];
  accountOptions: { value: number; label: string }[];
  dateFormat: string;
  firstDayOfWeek: number;
  handleTickerChange: (query: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  resetForm: () => void;
  toggleDayOfWeek: (day: number) => void;
}

export default function ScheduledForm({
  formRef,
  isEditing,
  formState,
  setFormState,
  showTickerSuggestions,
  setShowTickerSuggestions,
  tickerSuggestions,
  accountOptions,
  dateFormat,
  firstDayOfWeek,
  handleTickerChange,
  handleSubmit,
  resetForm,
  toggleDayOfWeek,
}: ScheduledFormProps) {
  const { t } = useTranslation();

  const recurrenceTypeOptions = [
    { value: "every_n", label: t("scheduled.recurrence.every_n") },
    { value: "day_of_week", label: t("scheduled.recurrence.day_of_week") },
    {
      value: "ordinal_weekday",
      label: t("scheduled.recurrence.ordinal_weekday"),
    },
  ];

  const intervalUnitOptions = [
    { value: "day", label: t("scheduled.unit.day") },
    { value: "week", label: t("scheduled.unit.week") },
    { value: "month", label: t("scheduled.unit.month") },
    { value: "year", label: t("scheduled.unit.year") },
  ];

  const ordinalOptions = [
    { value: 1, label: t("scheduled.ordinal.1") },
    { value: 2, label: t("scheduled.ordinal.2") },
    { value: 3, label: t("scheduled.ordinal.3") },
    { value: 4, label: t("scheduled.ordinal.4") },
    { value: 5, label: t("scheduled.ordinal.5") },
    { value: -1, label: t("scheduled.ordinal.-1") },
  ];

  const weekdayOptions = WEEKDAY_KEYS.map((key, i) => ({
    value: i,
    label: t(key),
  }));

  return (
    <div ref={formRef} className="form-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          {isEditing ? (
            <>
              <Edit size={15} />
              {t("scheduled.update")}
            </>
          ) : (
            <>
              <Plus size={15} />
              {t("scheduled.create")}
            </>
          )}
        </h2>
        <button
          onClick={resetForm}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type Toggle */}
        <div className="toggle-group">
          <button
            type="button"
            onClick={() =>
              setFormState((prev) => ({
                ...prev,
                transactionType: "regular",
              }))
            }
            className={`toggle-group-btn ${
              formState.transactionType === "regular"
                ? "toggle-group-btn-active"
                : ""
            }`}
          >
            {t("scheduled.type.regular")}
          </button>
          <button
            type="button"
            onClick={() =>
              setFormState((prev) => ({
                ...prev,
                transactionType: "investment",
              }))
            }
            className={`toggle-group-btn flex items-center gap-1.5 ${
              formState.transactionType === "investment"
                ? "toggle-group-btn-active"
                : ""
            }`}
          >
            <TrendingUp size={13} />
            {t("scheduled.type.investment")}
          </button>
        </div>

        {formState.transactionType === "regular" ? (
          <>
            {/* Row 1: Account, Payee, Amount, Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="form-label">
                  {t("scheduled.field.account")} *
                </label>
                <CustomSelect
                  value={formState.accountId ?? undefined}
                  onChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      accountId: Number(val),
                    }))
                  }
                  options={accountOptions}
                  placeholder={t("scheduled.field.account")}
                  className="w-full"
                />
              </div>
              <div>
                <label className="form-label">
                  {t("scheduled.field.payee")} *
                </label>
                <input
                  type="text"
                  value={formState.payee}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      payee: e.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder={t("scheduled.field.payee")}
                />
              </div>
              <div>
                <label className="form-label">
                  {t("scheduled.field.amount")}
                </label>
                <NumberInput
                  value={formState.amount}
                  onChange={(val) =>
                    setFormState((prev) => ({ ...prev, amount: val }))
                  }
                  className="form-input"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="form-label">
                  {t("scheduled.field.currency")}
                </label>
                <CustomSelect
                  value={formState.currency}
                  onChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      currency: String(val),
                    }))
                  }
                  options={currencyOptions}
                  placeholder={t("scheduled.field.currency")}
                  className="w-full"
                />
              </div>
            </div>

            {/* Row 2: Category, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">
                  {t("scheduled.field.category")}
                </label>
                <input
                  type="text"
                  value={formState.category}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder={t("scheduled.field.category")}
                />
              </div>
              <div>
                <label className="form-label">
                  {t("scheduled.field.notes")}
                </label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder={t("scheduled.field.notes")}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Investment Row 1: Account, Buy/Sell, Ticker, Shares */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="form-label">
                  {t("scheduled.field.account")} *
                </label>
                <CustomSelect
                  value={formState.accountId ?? undefined}
                  onChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      accountId: Number(val),
                    }))
                  }
                  options={accountOptions}
                  placeholder={t("scheduled.field.account")}
                  className="w-full"
                />
              </div>
              <div>
                <label className="form-label">
                  {t("scheduled.field.operation")}
                </label>
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({ ...prev, isBuy: true }))
                    }
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      formState.isBuy
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <ArrowDownLeft size={13} />
                    {t("scheduled.field.buy")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({ ...prev, isBuy: false }))
                    }
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      !formState.isBuy
                        ? "bg-rose-500 text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <ArrowUpRight size={13} />
                    {t("scheduled.field.sell")}
                  </button>
                </div>
              </div>
              <div className="relative">
                <label className="form-label">
                  {t("scheduled.field.ticker")} *
                </label>
                <input
                  type="text"
                  value={formState.ticker}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFormState((prev) => ({ ...prev, ticker: val }));
                    handleTickerChange(val);
                    setShowTickerSuggestions(true);
                  }}
                  onBlur={() =>
                    setTimeout(() => setShowTickerSuggestions(false), 200)
                  }
                  onFocus={() =>
                    formState.ticker.length >= 2 &&
                    setShowTickerSuggestions(true)
                  }
                  className="form-input"
                  placeholder="AAPL"
                />
                {showTickerSuggestions && tickerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 mt-1 max-h-60 overflow-y-auto">
                    {tickerSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm"
                        onClick={() => {
                          setFormState((prev) => ({
                            ...prev,
                            ticker: suggestion.symbol,
                            ...(suggestion.currency
                              ? { currency: suggestion.currency }
                              : {}),
                          }));
                          setShowTickerSuggestions(false);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {suggestion.symbol}
                          </span>
                          {suggestion.currency && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                              {suggestion.currency}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {suggestion.shortname || suggestion.longname}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {suggestion.exchange} - {suggestion.typeDisp}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">
                  {t("scheduled.field.shares")}
                </label>
                <NumberInput
                  value={formState.shares}
                  onChange={(val) =>
                    setFormState((prev) => ({ ...prev, shares: val }))
                  }
                  className="form-input"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Investment Row 2: Price, Fee, Currency, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="form-label">
                  {t("scheduled.field.price_per_share")}
                </label>
                <NumberInput
                  value={formState.pricePerShare}
                  onChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      pricePerShare: val,
                    }))
                  }
                  className="form-input"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="form-label">{t("scheduled.field.fee")}</label>
                <NumberInput
                  value={formState.fee}
                  onChange={(val) =>
                    setFormState((prev) => ({ ...prev, fee: val }))
                  }
                  className="form-input"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="form-label">
                  {t("scheduled.field.currency")}
                </label>
                <CustomSelect
                  value={formState.currency}
                  onChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      currency: String(val),
                    }))
                  }
                  options={currencyOptions}
                  placeholder={t("scheduled.field.currency")}
                  className="w-full"
                />
              </div>
              <div>
                <label className="form-label">
                  {t("scheduled.field.notes")}
                </label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="form-input"
                  placeholder={t("scheduled.field.notes")}
                />
              </div>
            </div>
          </>
        )}

        {/* Row 3: Recurrence configuration */}
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-3">
          <h3 className="form-label !mb-0">
            {t("scheduled.field.recurrence")}
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            <CustomSelect
              value={formState.recurrenceType}
              onChange={(val) =>
                setFormState((prev) => ({
                  ...prev,
                  recurrenceType: String(val),
                }))
              }
              options={recurrenceTypeOptions}
              className="w-52"
            />

            {formState.recurrenceType === "every_n" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {t("scheduled.recurrence.every")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={formState.intervalValue}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      intervalValue: Number(e.target.value) || 1,
                    }))
                  }
                  className="form-input !w-16 text-center"
                />
                <CustomSelect
                  value={formState.intervalUnit}
                  onChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      intervalUnit: String(val),
                    }))
                  }
                  options={intervalUnitOptions}
                  className="w-32"
                />
              </div>
            )}

            {formState.recurrenceType === "day_of_week" && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_KEYS.map((key, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDayOfWeek(i)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      formState.daysOfWeek.includes(i)
                        ? "bg-brand-500 text-white shadow-sm"
                        : "bg-white dark:bg-slate-600 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-500"
                    }`}
                  >
                    {t(key).slice(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {formState.recurrenceType === "ordinal_weekday" && (
              <div className="flex items-center gap-2">
                <CustomSelect
                  value={formState.ordinal}
                  onChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      ordinal: Number(val),
                    }))
                  }
                  options={ordinalOptions}
                  className="w-24"
                />
                <CustomSelect
                  value={formState.weekday}
                  onChange={(val) =>
                    setFormState((prev) => ({
                      ...prev,
                      weekday: Number(val),
                    }))
                  }
                  options={weekdayOptions}
                  className="w-36"
                />
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Start date, End date, Max occurrences + Submit */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <label className="form-label">
              {t("scheduled.field.start_date")}
            </label>
            <DatePicker
              selected={
                formState.startDate
                  ? new Date(formState.startDate + "T00:00:00")
                  : null
              }
              onChange={(date: Date | null) =>
                setFormState((prev) => {
                  if (!date) return { ...prev, startDate: prev.startDate };
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  return { ...prev, startDate: `${year}-${month}-${day}` };
                })
              }
              dateFormat={getDatePickerFormat(dateFormat)}
              calendarStartDay={firstDayOfWeek as Day}
              portalId="datepicker-portal"
              className="form-input"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="form-label">
              {t("scheduled.field.end_date")}
            </label>
            <DatePicker
              selected={
                formState.endDate
                  ? new Date(formState.endDate + "T00:00:00")
                  : null
              }
              onChange={(date: Date | null) =>
                setFormState((prev) => {
                  if (!date) return { ...prev, endDate: "" };
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  return { ...prev, endDate: `${year}-${month}-${day}` };
                })
              }
              dateFormat={getDatePickerFormat(dateFormat)}
              calendarStartDay={firstDayOfWeek as Day}
              isClearable
              portalId="datepicker-portal"
              className="form-input"
            />
          </div>
          <div className="w-28">
            <label className="form-label">
              {t("scheduled.field.max_occurrences")}
            </label>
            <input
              type="number"
              min="1"
              value={formState.maxOccurrences}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  maxOccurrences: e.target.value,
                }))
              }
              className="form-input text-center"
              placeholder="∞"
            />
          </div>
          <div className="flex-1" />
          {isEditing && (
            <button type="button" onClick={resetForm} className="btn-secondary">
              {t("scheduled.cancel")}
            </button>
          )}
          <button type="submit" className="btn-primary">
            <Save size={15} />
            {isEditing ? t("scheduled.update") : t("scheduled.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
