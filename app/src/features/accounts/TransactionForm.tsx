import { Plus, Check } from "lucide-react";
import CustomSelect from "../../components/ui/CustomSelect";
import { useTranslation } from "react-i18next";
import { sameId } from "../../utils/ids";
import type {
  AccountDetailsAccount,
  AvailableAccount,
  AutocompleteSuggestion,
  TickerSuggestion,
} from "./account-details-types";
import {
  TransactionDateField,
  PayeeField,
  CategoryField,
  NotesField,
  TransactionAmountFields,
  InvestmentFields,
} from "./transaction-fields";

interface TransactionFormProps {
  account: AccountDetailsAccount;
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
  handleAddTransaction: (e: React.SyntheticEvent) => Promise<void>;
  dateFormat: string;
  firstDayOfWeek: number;
  appCurrency: string;
  checkAndPrompt: (currency: string) => Promise<boolean>;
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
                const selected = availableAccounts.find((a) =>
                  sameId(a.id, val),
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
              onClick={() => {
                setTransactionType("cash");
              }}
              className={`toggle-group-btn ${
                transactionType === "cash" ? "toggle-group-btn-active" : ""
              }`}
            >
              {t("dashboard.assets.cash")}
            </button>
            <button
              type="button"
              onClick={() => {
                setTransactionType("investment");
              }}
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

      <form
        onSubmit={(e) => {
          void handleAddTransaction(e);
        }}
        className="space-y-4"
      >
        {transactionType === "investment" ? (
          <InvestmentFields
            date={date}
            onDateChange={setDate}
            dateFormat={dateFormat}
            firstDayOfWeek={firstDayOfWeek}
            isBuy={isBuy}
            onBuySellChange={setIsBuy}
            ticker={ticker}
            onTickerChange={setTicker}
            onTickerQueryChange={handleTickerChange}
            shares={shares}
            onSharesChange={handleSharesChange}
            pricePerShare={pricePerShare}
            onPricePerShareChange={handlePricePerShareChange}
            fee={fee}
            onFeeChange={(num) => {
              setFee(String(num));
            }}
            currency={selectedCurrency}
            onCurrencyChange={setSelectedCurrency}
            onCurrencySelected={(currency) => {
              void checkAndPrompt(currency);
            }}
            tickerSuggestions={tickerSuggestions}
            showTickerSuggestions={showTickerSuggestions}
            onShowTickerSuggestionsChange={setShowTickerSuggestions}
            onTickerSuggestionSelect={(suggestion) => {
              setTicker(suggestion.symbol);
              if (suggestion.currency) {
                setSelectedCurrency(
                  suggestion.currency || appCurrency || "USD",
                );
              }
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <TransactionDateField
                value={date}
                onChange={setDate}
                dateFormat={dateFormat}
                firstDayOfWeek={firstDayOfWeek}
                required
              />
              <PayeeField
                value={payee}
                onChange={(nextPayee, isTransfer) => {
                  setPayee(nextPayee);
                  if (isTransfer) {
                    setCategory("Transfer");
                  }
                }}
                suggestions={payeeSuggestions}
                availableAccounts={availableAccounts}
              />
              <CategoryField
                value={category}
                onChange={setCategory}
                suggestions={categorySuggestions}
                payee={payee}
                availableAccounts={availableAccounts}
              />
              <NotesField value={notes} onChange={setNotes} />
            </div>

            <TransactionAmountFields
              amount={amount}
              onAmountChange={(value) => {
                setAmount(String(value));
              }}
              currency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
              onCurrencySelected={(currency) => {
                void checkAndPrompt(currency);
              }}
            />
          </>
        )}

        <div className="flex items-center justify-end gap-3">
          <button type="submit" className="btn-primary">
            <Check className="w-4 h-4" />
            {t("account.save_transaction")}
          </button>
        </div>
      </form>
    </div>
  );
}
