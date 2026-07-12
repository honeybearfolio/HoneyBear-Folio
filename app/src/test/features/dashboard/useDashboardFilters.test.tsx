import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useDashboardFilters } from "../../../features/dashboard/useDashboardFilters";
import type { Account } from "../../../api/types";
import type { Transaction } from "../../../features/dashboard/dashboard-types";

const accounts: Account[] = [
  { id: 1, name: "Checking", balance: 1000, currency: "USD" },
  { id: 2, name: "Savings", balance: 5000, currency: "USD" },
];

const transactions: Transaction[] = [
  { id: 1, account_id: 1, date: "2024-01-01", amount: 100 },
  { id: 2, account_id: 2, date: "2024-01-02", amount: 200 },
];

describe("useDashboardFilters", () => {
  it("defaults all prop accounts to selected", () => {
    const { result } = renderHook(() =>
      useDashboardFilters({
        accounts,
        propAccounts: accounts,
        transactions,
        marketValues: { 1: 1000, 2: 5000 },
      }),
    );

    expect(result.current.selectedAccountIds.size).toBe(2);
    expect(result.current.filteredAccounts).toHaveLength(2);
    expect(result.current.filteredTransactions).toHaveLength(2);
  });

  it("toggleAccountVisibility filters accounts and transactions", () => {
    const { result } = renderHook(() =>
      useDashboardFilters({
        accounts,
        propAccounts: accounts,
        transactions,
        marketValues: { 1: 1000, 2: 5000 },
      }),
    );

    act(() => {
      result.current.toggleAccountVisibility(1);
    });

    expect(result.current.selectedAccountIds.has(1)).toBe(false);
    expect(result.current.filteredAccounts).toHaveLength(1);
    expect(result.current.filteredTransactions).toHaveLength(1);
    expect(result.current.filteredTransactions[0]!.account_id).toBe(2);
  });

  it("setAllAccountsVisibility selects or clears all accounts", () => {
    const { result } = renderHook(() =>
      useDashboardFilters({
        accounts,
        propAccounts: accounts,
        transactions,
        marketValues: {},
      }),
    );

    act(() => {
      result.current.setAllAccountsVisibility(false);
    });
    expect(result.current.filteredAccounts).toHaveLength(0);

    act(() => {
      result.current.setAllAccountsVisibility(true);
    });
    expect(result.current.filteredAccounts).toHaveLength(2);
  });

  it("auto-selects newly added accounts", async () => {
    const { result, rerender } = renderHook(
      ({ currentAccounts }) =>
        useDashboardFilters({
          accounts: currentAccounts,
          propAccounts: [accounts[0]!],
          transactions,
          marketValues: {},
        }),
      { initialProps: { currentAccounts: [accounts[0]!] } },
    );

    expect(result.current.selectedAccountIds.has(2)).toBe(false);

    rerender({ currentAccounts: accounts });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.selectedAccountIds.has(2)).toBe(true);
  });
});
