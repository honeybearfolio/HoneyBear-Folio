import type { Account, Transaction } from "../../api/types";
import { evaluateCondition } from "../rules/rule-engine";
import type { DashboardTimeRange } from "./dashboard-constants";
import {
  parseIsoDate,
  type DashboardViewState,
  type DashboardWidgetInstance,
  type WidgetFilter,
} from "./dashboard-layout";

export interface ResolvedWidgetRange {
  timeRange: DashboardTimeRange;
  customStartDate: Date;
  customEndDate: Date;
}

export function resolveWidgetRange(
  widget: Pick<
    DashboardWidgetInstance,
    "timeRange" | "customStartDate" | "customEndDate"
  >,
  view: Pick<
    DashboardViewState,
    "timeRange" | "customStartDate" | "customEndDate"
  >,
): ResolvedWidgetRange {
  const timeRange = widget.timeRange ?? view.timeRange;
  const startIso = widget.customStartDate ?? view.customStartDate;
  const endIso = widget.customEndDate ?? view.customEndDate;
  return {
    timeRange,
    customStartDate: parseIsoDate(startIso) ?? new Date(),
    customEndDate: parseIsoDate(endIso) ?? new Date(),
  };
}

export function resolveWidgetAccounts(
  accounts: Account[],
  hiddenAccountIds: readonly string[],
  filters: readonly WidgetFilter[],
): Account[] {
  const hidden = new Set(hiddenAccountIds);
  const included = filters
    .filter(
      (filter) => filter.field === "account" && filter.operator === "equals",
    )
    .map((filter) => filter.value)
    .filter((value) => value !== "");
  const excluded = new Set(
    filters
      .filter(
        (filter) =>
          filter.field === "account" && filter.operator === "not_equals",
      )
      .map((filter) => filter.value),
  );

  const base =
    included.length > 0
      ? accounts.filter((account) => included.includes(String(account.id)))
      : accounts.filter((account) => !hidden.has(String(account.id)));

  return base.filter((account) => !excluded.has(String(account.id)));
}

function accountName(
  accountId: string | number,
  accounts: readonly Account[],
): string {
  return (
    accounts.find((account) => String(account.id) === String(accountId))
      ?.name ?? ""
  );
}

function transactionValues(
  transaction: Transaction,
  accounts: readonly Account[],
): Record<string, string> {
  const account = accounts.find(
    (item) => String(item.id) === String(transaction.account_id),
  );
  return {
    account: account?.name ?? String(transaction.account_id),
    category: transaction.category ?? "",
    payee: transaction.payee,
    notes: transaction.notes ?? "",
    amount: String(transaction.amount),
    currency: transaction.currency ?? account?.currency ?? "",
    ticker: transaction.ticker ?? "",
    tags: transaction.tags ?? "",
    fee: transaction.fee == null ? "" : String(transaction.fee),
    shares: transaction.shares == null ? "" : String(transaction.shares),
    price:
      transaction.price_per_share == null
        ? ""
        : String(transaction.price_per_share),
    date: transaction.date,
  };
}

function matchesFilter(
  filter: WidgetFilter,
  values: Record<string, string>,
): boolean {
  if (
    filter.field === "date" &&
    (filter.operator === "greater_than" || filter.operator === "less_than")
  ) {
    const value = values.date ?? "";
    if (!value || !filter.value) return false;
    return filter.operator === "greater_than"
      ? value > filter.value
      : value < filter.value;
  }
  return evaluateCondition(
    { field: filter.field, operator: filter.operator, value: filter.value },
    values,
  );
}

export function filterWidgetTransactions(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
  selectedAccounts: readonly Account[],
  filters: readonly WidgetFilter[],
): Transaction[] {
  const selectedIds = new Set(
    selectedAccounts.map((account) => String(account.id)),
  );
  const detailFilters = filters.filter(
    (filter) =>
      !(
        filter.field === "account" &&
        (filter.operator === "equals" || filter.operator === "not_equals")
      ),
  );

  return transactions.filter((transaction) => {
    if (!selectedIds.has(String(transaction.account_id))) return false;
    if (detailFilters.length === 0) return true;
    const values = transactionValues(transaction, accounts);
    values.account = accountName(transaction.account_id, accounts);
    return detailFilters.every((filter) => matchesFilter(filter, values));
  });
}
