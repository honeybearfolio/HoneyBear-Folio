import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Account, Goal, PendingOccurrence } from "../../api/types";
import { rust, loadAllTransactions } from "../../api/tauri-client";
import { computeGoalProgress } from "../../utils/goal-progress";
import {
  fetchHoldingValuesForAccounts,
  type HoldingValueMap,
} from "../../utils/market-values";
import { logError } from "../../utils/errors";
import { getMonthlySpending, readBudgetSettings } from "../budget/budget-data";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";

interface BudgetCategoryStatus {
  name: string;
  spent: number;
  limit: number;
}

export interface DashboardInsights {
  budget: {
    loading: boolean;
    error: boolean;
    currency: string;
    totalBudget: number;
    totalSpent: number;
    overBudget: BudgetCategoryStatus[];
  };
  goals: {
    loading: boolean;
    error: boolean;
    items: Array<{
      id: number;
      name: string;
      current: number;
      target: number;
      percent: number;
      status: string;
    }>;
  };
  scheduled: {
    loading: boolean;
    error: boolean;
    items: PendingOccurrence[];
  };
}

function currentMonth(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dateAfterDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const EMPTY_BUDGET = {
  loading: false,
  error: false,
  currency: "USD",
  totalBudget: 0,
  totalSpent: 0,
  overBudget: [] as BudgetCategoryStatus[],
};
const EMPTY_GOALS = {
  loading: false,
  error: false,
  items: [] as DashboardInsights["goals"]["items"],
};
const EMPTY_SCHEDULED = {
  loading: false,
  error: false,
  items: [] as PendingOccurrence[],
};

type LoadState<T> = { key: string; value: T };

export function useDashboardInsights(
  accounts: Account[],
  appCurrency: string,
  ready: boolean,
): DashboardInsights {
  const { t } = useTranslation();
  const layout = useDashboardPreferencesStore((state) => state.layout);
  const needsBudget = layout.some((widget) => widget.type === "budgetHealth");
  const needsGoals = layout.some((widget) => widget.type === "goalProgress");
  const needsScheduled = layout.some(
    (widget) => widget.type === "upcomingScheduled",
  );
  const accountKey = useMemo(
    () =>
      accounts
        .map(
          (account) =>
            `${String(account.id)}:${String(account.exchange_rate ?? 1)}`,
        )
        .join("|"),
    [accounts],
  );
  const [budgetState, setBudgetState] = useState<LoadState<
    typeof EMPTY_BUDGET
  > | null>(null);
  const [goalsState, setGoalsState] = useState<LoadState<
    typeof EMPTY_GOALS
  > | null>(null);
  const [scheduledState, setScheduledState] = useState<LoadState<
    typeof EMPTY_SCHEDULED
  > | null>(null);
  const budgetKey = `${currentMonth()}|${appCurrency}|${accountKey}`;
  const goalsKey = `${appCurrency}|${accountKey}`;
  const scheduledKey = "30";
  const budget =
    budgetState?.key === budgetKey
      ? budgetState.value
      : { ...EMPTY_BUDGET, loading: needsBudget };
  const goals =
    goalsState?.key === goalsKey
      ? goalsState.value
      : { ...EMPTY_GOALS, loading: needsGoals };
  const scheduled =
    scheduledState?.key === scheduledKey
      ? scheduledState.value
      : { ...EMPTY_SCHEDULED, loading: needsScheduled };

  useEffect(() => {
    if (!ready || !needsBudget) return;
    void (async () => {
      try {
        const { limits, currency } = readBudgetSettings(appCurrency);
        const [transactions, budgetAccounts] = await Promise.all([
          loadAllTransactions(),
          currency === appCurrency
            ? Promise.resolve(accounts)
            : rust.get_accounts({ targetCurrency: currency }),
        ]);
        const visibleIds = new Set(
          accounts.map((account) => String(account.id)),
        );
        const spending = getMonthlySpending({
          transactions,
          month: currentMonth(),
          exchangeRates: Object.fromEntries(
            budgetAccounts
              .filter((account) => visibleIds.has(String(account.id)))
              .map((account) => [
                String(account.id),
                account.exchange_rate || 1,
              ]),
          ),
          uncategorizedLabel: t("general.uncategorized"),
        });
        const spentByCategory = new Map(
          spending.map(({ category, amount }) => [category, amount]),
        );
        setBudgetState({
          key: budgetKey,
          value: {
            loading: false,
            error: false,
            currency,
            totalBudget: Object.values(limits).reduce(
              (total, amount) => total + amount,
              0,
            ),
            totalSpent: spending.reduce(
              (total, item) => total + item.amount,
              0,
            ),
            overBudget: Object.entries(limits)
              .map(([name, limit]) => ({
                name,
                limit,
                spent: spentByCategory.get(name) ?? 0,
              }))
              .filter((category) => category.spent > category.limit)
              .sort((a, b) => b.spent / b.limit - a.spent / a.limit),
          },
        });
      } catch (error) {
        logError("Failed to load dashboard budget health", error);
        setBudgetState({
          key: budgetKey,
          value: { ...EMPTY_BUDGET, error: true },
        });
      }
    })();
  }, [accounts, appCurrency, budgetKey, needsBudget, ready, t]);

  useEffect(() => {
    if (!ready || !needsGoals) return;
    void (async () => {
      try {
        const goalRows = await rust.get_goals({
          targetCurrency: appCurrency || "USD",
        });
        const activeGoals = goalRows.filter((goal: Goal) => !goal.archived);
        if (activeGoals.length === 0) {
          setGoalsState({ key: goalsKey, value: { ...EMPTY_GOALS } });
          return;
        }
        let holdingValues: HoldingValueMap = {};
        try {
          holdingValues = await fetchHoldingValuesForAccounts(
            accounts,
            appCurrency || "USD",
          );
        } catch (error) {
          logError("Failed to fetch market values for dashboard goals", error);
        }
        const progress = activeGoals.map((goal) => {
          const result = computeGoalProgress({
            targetAmount: goal.target_amount,
            exchangeRate: goal.exchange_rate,
            createdAt: goal.created_at,
            targetDate: goal.target_date ?? null,
            monthlyContribution: goal.monthly_contribution ?? null,
            links: goal.links.map((link) => ({
              sourceType: link.source_type,
              accountId: link.account_id ?? null,
              ticker: link.ticker ?? null,
              allocationPercent: link.allocation_percent,
            })),
            accounts: accounts.map((account) => ({
              id: account.id,
              name: account.name,
              balance: account.balance,
              exchangeRate: account.exchange_rate || 1,
            })),
            holdingValues,
          });
          return {
            id: goal.id,
            name: goal.name,
            current: result.current,
            target: result.target,
            percent: result.percent,
            status: result.status,
          };
        });
        progress.sort(
          (a, b) =>
            Number(b.status === "behind") - Number(a.status === "behind") ||
            a.percent - b.percent,
        );
        setGoalsState({
          key: goalsKey,
          value: { loading: false, error: false, items: progress },
        });
      } catch (error) {
        logError("Failed to load dashboard goal progress", error);
        setGoalsState({
          key: goalsKey,
          value: { ...EMPTY_GOALS, error: true },
        });
      }
    })();
  }, [accountKey, accounts, appCurrency, goalsKey, needsGoals, ready]);

  useEffect(() => {
    if (!ready || !needsScheduled) return;
    void rust
      .get_pending_occurrences({ accountId: null, lookaheadDays: 30 })
      .then((occurrences) => {
        const endDate = dateAfterDays(30);
        setScheduledState({
          key: scheduledKey,
          value: {
            loading: false,
            error: false,
            items: occurrences
              .filter(
                (occurrence) =>
                  occurrence.status === "upcoming" &&
                  occurrence.date <= endDate,
              )
              .sort((a, b) => a.date.localeCompare(b.date)),
          },
        });
      })
      .catch((error: unknown) => {
        logError("Failed to load upcoming dashboard transactions", error);
        setScheduledState({
          key: scheduledKey,
          value: { ...EMPTY_SCHEDULED, error: true },
        });
      });
  }, [needsScheduled, ready, scheduledKey]);

  return { budget, goals, scheduled };
}
