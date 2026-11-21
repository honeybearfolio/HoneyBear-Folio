import type { Transaction } from "../../api/types";
import { STORAGE_KEYS } from "../../constants/app";
import { readPortfolioPreference } from "../../stores/portfolio-preferences";

export type BudgetLimits = Record<string, number>;

export interface BudgetCategorySpending {
  category: string;
  amount: number;
}

export interface BudgetSettings {
  currency: string;
  limits: BudgetLimits;
}

export function readBudgetSettings(fallbackCurrency: string): BudgetSettings {
  const stored = readPortfolioPreference(STORAGE_KEYS.BUDGET_LIMITS);
  if (!stored) return { currency: fallbackCurrency, limits: {} };

  const parsed: unknown = JSON.parse(stored);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("currency" in parsed) ||
    typeof parsed.currency !== "string" ||
    !parsed.currency ||
    !("limits" in parsed) ||
    !parsed.limits ||
    typeof parsed.limits !== "object" ||
    Array.isArray(parsed.limits)
  ) {
    throw new Error("Saved budget limits are not valid.");
  }

  return {
    currency: parsed.currency,
    limits: Object.fromEntries(
      Object.entries(parsed.limits).filter(
        ([category, amount]) =>
          category.trim().length > 0 &&
          typeof amount === "number" &&
          Number.isFinite(amount) &&
          amount > 0,
      ),
    ),
  };
}

interface MonthlySpendingArgs {
  transactions: Transaction[];
  month: string;
  exchangeRates: Record<string, number>;
  uncategorizedLabel: string;
}

export function getMonthlySpending({
  transactions,
  month,
  exchangeRates,
  uncategorizedLabel,
}: MonthlySpendingArgs): BudgetCategorySpending[] {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (
      !transaction.date.startsWith(`${month}-`) ||
      transaction.amount >= 0 ||
      transaction.category?.toLowerCase() === "transfer" ||
      transaction.category?.toLowerCase() === "investment" ||
      transaction.ticker
    ) {
      continue;
    }

    const category = transaction.category?.trim() || uncategorizedLabel;
    const rate = exchangeRates[String(transaction.account_id)] ?? 1;
    totals.set(
      category,
      (totals.get(category) ?? 0) + Math.abs(transaction.amount) * rate,
    );
  }

  return [...totals].map(([category, amount]) => ({ category, amount }));
}
