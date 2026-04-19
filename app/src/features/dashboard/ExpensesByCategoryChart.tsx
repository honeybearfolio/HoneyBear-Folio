import type { ChartOptions, ChartData } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useTranslation } from "react-i18next";

interface ExpensesByCategoryChartProps {
  expensesByCategoryData: (ChartData<"doughnut"> & { empty?: boolean }) | null;
  expensesOptions: ChartOptions<"doughnut">;
}

export default function ExpensesByCategoryChart({
  expensesByCategoryData,
  expensesOptions,
}: ExpensesByCategoryChartProps) {
  const { t } = useTranslation();

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="chart-title">
          {t("dashboard.expenses_by_category")}
        </h3>
        <p className="chart-subtitle">
          {t("dashboard.subtitle.where_your_money_goes")}
        </p>
      </div>
      <div className="chart-body">
        {expensesByCategoryData === null ? (
          <div className="loading-container">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <span className="loading-text">
                {t("loading.loading_data")}
              </span>
            </div>
          </div>
        ) : expensesByCategoryData.empty ? (
          <div className="col-span-full flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-8">
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl mb-3">
              <svg
                className="w-12 h-12 text-slate-300 dark:text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m4 4v-4m-6 8h6a2 2 0 002-2V7a2 2 0 00-2-2h-6l-2 2v11a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">
              {t("dashboard.no_expenses_title")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {t("dashboard.no_expenses_body")}
            </p>
          </div>
        ) : (
          <Doughnut
            options={expensesOptions}
            data={expensesByCategoryData as ChartData<"doughnut">}
          />
        )}
      </div>
    </div>
  );
}
