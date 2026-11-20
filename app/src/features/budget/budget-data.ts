import type { Transaction } from "../../api/types";

export interface BudgetCategorySpending {
  category: string;
  amount: number;
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
