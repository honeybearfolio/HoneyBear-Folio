import DatePicker from "react-datepicker";
import type { Day } from "date-fns";
import {
  Plus,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import NumberInput from "../../components/ui/NumberInput";
import CustomSelect from "../../components/ui/CustomSelect";
import AutocompleteInput from "./AutocompleteInput";
import { useTranslation } from "react-i18next";
import { useFormatNumber } from "../../utils/format";
import { getDatePickerFormat } from "../../utils/format";
import { CURRENCIES } from "../../utils/currencies";
import type {
  Account,
  AvailableAccount,
  AutocompleteSuggestion,
  TickerSuggestion,
} from "./account-details-types";

interface TransactionFormProps {
  account: Account;
  availableAccounts: AvailableAccount[];
  addTargetAccount: AvailableAccount | null;
  setAddTargetAccount: (v: AvailableAccount | null) => void;
  transactionType: string;
  setTransactionType: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  payee: string;
  setPayee: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  ticker: string;
  setTicker: (v: string) => void;
  shares: string;
  setShares: (v: string) => void;
  pricePerShare: string;
  setPricePerShare: (v: string) => void;
  fee: string;
  setFee: (v: string) => void;
  isBuy: boolean;
  setIsBuy: (v: boolean) => void;
  selectedCurrency: string;
  setSelectedCurrency: (v: string) => void;
  tickerSuggestions: TickerSuggestion[];
  showTickerSuggestions: boolean;
  setShowTickerSuggestions: (v: boolean) => void;
  handleTickerChange: (query: string) => void;
  handleSharesChange: (num: number) => void;
  handlePricePerShareChange: (num: number) => void;
  payeeSuggestions: AutocompleteSuggestion[];
  categorySuggestions: AutocompleteSuggestion[];
  handleAddTransaction: (e: React.FormEvent) => void;
  dateFormat: string;
  firstDayOfWeek: number;
  appCurrency: string;
  checkAndPrompt: (currency: string) => Promise<boolean | void>;
}

export default function TransactionForm({
  account,
  availableAccounts,
  addTargetAccount,
  setAddTargetAccount,
  transactionType,
  setTransactionType,
  date,
  setDate,
  payee,
  setPayee,
  category,
  setCategory,
  notes,
  setNotes,
  amount,
  setAmount,
  ticker,
  setTicker,
  shares,
  pricePerShare,
  fee,
  setFee,
  isBuy,
  setIsBuy,
  selectedCurrency,
  setSelectedCurrency,
  tickerSuggestions,
  showTickerSuggestions,
  setShowTickerSuggestions,
  handleTickerChange,
  handleSharesChange,
  handlePricePerShareChange,
  payeeSuggestions,
  categorySuggestions,
  handleAddTransaction,
  dateFormat,
  firstDayOfWeek,
  appCurrency,
  checkAndPrompt,
}: TransactionFormProps) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();

  return (
    <div className="form-card animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold mb-0 text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-500" />
          {t("account.new_transaction")}
        </h3>
        {account.id === "all" && availableAccounts.length > 0 && (
          <div className="w-48">
            <CustomSelect
              value={addTargetAccount ? addTargetAccount.id : ""}
              onChange={(val) => {
                const selected = availableAccounts.find(
                  (a) => String(a.id) === String(val),
                );
                setAddTargetAccount(selected || null);
              }}
              options={availableAccounts.map((a) => ({
                value: a.id,
                label: a.name,
              }))}
              placeholder={t("account.placeholder.select_account")}
            />
          </div>
        )}

        <div className="ml-4">
          <div className="toggle-group">
            <button
              type="button"
              onClick={() => setTransactionType("cash")}
              className={`toggle-group-btn ${
                transactionType === "cash" ? "toggle-group-btn-active" : ""
              }`}
            >
              {t("dashboard.assets.cash")}
            </button>
            <button
              type="button"
              onClick={() => setTransactionType("investment")}
              className={`toggle-group-btn flex items-center gap-1.5 ${
                transactionType === "investment"
                  ? "toggle-group-btn-active"
                  : ""
              }`}
            >
              {t("transaction.type.investment")}
            </button>
          </div>
        </div>
      </div>

      {transactionType === "investment" ? (
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="form-label">
                {t("account.field.date")}
              </label>
              <DatePicker
                selected={date ? new Date(date) : null}
                onChange={(d: Date | null) =>
                  setDate(d ? d.toISOString().split("T")[0] : "")
                }
                dateFormat={getDatePickerFormat(dateFormat)}
                calendarStartDay={firstDayOfWeek as Day}
                shouldCloseOnSelect={false}
                required
                portalId="datepicker-portal"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">
                {t("scheduled.field.operation")}
              </label>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsBuy(true)}
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
                  onClick={() => setIsBuy(false)}
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

            <div className="relative">
              <label className="form-label">
                {t("import.field.ticker")}
              </label>
              <input
                type="text"
                required
                placeholder={"AAPL"}
                className="form-input uppercase"
                value={ticker}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setTicker(val);
                  handleTickerChange(val);
                  setShowTickerSuggestions(true);
                }}
                onBlur={() =>
                  setTimeout(() => setShowTickerSuggestions(false), 200)
                }
                onFocus={() =>
                  ticker.length >= 2 && setShowTickerSuggestions(true)
                }
              />
              {showTickerSuggestions && tickerSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 mt-1 max-h-60 overflow-y-auto">
                  {tickerSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm"
                      onClick={() => {
                        setTicker(suggestion.symbol);
                        setShowTickerSuggestions(false);
                        if (suggestion.currency) {
                          setSelectedCurrency(
                            suggestion.currency || appCurrency || "USD",
                          );
                        }
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
                {t("import.field.shares")}
              </label>
              <NumberInput
                value={shares}
                onChange={(num) => handleSharesChange(num)}
                className="form-input"
                placeholder={formatNumber(0, {
                  maximumFractionDigits: 6,
                  minimumFractionDigits: 0,
                  useGrouping: false,
                })}
                maximumFractionDigits={6}
                useGrouping={false}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="form-label">
                {t("account.field.price_per_share")}
              </label>
              <NumberInput
                value={pricePerShare}
                onChange={(num) => handlePricePerShareChange(num)}
                className="form-input"
                placeholder={formatNumber(0, {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2,
                })}
                maximumFractionDigits={4}
                minimumFractionDigits={2}
                useGrouping={false}
              />
            </div>

            <div>
              <label className="form-label">{t("import.field.fee")}</label>
              <NumberInput
                value={fee}
                onChange={(val: number) => setFee(String(val))}
                className="form-input"
                placeholder={formatNumber(0, {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2,
                })}
              />
            </div>

            <div>
              <label className="form-label">
                {t("import.field.currency")}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomSelect
                    options={CURRENCIES.map((c) => ({
                      value: c.code,
                      label: `${c.code} - ${c.name}`,
                    }))}
                    value={selectedCurrency}
                    onChange={async (val: string | number) => {
                      setSelectedCurrency(String(val));
                      if (val) await checkAndPrompt(String(val));
                    }}
                    placeholder="Select currency"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="submit" className="btn-primary">
              <Check className="w-4 h-4" />
              {t("account.save_transaction")}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="form-label">
                {t("account.field.date")}
              </label>
              <DatePicker
                selected={date ? new Date(date) : null}
                onChange={(d: Date | null) =>
                  setDate(d ? d.toISOString().split("T")[0] : "")
                }
                dateFormat={getDatePickerFormat(dateFormat)}
                calendarStartDay={firstDayOfWeek as Day}
                shouldCloseOnSelect={false}
                required
                portalId="datepicker-portal"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">
                {t("import.field.payee")}
              </label>
              <AutocompleteInput
                suggestions={payeeSuggestions}
                placeholder={t("account.placeholder.payee")}
                className="form-input"
                value={payee}
                onChange={setPayee}
              />
            </div>

            <div>
              <label className="form-label">
                {t("import.field.category")}
              </label>
              <AutocompleteInput
                suggestions={categorySuggestions}
                placeholder={t("import.field.category")}
                className={`form-input ${
                  availableAccounts?.some((a) => a.name === payee)
                    ? "!bg-slate-100 dark:!bg-slate-800 !text-slate-500 dark:!text-slate-400"
                    : ""
                }`}
                value={category}
                onChange={setCategory}
                disabled={availableAccounts?.some((a) => a.name === payee)}
              />
            </div>

            <div>
              <label className="form-label">
                {t("import.field.notes")}
              </label>
              <input
                type="text"
                placeholder={t("account.notes_placeholder")}
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="form-label">
                {t("import.field.amount")}
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                step="0.01"
                placeholder={formatNumber(0, {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2,
                })}
                className="form-input font-semibold"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">
                {t("import.field.currency")}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomSelect
                    options={CURRENCIES.map((c) => ({
                      value: c.code,
                      label: `${c.code} - ${c.name}`,
                    }))}
                    value={selectedCurrency}
                    onChange={async (val: string | number) => {
                      setSelectedCurrency(String(val));
                      if (val) await checkAndPrompt(String(val));
                    }}
                    placeholder="Select currency"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="submit" className="btn-primary">
              <Check className="w-4 h-4" />
              {t("account.save_transaction")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
