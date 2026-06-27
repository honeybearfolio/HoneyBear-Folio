import { Line } from "react-chartjs-2";
import { TrendingUp, Calendar, User, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormatNumber } from "../../utils/format";
import MaskedNumber from "../../components/ui/MaskedNumber";
import useChartColors from "../../hooks/useChartColors";
import type { ChartData } from "chart.js";
import type { MonteCarloResult } from "./fire-types";

interface FireResultsPanelProps {
  fireNumber: number;
  yearsToFire: number | null;
  neverReached: boolean;
  fireAge: number | null;
  monteCarloResult: MonteCarloResult | null;
  chartData: ChartData<"line", number[], string>;
}

export default function FireResultsPanel({
  fireNumber,
  yearsToFire,
  neverReached,
  fireAge,
  monteCarloResult,
  chartData,
}: FireResultsPanelProps) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const chartColors = useChartColors();

  return (
    <div className="lg:col-span-3 space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-900/10 p-5 rounded-2xl shadow-md border-2 border-brand-200 dark:border-brand-800 flex items-center justify-between transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1">
              {t("fire.fire_number")}
            </p>
            <p className="text-2xl font-bold text-brand-900 dark:text-brand-100">
              <MaskedNumber
                value={fireNumber}
                options={{
                  style: "currency",
                  maximumFractionDigits: 0,
                  minimumFractionDigits: 0,
                }}
              />
            </p>
          </div>
          <div className="bg-brand-500 dark:bg-brand-600 p-3 rounded-xl shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-900/10 p-5 rounded-2xl shadow-md border-2 border-brand-200 dark:border-brand-800 flex items-center justify-between transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1">
              {t("fire.time_to_fire")}
            </p>
            {neverReached ? (
              <p className="text-lg font-medium text-brand-900 dark:text-brand-100">
                {t("fire.never_retire")}
              </p>
            ) : (
              <p className="text-2xl font-bold text-brand-900 dark:text-brand-100">
                {yearsToFire} {t("fire.years")}
              </p>
            )}
          </div>
          <div className="bg-brand-500 dark:bg-brand-600 p-3 rounded-xl shadow-lg">
            <Calendar className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-900/10 p-5 rounded-2xl shadow-md border-2 border-brand-200 dark:border-brand-800 flex items-center justify-between transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1">
              {t("fire.retirement_age")}
            </p>
            {neverReached || fireAge === null ? (
              <p className="text-lg font-medium text-brand-900 dark:text-brand-100">
                —
              </p>
            ) : (
              <p className="text-2xl font-bold text-brand-900 dark:text-brand-100">
                {t("fire.age_value", { age: fireAge })}
              </p>
            )}
          </div>
          <div className="bg-brand-500 dark:bg-brand-600 p-3 rounded-xl shadow-lg">
            <User className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-900/10 p-5 rounded-2xl shadow-md border-2 border-brand-200 dark:border-brand-800 flex items-center justify-between transition-all duration-300">
          <div>
            <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1">
              {t("fire.success_rate")}
            </p>
            <p className="text-2xl font-bold text-brand-900 dark:text-brand-100">
              {monteCarloResult
                ? `${monteCarloResult.successRate.toFixed(1)}%`
                : "—"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("fire.monte_carlo")}
            </p>
          </div>
          <div className="bg-brand-500 dark:bg-brand-600 p-3 rounded-xl shadow-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex-1 min-h-[400px] hover:shadow-lg transition-shadow duration-300">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              {t("fire.projection")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("fire.projection_subtitle")}
            </p>
          </div>
          {monteCarloResult && (
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("fire.simulations_run", {
                  count: monteCarloResult.simulationCount,
                })}
              </p>
            </div>
          )}
        </div>
        <div className="h-[350px]">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: "index",
                intersect: false,
              },
              plugins: {
                legend: {
                  position: "top",
                  labels: {
                    color: chartColors.text,
                    filter: (item) => {
                      const hiddenLabels = [
                        t("fire.percentile_10"),
                        t("fire.percentile_25"),
                        t("fire.percentile_75"),
                      ];
                      return !hiddenLabels.includes(item.text);
                    },
                  },
                },
                tooltip: {
                  backgroundColor: chartColors.tooltipBg,
                  titleColor: chartColors.tooltipText,
                  bodyColor: chartColors.tooltipText,
                  padding: 12,
                  cornerRadius: 8,
                  callbacks: {
                    labelColor: function (context) {
                      const dataset = context.dataset;
                      const tooltipBg = chartColors.tooltipBg;

                      return {
                        borderColor: dataset.borderColor as string,
                        backgroundColor: tooltipBg,
                        borderWidth: 2,
                      };
                    },
                    label: function (context) {
                      let label = context.dataset.label || "";
                      if (label) {
                        label += ": ";
                      }

                      const parsedValue =
                        typeof context.parsed === "object" &&
                        "y" in context.parsed
                          ? context.parsed.y
                          : context.parsed;
                      const value =
                        parsedValue ??
                        context.raw ??
                        context.dataset.data[context.dataIndex];

                      if (
                        value !== undefined &&
                        value !== null &&
                        !Number.isNaN(Number(value))
                      ) {
                        label += formatNumber(Number(value), {
                          style: "currency",
                          ignorePrivacy: true,
                        });
                      }

                      return label;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: {
                    color: chartColors.grid,
                  },
                  ticks: {
                    color: chartColors.text,
                    callback: function (value) {
                      const num = Number(value);
                      if (Number.isNaN(num)) return value;
                      return formatNumber(num, {
                        style: "currency",
                      });
                    },
                  },
                },
                x: {
                  grid: {
                    color: chartColors.grid,
                  },
                  ticks: {
                    color: chartColors.text,
                    maxTicksLimit: 10,
                  },
                },
              },
            }}
          />
        </div>

        {/* Chart Legend Explanation */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("fire.chart_legend_explanation")}
          </p>
        </div>
      </div>
    </div>
  );
}
