import { describe, expect, it } from "vitest";
import type { Account, Transaction } from "../../../api/types";
import {
  filterWidgetTransactions,
  resolveWidgetAccounts,
  resolveWidgetRange,
} from "../../../features/dashboard/dashboard-widget-filters";
import type { WidgetFilter } from "../../../features/dashboard/dashboard-layout";

const accounts: Account[] = [
  { id: 1, name: "Checking", balance: 10, currency: "USD" },
  { id: 2, name: "Savings", balance: 20, currency: "EUR" },
];

const transactions: Transaction[] = [
  {
    id: 1,
    account_id: 1,
    date: "2024-01-02",
    payee: "Market",
    category: "Food",
    amount: -12,
    currency: "USD",
  },
  {
    id: 2,
    account_id: 2,
    date: "2024-03-02",
    payee: "Cafe",
    category: "Food",
    amount: -4,
    currency: "EUR",
  },
];

function filter(
  field: WidgetFilter["field"],
  operator: string,
  value: string,
): WidgetFilter {
  return { id: `${field}-${operator}`, field, operator, value };
}

describe("dashboard widget filters", () => {
  it("limits a card to chosen accounts and still applies other filters", () => {
    const filters = [
      filter("account", "equals", "1"),
      filter("category", "contains", "food"),
      filter("amount", "less_than", "0"),
    ];
    const selected = resolveWidgetAccounts(accounts, ["2"], filters);
    expect(selected.map((account) => account.id)).toEqual([1]);

    expect(
      filterWidgetTransactions(transactions, accounts, selected, filters).map(
        (transaction) => transaction.id,
      ),
    ).toEqual([1]);
  });

  it("filters by payee, currency, and date without an account override", () => {
    const selected = resolveWidgetAccounts(accounts, [], []);
    const matched = filterWidgetTransactions(transactions, accounts, selected, [
      filter("payee", "starts_with", "caf"),
      filter("currency", "equals", "EUR"),
      filter("date", "greater_than", "2024-02-01"),
    ]);
    expect(matched.map((transaction) => transaction.id)).toEqual([2]);
  });

  it("uses the card range when one is set and the dashboard range otherwise", () => {
    const view = {
      timeRange: "1Y" as const,
      customStartDate: "2024-01-01",
      customEndDate: "2024-12-31",
    };
    expect(
      resolveWidgetRange(
        { timeRange: null, customStartDate: null, customEndDate: null },
        view,
      ).timeRange,
    ).toBe("1Y");
    expect(
      resolveWidgetRange(
        {
          timeRange: "CUSTOM",
          customStartDate: "2024-05-01",
          customEndDate: "2024-05-31",
        },
        view,
      ),
    ).toMatchObject({ timeRange: "CUSTOM" });
  });
});
