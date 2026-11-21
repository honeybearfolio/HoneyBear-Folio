import { useCallback, useEffect, useMemo, useState } from "react";
import type { SubmitEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { rust, loadAllTransactions } from "../../api/tauri-client";
import type { Account, Transaction } from "../../api/types";
import { AmountField, CategoryField } from "../accounts/transaction-fields";
import type { AutocompleteSuggestion } from "../accounts/account-details-types";
import { STORAGE_KEYS } from "../../constants/app";
import { useNumberFormat } from "../../stores/number-format";
import { useFormatNumber, useParseNumber } from "../../utils/format";
import { handleAsyncError, logError } from "../../utils/errors";
import { ErrorState } from "../../components/ui/Skeleton";
import { useToast } from "../../stores/toast";
import { getMonthlySpending, readBudgetSettings } from "./budget-data";
import { savePortfolioPreference } from "../../stores/portfolio-preferences";
import type { BudgetLimits } from "./budget-data";

function currentMonth(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthDate(month: string, language: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
  }).format(new Date(year!, value! - 1, 1));
}

function shiftMonth(month: string, amount: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year!, value! - 1 + amount, 1);
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetView() {
  const { t } = useTranslation();
  const { currency: appCurrency, uiLanguage } = useNumberFormat();
  const [currency, setBudgetCurrency] = useState(appCurrency);
  const formatNumber = useFormatNumber();
  const parseNumber = useParseNumber();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<
    AutocompleteSuggestion[]
  >([]);
  const [limits, setLimits] = useState<BudgetLimits>({});
  const [month, setMonth] = useState(currentMonth);
  const [categoryInput, setCategoryInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const saved = readBudgetSettings(appCurrency);
      const [ledger, accountRows] = await Promise.all([
        loadAllTransactions(),
        rust.get_accounts({ targetCurrency: saved.currency }),
      ]);
      const savedLimits = saved.limits;
      setBudgetCurrency(saved.currency);
      setTransactions(ledger);
      setAccounts(accountRows);
      setLimits(savedLimits);
      let categoryNames: string[];
      try {
        categoryNames = await rust.get_categories();
      } catch (cause) {
        logError("Failed to fetch budget category suggestions", cause);
        categoryNames = [];
      }
      const categories = new Set([
        ...categoryNames,
        ...ledger.map((transaction) => transaction.category ?? ""),
        ...Object.keys(savedLimits),
      ]);
      setCategorySuggestions(
        [...categories]
          .filter((category) => category.trim().length > 0)
          .map((category) => ({
            value: category,
            label: t("import.field.category"),
            type: "category",
          })),
      );
      setError(null);
    } catch (cause) {
      handleAsyncError({
        context: "Failed to load budget data",
        error: cause,
        setError,
        detailFallback: t("error.failed_to_load"),
      });
    } finally {
      setLoading(false);
    }
  }, [appCurrency, t]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const exchangeRates = useMemo(
    () =>
      Object.fromEntries(
        accounts.map((account) => [
          String(account.id),
          account.exchange_rate || 1,
        ]),
      ),
    [accounts],
  );
  const spending = useMemo(
    () =>
      getMonthlySpending({
        transactions,
        month,
        exchangeRates,
        uncategorizedLabel: t("general.uncategorized"),
      }),
    [transactions, month, exchangeRates, t],
  );
  const spendingByCategory = useMemo(
    () => new Map(spending.map((item) => [item.category, item.amount])),
    [spending],
  );
  const budgetedCategories = Object.keys(limits).sort((a, b) =>
    a.localeCompare(b),
  );
  const unbudgetedSpending = spending.filter(
    (item) => limits[item.category] === undefined,
  );
  const totalBudget = Object.values(limits).reduce(
    (total, amount) => total + amount,
    0,
  );
  const totalSpent = spending.reduce((total, item) => total + item.amount, 0);
  const remaining = totalBudget - totalSpent;
  const progress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  async function persistLimits(nextLimits: BudgetLimits) {
    try {
      await savePortfolioPreference(
        STORAGE_KEYS.BUDGET_LIMITS,
        JSON.stringify({ currency, limits: nextLimits }),
      );
      setLimits(nextLimits);
      return true;
    } catch (cause) {
      handleAsyncError({
        context: "Failed to save budget limits",
        error: cause,
        userMessage: t("error.failed_to_save"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
      return false;
    }
  }

  async function addBudget(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const category = categoryInput.trim();
    const amount = parseNumber(amountInput);
    if (!category || !Number.isFinite(amount) || amount <= 0) return;

    const existing = Object.keys(limits).find(
      (value) => value.toLocaleLowerCase() === category.toLocaleLowerCase(),
    );
    if (existing && existing !== category) {
      showToast(t("budget.error.duplicate"), { type: "error" });
      return;
    }

    if (await persistLimits({ ...limits, [category]: amount })) {
      setCategoryInput("");
      setAmountInput("");
    }
  }

  function removeBudget(category: string) {
    const nextLimits = Object.fromEntries(
      Object.entries(limits).filter(([item]) => item !== category),
    );
    void persistLimits(nextLimits);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6 p-4 md:p-8">
        <div className="h-8 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-36 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <ErrorState
          title={t("error.failed_to_load")}
          message={error}
          onRetry={() => void load()}
          retryLabel={t("error.retry")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {t("budget.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("budget.subtitle")}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setMonth((value) => shiftMonth(value, -1));
            }}
            aria-label={t("budget.previous_month")}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="min-w-32 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
            {monthDate(month, uiLanguage)}
          </span>
          <button
            type="button"
            onClick={() => {
              setMonth((value) => shiftMonth(value, 1));
            }}
            aria-label={t("budget.next_month")}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-brand-50 p-3 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
              <CalendarDays size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t("budget.total_spent")}
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-800 dark:text-slate-100">
                {formatNumber(totalSpent, { style: "currency", currency })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:min-w-64">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("budget.total_budget")}
              </p>
              <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
                {formatNumber(totalBudget, { style: "currency", currency })}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("budget.remaining")}
              </p>
              <p
                className={`mt-1 font-semibold ${remaining < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {formatNumber(remaining, { style: "currency", currency })}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t("budget.monthly_progress")}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
            role="progressbar"
            aria-label={t("budget.monthly_progress")}
            aria-valuenow={Math.min(Math.round(progress), 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full transition-all ${progress > 100 ? "bg-rose-500" : "bg-brand-500"}`}
              style={{ width: `${String(Math.min(progress, 100))}%` }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t("budget.category_budgets")}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("budget.category_budgets_description")}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("budget.currency", { currency })}
          </p>
        </div>

        <form
          onSubmit={(event) => {
            void addBudget(event);
          }}
          className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50 sm:grid-cols-[1fr_180px_auto]"
        >
          <CategoryField
            suggestions={categorySuggestions}
            value={categoryInput}
            onChange={setCategoryInput}
            payee=""
            availableAccounts={[]}
            required
          />
          <AmountField
            value={amountInput}
            onChange={(value) => {
              setAmountInput(String(value));
            }}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 self-end rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus size={16} />
            {t("budget.add_budget")}
          </button>
        </form>

        {budgetedCategories.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {budgetedCategories.map((category) => {
              const limit = limits[category] ?? 0;
              const spent = spendingByCategory.get(category) ?? 0;
              const ratio = limit > 0 ? (spent / limit) * 100 : 0;
              return (
                <div key={category} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {category}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t("budget.spent_of_limit", {
                          spent: formatNumber(spent, {
                            style: "currency",
                            currency,
                          }),
                          limit: formatNumber(limit, {
                            style: "currency",
                            currency,
                          }),
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeBudget(category);
                      }}
                      aria-label={t("budget.remove_category", { category })}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full ${ratio > 100 ? "bg-rose-500" : "bg-brand-500"}`}
                      style={{ width: `${String(Math.min(ratio, 100))}%` }}
                    />
                  </div>
                  <p
                    className={`mt-2 text-right text-xs ${ratio > 100 ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {ratio > 100
                      ? t("budget.over_limit_by", {
                          amount: formatNumber(spent - limit, {
                            style: "currency",
                            currency,
                          }),
                        })
                      : t("budget.left_in_category", {
                          amount: formatNumber(limit - spent, {
                            style: "currency",
                            currency,
                          }),
                        })}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-600">
            <Receipt className="mx-auto mb-3 text-slate-400" size={28} />
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {t("budget.empty_title")}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("budget.empty_description")}
            </p>
          </div>
        )}
      </section>

      {unbudgetedSpending.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t("budget.unbudgeted_spending")}
          </h2>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
            {unbudgetedSpending
              .sort((a, b) => b.amount - a.amount)
              .map(({ category, amount }) => (
                <div
                  key={category}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      {category}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatNumber(amount, { style: "currency", currency })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryInput(category);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:border-slate-600 dark:text-brand-300 dark:hover:bg-slate-700"
                  >
                    {t("budget.set_limit")}
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
