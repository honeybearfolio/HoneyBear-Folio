import type { ChartOptions, ChartData } from "chart.js";
import { Line } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import ChartLoadingState from "./ChartLoadingState";

interface NetWorthChartProps {
  chartData: ChartData<"line"> | null;
  options: ChartOptions<"line">;
}

export default function NetWorthChart({
  chartData,
  options,
}: NetWorthChartProps) {
  const { t } = useTranslation();

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">{t("dashboard.networth_evolution")}</h3>
        <p className="chart-subtitle">
          {t("dashboard.subtitle.networth_growth")}
        </p>
      </div>
      <div className="chart-wrapper">
        <div className="chart-body">
          {chartData ? (
            <Line options={options} data={chartData} />
          ) : (
            <ChartLoadingState />
          )}
        </div>
      </div>
    </div>
  );
}
