import { useState, useEffect, useMemo } from "react";
import type { Account } from "../../api/types";
import type { DashboardTimeRange } from "./dashboard-constants";

interface UseDashboardFiltersArgs {
  accounts: Account[];
  propAccounts: Account[];
  transactions: import("./dashboard-types").Transaction[];
  marketValues: Record<string, number>;
}

export function useDashboardFilters({
  accounts,
  propAccounts,
  transactions,
  marketValues,
}: UseDashboardFiltersArgs) {
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>("1Y");
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
  );
  const [customEndDate, setCustomEndDate] = useState(new Date());

  const [toggledAccounts, setToggledAccounts] = useState<
    Record<string | number, boolean>
  >(() => {
    const map: Record<string | number, boolean> = {};
    propAccounts.forEach((a) => (map[a.id] = true));
    return map;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setToggledAccounts((prev) => {
        const next = { ...prev };
        accounts.forEach((a) => {
          if (!(a.id in next)) {
            next[a.id] = true;
          }
        });
        return next;
      });
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [accounts]);

  const selectedAccountIds = useMemo(() => {
    const set = new Set<string | number>();
    accounts.forEach((a) => {
      if (toggledAccounts[a.id]) set.add(a.id);
    });
    return set;
  }, [accounts, toggledAccounts]);

  const toggleAccountVisibility = (accountId: string | number) => {
    setToggledAccounts((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const setAllAccountsVisibility = (visible: boolean) => {
    const map: Record<string | number, boolean> = {};
    accounts.forEach((a) => (map[a.id] = visible));
    setToggledAccounts(map);
  };

  const filteredAccounts = useMemo(
    () => accounts.filter((a) => selectedAccountIds.has(a.id)),
    [accounts, selectedAccountIds],
  );

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => selectedAccountIds.has(t.account_id)),
    [transactions, selectedAccountIds],
  );

  const filteredMarketValues = useMemo(() => {
    const mv: Record<string, number> = {};
    for (const [id, val] of Object.entries(marketValues)) {
      if (selectedAccountIds.has(Number(id))) mv[id] = val;
    }
    return mv;
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
