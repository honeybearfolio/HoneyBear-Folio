import type { ChartOptions, ChartData } from "chart.js";
import { Bar } from "react-chartjs-2";
import { useTranslation } from "react-i18next";

interface IncomeVsExpensesChartProps {
  incomeVsExpensesData: ChartData<"bar"> | null;
  barOptions: ChartOptions<"bar">;
}

export default function IncomeVsExpensesChart({
  incomeVsExpensesData,
  barOptions,
}: IncomeVsExpensesChartProps) {
  const { t } = useTranslation();

  return (
    <div className="chart-card chart-card-full">
      <div className="chart-header">
        <h3 className="chart-title">
          {t("dashboard.income_vs_expenses")}
        </h3>
        <p className="chart-subtitle">
          {t("dashboard.subtitle.monthly_income_vs_expenses")}
        </p>
      </div>
      <div className="chart-body">
        {incomeVsExpensesData ? (
          <Bar options={barOptions} data={incomeVsExpensesData} />
        ) : (
          <div className="loading-container">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <span className="loading-text">
                {t("loading.loading_data")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
