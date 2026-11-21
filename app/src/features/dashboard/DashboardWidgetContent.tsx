import { useTranslation } from "react-i18next";
import MaskedNumber from "../../components/ui/MaskedNumber";
import AssetAllocationChart from "./AssetAllocationChart";
import ExpensesByCategoryChart from "./ExpensesByCategoryChart";
import IncomeVsExpensesChart from "./IncomeVsExpensesChart";
import NetWorthChart from "./NetWorthChart";
import SankeyDiagram from "./SankeyDiagram";
import { SummaryCard } from "./SummaryCards";
import {
  WIDGET_TITLE_KEYS,
  type DashboardWidgetInstance,
} from "./dashboard-layout";
import { useDashboardData, useWidgetData } from "./dashboard-widget-data";

function EmptyCard({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className="chart-card h-full">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
      </div>
      <div className="chart-body flex items-center justify-center text-center">
        <div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">
            {t("account.no_transactions_found")}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 px-4">
            {t("dashboard.no_transactions_body")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardWidgetContent({
  widget,
}: {
  widget: DashboardWidgetInstance;
}) {
  const { t } = useTranslation();
  const shared = useDashboardData();
  const slice = useWidgetData(widget);
  const title = t(WIDGET_TITLE_KEYS[widget.type]);

  if (
    [
      "netWorth",
      "incomeVsExpenses",
      "cashFlow",
      "assetAllocation",
      "expensesByCategory",
    ].includes(widget.type) &&
    !slice.hasTransactions
  ) {
    return <EmptyCard title={title} />;
  }

  switch (widget.type) {
    case "summaryNetWorth":
      return (
        <SummaryCard title={title}>
          <MaskedNumber
            value={slice.netWorth}
            options={{ style: "currency" }}
          />
        </SummaryCard>
      );
    case "summaryAccounts":
      return (
        <SummaryCard title={title}>{slice.selectedAccounts.length}</SummaryCard>
      );
    case "summaryTransactions":
      return (
        <SummaryCard title={title}>{slice.transactions.length}</SummaryCard>
      );
    case "netWorth":
      return (
        <NetWorthChart
          chartData={slice.netWorthChart}
          options={shared.lineOptions}
        />
      );
    case "incomeVsExpenses":
      return (
        <IncomeVsExpensesChart
          incomeVsExpensesData={slice.incomeChart}
          barOptions={shared.barOptions}
        />
      );
    case "cashFlow":
      return (
        <div className="chart-card h-full">
          <div className="chart-header">
            <h3 className="chart-title">{title}</h3>
            <p className="chart-subtitle">
              {t("dashboard.subtitle.income_and_expense_flow")}
            </p>
          </div>
          <div className="chart-body">
            <SankeyDiagram
              transactions={slice.transactions}
              timeRange={slice.range.timeRange}
              customStartDate={slice.range.customStartDate}
              customEndDate={slice.range.customEndDate}
              accountMap={shared.accountMap}
              getPrice={shared.getPrice}
              appCurrency={shared.appCurrency}
            />
          </div>
        </div>
      );
    case "assetAllocation":
      return (
        <AssetAllocationChart
          doughnutData={slice.doughnutData}
          doughnutOptions={shared.doughnutOptions}
        />
      );
    case "expensesByCategory":
      return (
        <ExpensesByCategoryChart
          expensesByCategoryData={slice.expensesChart}
          expensesOptions={shared.expensesOptions}
        />
      );
    case "budgetHealth": {
      const { budget } = shared.insights;
      return (
        <div className="chart-card h-full">
          <div className="chart-header">
            <h3 className="chart-title">{title}</h3>
            <p className="chart-subtitle">{t("dashboard.budget_this_month")}</p>
          </div>
          <div className="chart-body space-y-3">
            {budget.loading ? (
              <p className="text-sm text-slate-500">
                {t("dashboard.loading_insights")}
              </p>
            ) : budget.error ? (
              <p className="text-sm text-rose-600">
                {t("error.failed_to_load")}
              </p>
            ) : budget.totalBudget <= 0 ? (
              <p className="text-sm text-slate-500">
                {t("dashboard.budget_not_set")}
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t("dashboard.budget_spent", {
                    spent: shared.formatNumber(budget.totalSpent, {
                      style: "currency",
                      currency: shared.appCurrency,
                    }),
                    budget: shared.formatNumber(budget.totalBudget, {
                      style: "currency",
                      currency: shared.appCurrency,
                    }),
                  })}
                </p>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                  role="progressbar"
                  aria-label={t("dashboard.budget_health")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(
                    100,
                    (budget.totalSpent / budget.totalBudget) * 100,
                  )}
                >
                  <div
                    className={`h-full rounded-full ${
                      budget.totalSpent > budget.totalBudget
                        ? "bg-rose-500"
                        : "bg-brand-500"
                    }`}
                    style={{
                      width: `${String(
                        Math.min(
                          100,
                          (budget.totalSpent / budget.totalBudget) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
                {budget.totalSpent > budget.totalBudget && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {t("dashboard.budget_total_over", {
                      amount: shared.formatNumber(
                        budget.totalSpent - budget.totalBudget,
                        {
                          style: "currency",
                          currency: shared.appCurrency,
                        },
                      ),
                    })}
                  </p>
                )}
                {budget.overBudget.length > 0 ? (
                  <ul className="space-y-1 text-xs text-rose-600 dark:text-rose-400">
                    {budget.overBudget.slice(0, 3).map((category) => (
                      <li key={category.name}>
                        {t("dashboard.budget_category_over", {
                          category: category.name,
                          amount: shared.formatNumber(
                            category.spent - category.limit,
                            {
                              style: "currency",
                              currency: shared.appCurrency,
                            },
                          ),
                        })}
                      </li>
                    ))}
                  </ul>
                ) : budget.totalSpent <= budget.totalBudget ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {t("dashboard.budget_on_track")}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      );
    }
    case "goalProgress": {
      const { goals } = shared.insights;
      return (
        <div className="chart-card h-full">
          <div className="chart-header">
            <h3 className="chart-title">{title}</h3>
            <p className="chart-subtitle">
              {goals.loading
                ? t("dashboard.loading_insights")
                : t("dashboard.active_goals", { count: goals.items.length })}
            </p>
          </div>
          <div className="chart-body space-y-3">
            {goals.loading ? (
              <p className="text-sm text-slate-500">
                {t("dashboard.loading_insights")}
              </p>
            ) : goals.error ? (
              <p className="text-sm text-rose-600">
                {t("error.failed_to_load")}
              </p>
            ) : goals.items.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("dashboard.goals_not_set")}
              </p>
            ) : (
              goals.items.slice(0, 4).map((goal) => (
                <div key={goal.id}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                      {goal.name}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {shared.formatNumber(goal.percent, {
                        maximumFractionDigits: 0,
                      })}
                      %
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-label={goal.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, goal.percent)}
                  >
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{
                        width: `${String(Math.min(100, goal.percent))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {t(`goals.status.${goal.status}`)} ·{" "}
                    {shared.formatNumber(goal.current, {
                      style: "currency",
                      currency: shared.appCurrency,
                    })}{" "}
                    /{" "}
                    {shared.formatNumber(goal.target, {
                      style: "currency",
                      currency: shared.appCurrency,
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }
    case "upcomingScheduled": {
      const { scheduled } = shared.insights;
      return (
        <div className="chart-card h-full">
          <div className="chart-header">
            <h3 className="chart-title">{title}</h3>
            <p className="chart-subtitle">
              {scheduled.loading
                ? t("dashboard.loading_insights")
                : t("dashboard.scheduled_next_30_days", {
                    count: scheduled.items.length,
                  })}
            </p>
          </div>
          <div className="chart-body">
            {scheduled.loading ? (
              <p className="text-sm text-slate-500">
                {t("dashboard.loading_insights")}
              </p>
            ) : scheduled.error ? (
              <p className="text-sm text-rose-600">
                {t("error.failed_to_load")}
              </p>
            ) : scheduled.items.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("dashboard.no_upcoming_scheduled")}
              </p>
            ) : (
              <ul className="space-y-2">
                {scheduled.items.slice(0, 6).map((item, index) => (
                  <li
                    key={`${String(item.scheduled_tx_id)}-${item.date}-${String(index)}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-700 dark:text-slate-200">
                        {item.payee}
                      </span>
                      <span className="text-slate-500">
                        {item.account_name}
                      </span>
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {shared.formatDate(item.date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
    }
  }
}
