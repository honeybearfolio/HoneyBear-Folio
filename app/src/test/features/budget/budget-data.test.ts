import { describe, expect, it } from "vitest";
import type { Transaction } from "../../../api/types";
import { getMonthlySpending } from "../../../features/budget/budget-data";

const transactions: Transaction[] = [
  {
    id: 1,
    account_id: 1,
    date: "2025-03-05",
    payee: "Market",
    category: "Groceries",
    amount: -40,
  },
  {
    id: 2,
    account_id: 2,
    date: "2025-03-10",
    payee: "Cafe",
    category: "Food",
    amount: -10,
  },
  {
    id: 3,
    account_id: 1,
    date: "2025-03-12",
    payee: "Transfer",
    category: "Transfer",
    amount: -100,
  },
  {
    id: 4,
    account_id: 1,
    date: "2025-03-14",
    payee: "Brokerage",
    category: "Investment",
    amount: -100,
  },
  {
    id: 5,
    account_id: 1,
    date: "2025-03-16",
    payee: "Stock",
    category: "Stocks",
    amount: -50,
    ticker: "ABC",
  },
  {
    id: 6,
    account_id: 1,
    date: "2025-04-01",
    payee: "Market",
    category: "Groceries",
    amount: -25,
  },
  {
    id: 7,
    account_id: 1,
    date: "2025-03-19",
    payee: "Gift",
    amount: -5,
  },
];

describe("getMonthlySpending", () => {
  it("totals expenses for the selected month using each account's exchange rate", () => {
    expect(
      getMonthlySpending({
        transactions,
        month: "2025-03",
        exchangeRates: { "1": 1.5, "2": 1 },
        uncategorizedLabel: "Uncategorized",
      }),
    ).toEqual([
      { category: "Groceries", amount: 60 },
      { category: "Food", amount: 10 },
      { category: "Uncategorized", amount: 7.5 },
    ]);
  });

  it("returns no spending when the selected month has no expenses", () => {
    expect(
      getMonthlySpending({
        transactions,
        month: "2025-05",
        exchangeRates: {},
        uncategorizedLabel: "Uncategorized",
      }),
    ).toEqual([]);
  });
});
