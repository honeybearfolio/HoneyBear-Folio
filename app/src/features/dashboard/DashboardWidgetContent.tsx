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
  isSummaryWidget,
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

  if (!isSummaryWidget(widget.type) && !slice.hasTransactions) {
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
  }
}
