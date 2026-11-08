import { useMemo } from "react";
import type { Account } from "../../api/types";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";
import type { DashboardTimeRange } from "./dashboard-constants";
import { formatIsoDate, parseIsoDate } from "./dashboard-layout";
import type { Transaction } from "./dashboard-types";

interface UseDashboardFiltersArgs {
  accounts: Account[];
  transactions: Transaction[];
  marketValues: Record<string, number>;
}

export function useDashboardFilters({
  accounts,
  transactions,
  marketValues,
}: UseDashboardFiltersArgs) {
  const timeRange = useDashboardPreferencesStore(
    (state) => state.view.timeRange,
  );
  const customStartDateIso = useDashboardPreferencesStore(
    (state) => state.view.customStartDate,
  );
  const customEndDateIso = useDashboardPreferencesStore(
    (state) => state.view.customEndDate,
  );
  const hiddenAccountIds = useDashboardPreferencesStore(
    (state) => state.view.hiddenAccountIds,
  );
  const setStoredTimeRange = useDashboardPreferencesStore(
    (state) => state.setTimeRange,
  );
  const setCustomRange = useDashboardPreferencesStore(
    (state) => state.setCustomRange,
  );
  const setHiddenAccountIds = useDashboardPreferencesStore(
    (state) => state.setHiddenAccountIds,
  );

  const customStartDate = useMemo(
    () => parseIsoDate(customStartDateIso) ?? new Date(),
    [customStartDateIso],
  );
  const customEndDate = useMemo(
    () => parseIsoDate(customEndDateIso) ?? new Date(),
    [customEndDateIso],
  );

  const hiddenIds = useMemo(
    () => new Set(hiddenAccountIds),
    [hiddenAccountIds],
  );

  const setTimeRange = (range: DashboardTimeRange) => {
    setStoredTimeRange(range);
  };

  const setCustomStartDate = (date: Date) => {
    const endIso = useDashboardPreferencesStore.getState().view.customEndDate;
    const end = parseIsoDate(endIso);
    const startIso = formatIsoDate(date);
    const nextEnd = end && date > end ? startIso : endIso;
    setCustomRange(startIso, nextEnd);
  };

  const setCustomEndDate = (date: Date) => {
    const startIso =
      useDashboardPreferencesStore.getState().view.customStartDate;
    const start = parseIsoDate(startIso);
    const endIso = formatIsoDate(date);
    const nextStart = start && date < start ? endIso : startIso;
    setCustomRange(nextStart, endIso);
  };

  const toggleAccountVisibility = (accountId: string | number) => {
    const key = String(accountId);
    const current =
      useDashboardPreferencesStore.getState().view.hiddenAccountIds;
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHiddenAccountIds([...next]);
  };

  const setAllAccountsVisibility = (visible: boolean) => {
    if (visible) {
      setHiddenAccountIds([]);
      return;
    }
    setHiddenAccountIds(accounts.map((account) => String(account.id)));
  };

  const selectedAccountIds = useMemo(() => {
    const set = new Set<string | number>();
    accounts.forEach((account) => {
      if (!hiddenIds.has(String(account.id))) set.add(account.id);
    });
    return set;
  }, [accounts, hiddenIds]);

  const toggledAccounts = useMemo(() => {
    const map: Record<string | number, boolean> = {};
    accounts.forEach((account) => {
      map[account.id] = !hiddenIds.has(String(account.id));
    });
    return map;
  }, [accounts, hiddenIds]);

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIds.has(account.id)),
    [accounts, selectedAccountIds],
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) =>
        selectedAccountIds.has(transaction.account_id),
      ),
    [transactions, selectedAccountIds],
  );

  const filteredMarketValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const [id, value] of Object.entries(marketValues)) {
      if (selectedAccountIds.has(Number(id))) values[id] = value;
    }
    return values;
  }, [marketValues, selectedAccountIds]);

  return {
    timeRange,
    setTimeRange,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    toggledAccounts,
    selectedAccountIds,
    toggleAccountVisibility,
    setAllAccountsVisibility,
    filteredAccounts,
    filteredTransactions,
    filteredMarketValues,
  };
}
