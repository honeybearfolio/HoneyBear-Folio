import {
  useRef,
  type ComponentProps,
  type DragEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import MaskedNumber from "../../components/ui/MaskedNumber";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";
import AssetAllocationChart from "./AssetAllocationChart";
import DashboardWidgetFrame from "./DashboardWidgetFrame";
import ExpensesByCategoryChart from "./ExpensesByCategoryChart";
import IncomeVsExpensesChart from "./IncomeVsExpensesChart";
import NetWorthChart from "./NetWorthChart";
import SankeyDiagram from "./SankeyDiagram";
import { SummaryCard } from "./SummaryCards";
import {
  dashboardSpanClass,
  isSummaryWidget,
  type ChartSpan,
  type DashboardWidgetConfig,
  type DashboardWidgetId,
} from "./dashboard-layout";

interface DashboardGridProps {
  editing: boolean;
  hasTransactions: boolean;
  onEnterEdit: () => void;
  netWorth: number;
  totalAccounts: number;
  totalTransactions: number;
  netWorthChart: ComponentProps<typeof NetWorthChart>;
  incomeChart: ComponentProps<typeof IncomeVsExpensesChart>;
  allocationChart: ComponentProps<typeof AssetAllocationChart>;
  expensesChart: ComponentProps<typeof ExpensesByCategoryChart>;
  sankey: ComponentProps<typeof SankeyDiagram>;
}

function widgetLabel(
  id: DashboardWidgetId,
  t: (key: string) => string,
): string {
  switch (id) {
    case "summaryNetWorth":
      return t("dashboard.current_net_worth");
    case "summaryAccounts":
      return t("dashboard.total_accounts");
    case "summaryTransactions":
      return t("dashboard.total_transactions");
    case "netWorth":
      return t("dashboard.networth_evolution");
    case "incomeVsExpenses":
      return t("dashboard.income_vs_expenses");
    case "cashFlow":
      return t("dashboard.cash_flow");
    case "assetAllocation":
      return t("dashboard.asset_allocation");
    case "expensesByCategory":
      return t("dashboard.expenses_by_category");
  }
}

function widgetSubtitle(
  id: DashboardWidgetId,
  t: (key: string) => string,
): string {
  switch (id) {
    case "netWorth":
      return t("dashboard.subtitle.networth_growth");
    case "incomeVsExpenses":
      return t("dashboard.subtitle.monthly_income_vs_expenses");
    case "cashFlow":
      return t("dashboard.subtitle.income_and_expense_flow");
    case "assetAllocation":
      return t("dashboard.subtitle.distribution_of_assets");
    case "expensesByCategory":
      return t("dashboard.subtitle.where_your_money_goes");
    default:
      return "";
  }
}

function EmptyTransactions() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-16">
      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-2xl mb-4">
        <svg
          className="w-16 h-16 text-slate-300 dark:text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
        {t("account.no_transactions_found")}
      </p>
      <p className="text-sm text-slate-400 dark:text-slate-500">
        {t("dashboard.no_transactions_body")}
      </p>
    </div>
  );
}

function ChartPlaceholder({
  title,
  subtitle,
  tall,
}: {
  title: string;
  subtitle: string;
  tall: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="chart-card" style={tall ? { height: "500px" } : undefined}>
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        {subtitle ? <p className="chart-subtitle">{subtitle}</p> : null}
      </div>
      <div className="chart-body flex items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center px-4">
          {t("dashboard.no_transactions_body")}
        </p>
      </div>
    </div>
  );
}

function CashFlowChart({
  span,
  sankey,
}: {
  span: ChartSpan;
  sankey: ComponentProps<typeof SankeyDiagram>;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="chart-card"
      style={span === "full" ? { height: "500px" } : undefined}
    >
      <div className="chart-header">
        <h3 className="chart-title">{t("dashboard.cash_flow")}</h3>
        <p className="chart-subtitle">
          {t("dashboard.subtitle.income_and_expense_flow")}
        </p>
      </div>
      <div className="chart-body">
        <SankeyDiagram {...sankey} />
      </div>
    </div>
  );
}

function AllWidgetsHidden({ onCustomize }: { onCustomize: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {t("dashboard.all_widgets_hidden")}
      </p>
      <button type="button" className="btn-primary" onClick={onCustomize}>
        {t("dashboard.customize")}
      </button>
    </div>
  );
}

export default function DashboardGrid({
  editing,
  hasTransactions,
  onEnterEdit,
  netWorth,
  totalAccounts,
  totalTransactions,
  netWorthChart,
  incomeChart,
  allocationChart,
  expensesChart,
  sankey,
}: DashboardGridProps) {
  const { t } = useTranslation();
  const layout = useDashboardPreferencesStore((state) => state.layout);
  const moveWidget = useDashboardPreferencesStore((state) => state.moveWidget);
  const setWidgetVisible = useDashboardPreferencesStore(
    (state) => state.setWidgetVisible,
  );
  const setWidgetSpan = useDashboardPreferencesStore(
    (state) => state.setWidgetSpan,
  );
  const draggingIdRef = useRef<DashboardWidgetId | null>(null);
  const lastReorder = useRef(0);

  const anyVisible = layout.some((widget) => widget.visible);
  if (!editing && !anyVisible) {
    return <AllWidgetsHidden onCustomize={onEnterEdit} />;
  }

  const shown = layout.filter((widget) => editing || widget.visible);
  const showEmptyCharts =
    !editing &&
    !hasTransactions &&
    layout.some((widget) => widget.visible && !isSummaryWidget(widget.id));
  const firstChartIndex = showEmptyCharts
    ? shown.findIndex((widget) => !isSummaryWidget(widget.id))
    : -1;

  const renderWidget = (widget: DashboardWidgetConfig): ReactNode => {
    if (!hasTransactions && !isSummaryWidget(widget.id)) {
      return (
        <ChartPlaceholder
          title={widgetLabel(widget.id, t)}
          subtitle={widgetSubtitle(widget.id, t)}
          tall={widget.id === "cashFlow" && widget.span === "full"}
        />
      );
    }

    switch (widget.id) {
      case "summaryNetWorth":
        return (
          <SummaryCard title={t("dashboard.current_net_worth")}>
            <MaskedNumber value={netWorth} options={{ style: "currency" }} />
          </SummaryCard>
        );
      case "summaryAccounts":
        return (
          <SummaryCard title={t("dashboard.total_accounts")}>
            {totalAccounts}
          </SummaryCard>
        );
      case "summaryTransactions":
        return (
          <SummaryCard title={t("dashboard.total_transactions")}>
            {totalTransactions}
          </SummaryCard>
        );
      case "netWorth":
        return <NetWorthChart {...netWorthChart} />;
      case "incomeVsExpenses":
        return <IncomeVsExpensesChart {...incomeChart} />;
      case "cashFlow":
        return <CashFlowChart span={widget.span} sankey={sankey} />;
      case "assetAllocation":
        return <AssetAllocationChart {...allocationChart} />;
      case "expensesByCategory":
        return <ExpensesByCategoryChart {...expensesChart} />;
    }
  };

  return (
    <div className="dashboard-grid">
      {shown.map((widget, index) => {
        if (showEmptyCharts && !isSummaryWidget(widget.id)) {
          if (index !== firstChartIndex) return null;
          return (
            <div key="dashboard-empty" className="dashboard-span-full">
              <EmptyTransactions />
            </div>
          );
        }

        const title = widgetLabel(widget.id, t);
        const content = (
          <div
            key={`${widget.id}-${widget.span}`}
            className={editing ? "dashboard-widget-editing" : undefined}
          >
            {renderWidget(widget)}
          </div>
        );

        if (!editing) {
          return (
            <div key={widget.id} className={dashboardSpanClass(widget)}>
              {content}
            </div>
          );
        }

        return (
          <DashboardWidgetFrame
            key={widget.id}
            title={title}
            index={index}
            count={shown.length}
            visible={widget.visible}
            span={widget.span}
            isChart={!isSummaryWidget(widget.id)}
            className={dashboardSpanClass(widget)}
            onMove={(toIndex) => {
              moveWidget(widget.id, toIndex);
            }}
            onToggleVisible={() => {
              setWidgetVisible(widget.id, !widget.visible);
            }}
            onSetSpan={(span) => {
              setWidgetSpan(widget.id, span);
            }}
            onDragStart={(event: DragEvent<HTMLElement>) => {
              draggingIdRef.current = widget.id;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", widget.id);
            }}
            onDragEnd={() => {
              draggingIdRef.current = null;
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              const currentId = draggingIdRef.current;
              if (!currentId) return;
              if (event.timeStamp - lastReorder.current < 50) return;
              lastReorder.current = event.timeStamp;
              moveWidget(currentId, index);
            }}
          >
            {content}
          </DashboardWidgetFrame>
        );
      })}
    </div>
  );
}
