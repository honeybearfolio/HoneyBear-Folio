import { useCallback, useEffect, useMemo, useState } from "react";
import { rust } from "../../api/tauri-client";
import type { Account, Goal } from "../../api/types";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Edit,
  Plus,
  Trash2,
} from "lucide-react";
import { useConfirm } from "../../stores/confirm";
import { useToast } from "../../stores/toast";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "../../stores/number-format";
import { useFormatDate, useFormatNumber } from "../../utils/format";
import { ListSkeleton, ErrorState } from "../../components/ui/Skeleton";
import { handleAsyncError, logError } from "../../utils/errors";
import {
  fetchHoldingValuesForAccounts,
  type HoldingValueMap,
} from "../../utils/market-values";
import {
  computeGoalProgress,
  type GoalProgress,
  type GoalStatus,
  type ProgressLink,
} from "../../utils/goal-progress";
import { goalColorClasses } from "./goal-colors";
import GoalModal from "./GoalModal";
import "../../styles/Dashboard.css";

const STATUS_CLASS: Record<GoalStatus, string> = {
  reached:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  on_track:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  behind: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  projected: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  unscheduled:
    "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

function sourceLabel(
  link: ProgressLink,
  accounts: Account[],
  missingLabel: string,
  allAccountsLabel: string,
): string {
  if (link.sourceType === "account") {
    const account = accounts.find((item) => Number(item.id) === link.accountId);
    return account?.name ?? missingLabel;
  }
  const ticker = link.ticker ?? missingLabel;
  if (link.accountId == null) return `${ticker} · ${allAccountsLabel}`;
  const account = accounts.find((item) => Number(item.id) === link.accountId);
  return account ? `${ticker} · ${account.name}` : ticker;
}

export default function GoalsView() {
  const { t } = useTranslation();
  const { currency: appCurrency } = useNumberFormat();
  const formatNumber = useFormatNumber();
  const formatDate = useFormatDate();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [holdingValues, setHoldingValues] = useState<HoldingValueMap>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const money = useCallback(
    (value: number) =>
      formatNumber(value, { style: "currency", currency: appCurrency }),
    [appCurrency, formatNumber],
  );

  const load = useCallback(
    async (mode: "page" | "refresh" = "refresh") => {
      try {
        const [goalRows, accountRows] = await Promise.all([
          rust.get_goals({ targetCurrency: appCurrency || "USD" }),
          rust.get_accounts({ targetCurrency: appCurrency || "USD" }),
        ]);
        let values: HoldingValueMap = {};
        try {
          values = await fetchHoldingValuesForAccounts(
            accountRows,
            appCurrency || "USD",
          );
        } catch (error) {
          logError("Failed to fetch holding values for goals", error);
        }
        setGoals(goalRows);
        setAccounts(accountRows);
        setHoldingValues(values);
        setFetchError(null);
      } catch (error) {
        if (mode === "page") {
          handleAsyncError({
            context: "Failed to fetch goals",
            error,
            setError: setFetchError,
            detailFallback: t("error.failed_to_load"),
          });
        } else {
          handleAsyncError({
            context: "Failed to fetch goals",
            error,
            userMessage: t("error.failed_to_load"),
            toast: (message) => {
              showToast(message, { type: "error" });
            },
          });
        }
      }
    },
    [appCurrency, showToast, t],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load("page");
      setLoading(false);
    })();
  }, [load]);

  const progressById = useMemo(() => {
    const map = new Map<number, GoalProgress>();
    for (const goal of goals) {
      map.set(
        goal.id,
        computeGoalProgress({
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
        }),
      );
    }
    return map;
  }, [accounts, goals, holdingValues]);

  const activeGoals = goals.filter((goal) => !goal.archived);
  const visibleGoals = showArchived ? goals : activeGoals;
  const hasArchived = goals.some((goal) => goal.archived);
  const funded = activeGoals.reduce(
    (sum, goal) => sum + (progressById.get(goal.id)?.current ?? 0),
    0,
  );
  const onTrack = activeGoals.filter((goal) => {
    const status = progressById.get(goal.id)?.status;
    return status === "on_track" || status === "reached";
  }).length;

  async function handleDelete(goal: Goal) {
    const confirmed = await confirm(
      t("goals.confirm_delete", { name: goal.name }),
      { kind: "warning", okLabel: t("confirm.delete") },
    );
    if (!confirmed) return;
    try {
      await rust.delete_goal({ id: goal.id });
      showToast(t("goals.deleted"), { type: "success" });
      await load();
    } catch (error) {
      handleAsyncError({
        context: "Failed to delete goal",
        error,
        userMessage: t("error.failed_to_save"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  async function handleArchive(goal: Goal, archived: boolean) {
    try {
      await rust.update_goal({
        id: goal.id,
        archived,
        name: goal.name,
        targetAmount: goal.target_amount,
        currency: goal.currency ?? null,
        targetDate: goal.target_date ?? null,
        monthlyContribution: goal.monthly_contribution ?? null,
        notes: goal.notes ?? null,
        color: goal.color,
        links: goal.links.map((link) => ({
          sourceType: link.source_type,
          accountId: link.account_id ?? null,
          ticker: link.ticker ?? null,
          allocationPercent: link.allocation_percent,
        })),
      });
      showToast(t(archived ? "goals.archived" : "goals.restored"), {
        type: "success",
      });
      await load();
    } catch (error) {
      handleAsyncError({
        context: "Failed to update goal",
        error,
        userMessage: t("error.failed_to_save"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  if (loading) return <ListSkeleton />;
  if (fetchError) {
    return (
      <ErrorState
        title={t("error.operation_failed")}
        message={fetchError}
        onRetry={() => {
          setFetchError(null);
          setLoading(true);
          void load("page").finally(() => {
            setLoading(false);
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {t("goals.title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("goals.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasArchived && (
            <button
              type="button"
              onClick={() => {
                setShowArchived((value) => !value);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              {showArchived
                ? t("goals.hide_archived")
                : t("goals.show_archived")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingGoal(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm transition-colors font-medium text-sm cursor-pointer"
          >
            <Plus size={16} />
            {t("goals.add")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("goals.summary.active")}
          </p>
          <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {activeGoals.length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("goals.summary.funded")}
          </p>
          <p className="text-2xl font-semibold text-brand-600 dark:text-brand-400">
            {money(funded)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("goals.summary.on_track")}
          </p>
          <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {onTrack}
          </p>
        </div>
      </div>

      {visibleGoals.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-lg">
            {goals.length === 0 ? t("goals.empty") : t("goals.empty_active")}
          </p>
          <p className="text-sm mt-1">
            {goals.length === 0
              ? t("goals.empty_hint")
              : t("goals.empty_active_hint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGoals.map((goal) => {
            const progress = progressById.get(goal.id);
            if (!progress) return null;
            const colors = goalColorClasses(goal.color);
            const expanded = expandedIds.has(goal.id);
            const percentLabel = `${String(Math.round(progress.percent))}%`;
            return (
              <div
                key={goal.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${
                  goal.archived ? "opacity-70" : ""
                }`}
              >
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${colors.dot}`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {goal.name}
                        </h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASS[progress.status]}`}
                        >
                          {t(`goals.status.${progress.status}`)}
                        </span>
                        {goal.archived && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                            {t("goals.archived_badge")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {money(progress.current)} {t("goals.of")}{" "}
                        {money(progress.target)}
                        {goal.target_date
                          ? ` · ${formatDate(goal.target_date)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGoal(goal);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={t("goals.edit")}
                        aria-label={t("goals.edit")}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleArchive(goal, !goal.archived);
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={
                          goal.archived
                            ? t("goals.restore")
                            : t("goals.archive")
                        }
                        aria-label={
                          goal.archived
                            ? t("goals.restore")
                            : t("goals.archive")
                        }
                      >
                        {goal.archived ? (
                          <ArchiveRestore size={15} />
                        ) : (
                          <Archive size={15} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(goal);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={t("goals.delete")}
                        aria-label={t("goals.delete")}
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedIds((current) => {
                            const next = new Set(current);
                            if (next.has(goal.id)) next.delete(goal.id);
                            else next.add(goal.id);
                            return next;
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={
                          expanded
                            ? t("goals.hide_sources")
                            : t("goals.show_sources")
                        }
                        aria-label={
                          expanded
                            ? t("goals.hide_sources")
                            : t("goals.show_sources")
                        }
                      >
                        {expanded ? (
                          <ChevronUp size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.min(
                        100,
                        Math.round(progress.percent),
                      )}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={goal.name}
                    >
                      <div
                        className={`h-full rounded-full ${colors.bar}`}
                        style={{
                          width: `${String(Math.min(progress.percent, 100))}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 w-12 text-right">
                      {percentLabel}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {progress.status === "reached"
                      ? t("goals.reached_detail")
                      : t("goals.remaining", {
                          amount: money(progress.remaining),
                        })}
                    {progress.requiredMonthly != null
                      ? ` · ${t("goals.required_monthly", { amount: money(progress.requiredMonthly) })}`
                      : ""}
                    {progress.projectedDate
                      ? ` · ${t("goals.projected_date", { date: formatDate(progress.projectedDate) })}`
                      : ""}
                  </p>
                  {progress.hasOverlap && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {t("goals.overlap_warning")}
                    </p>
                  )}
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3">
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                      {t("goals.sources")}
                    </h4>
                    {progress.contributions.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        {t("goals.no_sources")}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {progress.contributions.map((item, index) => {
                          const label = sourceLabel(
                            item.link,
                            accounts,
                            t("goals.missing_source"),
                            t("goals.link.all_accounts"),
                          );
                          const allocation =
                            item.link.allocationPercent === 100
                              ? ""
                              : ` · ${String(item.link.allocationPercent)}%`;
                          return (
                            <div
                              key={`${item.link.sourceType}-${String(item.link.accountId ?? "all")}-${item.link.ticker ?? ""}-${String(index)}`}
                              className="flex items-center justify-between text-sm py-1"
                            >
                              <span className="text-slate-700 dark:text-slate-200">
                                {label}
                                {allocation}
                                {item.missing
                                  ? ` · ${t("goals.missing_source")}`
                                  : ""}
                              </span>
                              <span className="font-medium text-slate-800 dark:text-slate-100">
                                {money(item.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <GoalModal
          goal={editingGoal}
          accounts={accounts}
          holdingValues={holdingValues}
          onClose={() => {
            setShowModal(false);
            setEditingGoal(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditingGoal(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
