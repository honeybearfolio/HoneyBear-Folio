import type { ChartOptions, ChartData } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import ChartLoadingState from "./ChartLoadingState";

interface AssetAllocationChartProps {
  doughnutData: ChartData<"doughnut"> | null;
  doughnutOptions: ChartOptions<"doughnut">;
}

export default function AssetAllocationChart({
  doughnutData,
  doughnutOptions,
}: AssetAllocationChartProps) {
  const { t } = useTranslation();

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="chart-title">{t("dashboard.asset_allocation")}</h3>
        <p className="chart-subtitle">
          {t("dashboard.subtitle.distribution_of_assets")}
        </p>
      </div>
      <div className="chart-body">
        {doughnutData ? (
          <Doughnut options={doughnutOptions} data={doughnutData} />
        ) : (
          <ChartLoadingState />
        )}
      </div>
    </div>
  );
}
