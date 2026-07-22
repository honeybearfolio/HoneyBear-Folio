import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import "../../styles/Dashboard.css";
import { useFormatNumber, useFormatDate } from "../../utils/format";
import { useNumberFormat } from "../../stores/number-format";
import { DashboardSkeleton, ErrorState } from "../../components/ui/Skeleton";
import { useTranslation } from "react-i18next";
import useIsDark from "../../hooks/useIsDark";
import useChartColors from "../../hooks/useChartColors";
import SankeyDiagram from "./SankeyDiagram";
import TimeRangeSelector from "./TimeRangeSelector";
import AccountFilterPopover from "./AccountFilterPopover";
import SummaryCards from "./SummaryCards";
import NetWorthChart from "./NetWorthChart";
import AssetAllocationChart from "./AssetAllocationChart";
import ExpensesByCategoryChart from "./ExpensesByCategoryChart";
import IncomeVsExpensesChart from "./IncomeVsExpensesChart";
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
    propAccounts,
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
        </div>
      </div>

      <SummaryCards
        netWorth={currentNetWorth}
        totalAccounts={filteredAccounts.length}
        totalTransactions={filteredTransactions.length}
      />

      {filteredTransactions.length === 0 ? null : (
        <NetWorthChart chartData={chartData} options={lineOptions} />
      )}

      <div className="charts-grid">
        {filteredTransactions.length === 0 ? (
          <div className="col-span-full flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-16">
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
        ) : (
          <>
            <IncomeVsExpensesChart
              incomeVsExpensesData={incomeVsExpensesData}
              barOptions={barOptions}
            />

            <div
              className="chart-card chart-card-full"
              style={{ height: "500px" }}
            >
              <div className="chart-header">
                <h3 className="chart-title">{t("dashboard.cash_flow")}</h3>
                <p className="chart-subtitle">
                  {t("dashboard.subtitle.income_and_expense_flow")}
                </p>
              </div>
              <div className="chart-body">
                <SankeyDiagram
                  transactions={filteredTransactions}
                  timeRange={timeRange}
                  customStartDate={customStartDate}
                  customEndDate={customEndDate}
                  accountMap={accountMap}
                  getPrice={getPrice}
                  appCurrency={appCurrency}
                />
              </div>
            </div>

            <AssetAllocationChart
              doughnutData={doughnutData}
              doughnutOptions={doughnutOptions}
            />

            <ExpensesByCategoryChart
              expensesByCategoryData={expensesByCategoryData}
              expensesOptions={expensesOptions}
            />
          </>
        )}
      </div>
    </div>
  );
}
