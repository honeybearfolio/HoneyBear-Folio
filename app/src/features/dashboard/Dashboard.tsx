import { useState } from "react";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import "../../styles/Dashboard.css";
import { useFormatNumber, useFormatDate } from "../../utils/format";
import { useNumberFormat } from "../../stores/number-format";
import { useConfirm } from "../../stores/confirm";
import { useDashboardPreferencesStore } from "../../stores/dashboard-preferences";
import { DashboardSkeleton, ErrorState } from "../../components/ui/Skeleton";
import { useTranslation } from "react-i18next";
import useIsDark from "../../hooks/useIsDark";
import useChartColors from "../../hooks/useChartColors";
import TimeRangeSelector from "./TimeRangeSelector";
import AccountFilterPopover from "./AccountFilterPopover";
import DashboardGrid from "./DashboardGrid";
import { registerDashboardCharts } from "./dashboard-chart-config";
import type { DashboardProps } from "./dashboard-types";
import { useDashboardFetch } from "./useDashboardFetch";
import { useDashboardFilters } from "./useDashboardFilters";
import { useDashboardSummaries } from "./useDashboardSummaries";
import { useDashboardCharts } from "./useDashboardCharts";

registerDashboardCharts();

export default function Dashboard({
  accounts: propAccounts = [],
  marketValues = {},
  totalAssetsValue = 0,
  totalLiabilitiesValue = 0,
}: DashboardProps) {
  const { t } = useTranslation();
  const isDark = useIsDark();
  const chartColors = useChartColors();
  const formatNumber = useFormatNumber();
  const formatDate = useFormatDate();
  const confirm = useConfirm();
  const resetLayout = useDashboardPreferencesStore(
    (state) => state.resetLayout,
  );
  const [editing, setEditing] = useState(false);
  const {
    dateFormat,
    firstDayOfWeek,
    currency: appCurrency,
    locale,
  } = useNumberFormat();

  const {
    accounts,
    transactions,
    loading,
    error,
    quotes,
    dailyPrices,
    getPrice,
    accountMap,
    retryFetch,
  } = useDashboardFetch({ propAccounts, appCurrency, t });

  const {
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
  } = useDashboardFilters({
    accounts,
    transactions,
    marketValues,
  });

  const { currentNetWorth, doughnutData } = useDashboardSummaries({
    filteredAccounts,
    filteredTransactions,
    filteredMarketValues,
    totalAssetsValue,
    totalLiabilitiesValue,
    quotes,
    dailyPrices,
    isDark,
    chartColors,
    t,
  });

  const {
    chartData,
    expensesByCategoryData,
    incomeVsExpensesData,
    doughnutOptions,
    expensesOptions,
    barOptions,
    lineOptions,
  } = useDashboardCharts({
    filteredAccounts,
    filteredTransactions,
    accountMap,
    timeRange,
    customStartDate,
    customEndDate,
    formatDate,
    formatNumber,
    locale,
    appCurrency,
    getPrice,
    isDark,
    chartColors,
    currentNetWorth,
    t,
  });

  async function handleResetLayout() {
    const confirmed = await confirm(t("dashboard.reset_layout_confirm"), {
      kind: "warning",
    });
    if (!confirmed) return;
    resetLayout();
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="page-container dashboard-container">
        <div className="hb-header-container">
          <div>
            <h2 className="hb-header-title">{t("nav.dashboard")}</h2>
            <p className="hb-header-subtitle">
              {t("dashboard.subtitle.overview")}
            </p>
          </div>
        </div>
        <ErrorState
          title={t("error.failed_to_load")}
          message={error}
          onRetry={retryFetch}
          retryLabel={t("error.retry")}
        />
      </div>
    );
  }

  return (
    <div className="page-container dashboard-container">
      <div className="hb-header-container">
        <div>
          <h2 className="hb-header-title">{t("nav.dashboard")}</h2>
          <p className="hb-header-subtitle">
            {t("dashboard.subtitle.overview")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 min-w-0 flex-shrink">
          <TimeRangeSelector
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            setCustomStartDate={setCustomStartDate}
            setCustomEndDate={setCustomEndDate}
            dateFormat={dateFormat}
            firstDayOfWeek={firstDayOfWeek}
          />

          <AccountFilterPopover
            accounts={accounts}
            toggledAccounts={toggledAccounts}
            selectedAccountIds={selectedAccountIds}
            toggleAccountVisibility={toggleAccountVisibility}
            setAllAccountsVisibility={setAllAccountsVisibility}
            marketValues={marketValues}
            appCurrency={appCurrency}
            {...(chartData?.datasets
              ? { chartDatasets: chartData.datasets }
              : {})}
          />

          {editing && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void handleResetLayout();
              }}
            >
              {t("dashboard.reset_layout")}
            </button>
          )}
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border shadow-sm ${
              editing
                ? "bg-slate-900 dark:bg-brand-600 text-white border-transparent"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
            aria-pressed={editing}
            onClick={() => {
              setEditing((current) => !current);
            }}
          >
            {editing ? t("dashboard.done") : t("dashboard.customize")}
          </button>
        </div>
      </div>

      <DashboardGrid
        editing={editing}
        hasTransactions={filteredTransactions.length > 0}
        onEnterEdit={() => {
          setEditing(true);
        }}
        netWorth={currentNetWorth}
        totalAccounts={filteredAccounts.length}
        totalTransactions={filteredTransactions.length}
        netWorthChart={{ chartData, options: lineOptions }}
        incomeChart={{ incomeVsExpensesData, barOptions }}
        allocationChart={{ doughnutData, doughnutOptions }}
        expensesChart={{ expensesByCategoryData, expensesOptions }}
        sankey={{
          transactions: filteredTransactions,
          timeRange,
          customStartDate,
          customEndDate,
          accountMap,
          getPrice,
          appCurrency,
        }}
      />
    </div>
  );
}
