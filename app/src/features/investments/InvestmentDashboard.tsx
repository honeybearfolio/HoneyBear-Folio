import { useState, useEffect, useMemo } from "react";
import { rust } from "../../api/tauri-client";
import type { StockQuote, Transaction } from "../../api/types";
import { RefreshCw } from "lucide-react";
import { useFormatNumber } from "../../utils/format";
import MaskedNumber from "../../components/ui/MaskedNumber";
import { ErrorState } from "../../components/ui/Skeleton";
import {
  buildHoldingsFromTransactions,
  mergeHoldingsWithQuotes,
} from "../../utils/investments";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useTranslation } from "react-i18next";

ChartJS.register(ArcElement, Tooltip, Legend);

// useIsDark moved to a shared hook at src/hooks/useIsDark.js
import useIsDark from "../../hooks/useIsDark";
import useChartColors from "../../hooks/useChartColors";

interface Holding {
  ticker: string;
  shares: number;
  costBasis: number;
  price: number;
  currentValue: number;
  currentPrice?: number;
  roi: number;
  changePercent?: number;
  quoteType?: string | null;
}

interface TreeMapItem {
  ticker: string;
  currentValue: number;
  roi: number;
}

interface TreeMapProps {
  items: TreeMapItem[];
  totalValue: number;
  isDark?: boolean;
}

interface TreeMapNodeProps {
  items: TreeMapItem[];
  x: number;
  y: number;
  w: number;
  h: number;
  totalValue: number;
  isDark?: boolean;
}

export default function InvestmentDashboard() {
  const { t } = useTranslation();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDark = useIsDark();
  const chartColors = useChartColors();

  const formatNumber = useFormatNumber();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const transactions = (await rust.get_all_transactions()) as Transaction[];
      const { currentHoldings } =
        await buildHoldingsFromTransactions(transactions);

      if (currentHoldings.length === 0) {
        setHoldings([]);
        setLoading(false);
        return;
      }

      const tickers = currentHoldings.map((h) => h.ticker);
      const quotes = (await rust.get_stock_quotes({
        tickers,
      })) as StockQuote[];

      const finalHoldings = await mergeHoldingsWithQuotes(
        currentHoldings,
        quotes,
      );
      setHoldings(finalHoldings as Holding[]);
    } catch (e: unknown) {
      console.error("Error fetching investment data:", e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  const allocationData = useMemo(() => {
    if (holdings.length === 0) return null;

    const rawData = holdings.map((h) => h.currentValue);
    const data = rawData.map((v) => Math.abs(v));

    const colors = chartColors.palette;

    return {
      labels: holdings.map((h) => h.ticker),
      datasets: [
        {
          data: data,
          originalData: rawData,
          backgroundColor: rawData.map((v, i) => {
            if (v < 0) return "transparent";
            return colors[i % colors.length];
          }),
          borderColor: isDark ? "#474240" : "#ffffff",
          borderWidth: 4,
          borderDash: (ctx: { dataIndex: number }) => {
            const val = rawData[ctx.dataIndex];
            return val < 0 ? [5, 5] : [];
          },
          hoverOffset: 4,
        },
      ],
    };
  }, [holdings, isDark, chartColors]);

  const chartOptions: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      borderRadius: 4,
      plugins: {
        legend: {
          position: "right" as const,
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            padding: 20,
            color: chartColors.text,
            font: {
              family: "Inter",
              size: 12,
            },
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.tooltipText,
          bodyColor: chartColors.tooltipText,
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: "Inter", size: 13 },
          bodyFont: { family: "Inter", size: 12 },
          callbacks: {
            label: function (context: TooltipItem<"doughnut">) {
              const prefix = context.label ? context.label + ": " : "";
              const dataset = context.dataset as typeof context.dataset & {
                originalData?: number[];
              };
              const value = dataset.originalData
                ? dataset.originalData[context.dataIndex]
                : (context.raw ?? 0);
              return (
                prefix +
                formatNumber(Number(value) || 0, {
                  style: "currency",
                  ignorePrivacy: true,
                })
              );
            },
            labelColor: function (context: TooltipItem<"doughnut">) {
              const dataset = context.dataset;
              const index = context.dataIndex;
              const tooltipBg = chartColors.tooltipBg;
              const bg =
                Array.isArray(dataset.backgroundColor) &&
                dataset.backgroundColor[index] !== undefined
                  ? dataset.backgroundColor[index]
                  : dataset.backgroundColor;
              const border =
                Array.isArray(dataset.borderColor) &&
                dataset.borderColor[index] !== undefined
                  ? dataset.borderColor[index]
                  : dataset.borderColor;
              // If the slice has a transparent background (negative sector), use tooltip bg so it blends in
              const backgroundColor =
                bg === "transparent" || bg === "rgba(0, 0, 0, 0)"
                  ? tooltipBg
                  : bg;
              return {
                borderColor: String(border),
                backgroundColor: String(backgroundColor),
                borderWidth: 2,
              };
            },
          },
        },
      },
    }),
    [formatNumber, chartColors],
  );

  return (
    <div className="page-container investment-dashboard-container">
      <div className="hb-header-container">
        <div>
          <h2 className="hb-header-title">{t("investment.title")}</h2>
          <p className="hb-header-subtitle">{t("investment.subtitle")}</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-xl transition-all duration-200 shadow-sm border border-transparent hover:border-brand-100 dark:hover:border-brand-800"
          title={t("investment.refresh_data")}
          aria-label={t("investment.refresh_data")}
        >
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-brand-200 dark:border-brand-800 border-t-brand-600 dark:border-t-brand-400 rounded-full animate-spin"></div>
            <span className="text-slate-600 dark:text-slate-300 font-medium text-lg">
              {t("investment.loading_investments")}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-sm">
              {t("investment.fetching_prices")}
            </span>
          </div>
        </div>
      ) : error ? (
        <ErrorState
          title={t("investment.error_loading")}
          message={error}
          onRetry={fetchData}
          retryLabel={t("error.retry")}
        />
      ) : holdings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-16">
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
            {t("investment.no_investments_title")}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {t("investment.no_investments_body")}
          </p>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col justify-center transition-all duration-300">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {t("investment.summary.total_portfolio_value")}
              </h3>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                <MaskedNumber
                  value={totalValue}
                  options={{ style: "currency" }}
                />
              </p>
            </div>
            <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col justify-center transition-all duration-300">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {t("investment.summary.top_performer")}
              </h3>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate tracking-tight">
                {
                  holdings.reduce((prev, current) =>
                    prev.roi > current.roi ? prev : current,
                  ).ticker
                }
                <span className="text-sm font-medium ml-2 text-slate-500 dark:text-slate-400">
                  (
                  <MaskedNumber
                    value={
                      holdings.reduce((prev, current) =>
                        prev.roi > current.roi ? prev : current,
                      ).roi
                    }
                    options={{
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }}
                  />
                  %)
                </span>
              </p>
            </div>
            <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col justify-center transition-all duration-300">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {t("investment.summary.total_holdings")}
              </h3>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {holdings.length}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Portfolio Allocation */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">
                  {t("investment.portfolio_allocation")}
                </h3>
                <p className="chart-subtitle">
                  {t("investment.allocation_by_ticker")}
                </p>
              </div>
              <div className="chart-body">
                {allocationData ? (
                  <Doughnut options={chartOptions} data={allocationData} />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 border-4 border-brand-200 dark:border-brand-800 border-t-brand-600 dark:border-t-brand-400 rounded-full animate-spin"></div>
                      <span className="text-slate-400 dark:text-slate-500 font-medium">
                        {t("loading.loading_data")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TreeMap */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col h-[400px] hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
                {t("investment.heatmap.title")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {t("investment.heatmap.description")}
              </p>
              <div className="flex-1 min-h-0 border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden relative shadow-inner">
                <TreeMap
                  items={holdings}
                  totalValue={totalValue}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>

          {/* Holdings Table */}
          <div className="bg-white dark:bg-slate-800 p-0 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden h-full max-h-[600px] hover:shadow-lg transition-shadow duration-300">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                {t("investment.holdings.title")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("investment.holdings.description")}
              </p>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                      {t("import.field.ticker")}
                    </th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400 text-right text-xs uppercase tracking-wider">
                      {t("investment.table.value")}
                    </th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400 text-right text-xs uppercase tracking-wider">
                      {t("investment.table.roi")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {holdings.map((h) => (
                    <tr
                      key={h.ticker}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {h.ticker}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          <MaskedNumber
                            value={h.shares}
                            options={{
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }}
                          />{" "}
                          {t("investment.table.shares_at")}{" "}
                          <MaskedNumber
                            value={h.price}
                            options={{
                              style: "currency",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          <MaskedNumber
                            value={h.currentValue}
                            options={{
                              style: "currency",
                              maximumFractionDigits: 0,
                            }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {t("investment.table.cost")}{" "}
                          <MaskedNumber
                            value={h.costBasis}
                            options={{
                              style: "currency",
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg font-semibold text-sm ${
                            h.roi >= 0
                              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          {h.roi > 0 ? "+" : ""}
                          <MaskedNumber
                            value={h.roi}
                            options={{
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }}
                          />
                          %
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TreeMap({ items, totalValue, isDark }: TreeMapProps) {
  // Recursive binary split treemap
  return (
    <div className="w-full h-full relative">
      <TreeMapNode
        items={items}
        x={0}
        y={0}
        w={100}
        h={100}
        totalValue={totalValue}
        isDark={isDark}
      />
    </div>
  );
}

function TreeMapNode({
  items,
  x,
  y,
  w,
  h,
  totalValue,
  isDark,
}: TreeMapNodeProps) {
  const formatNumber = useFormatNumber();

  if (items.length === 0) return null;

  if (items.length === 1) {
    const item = items[0];
    // Color based on ROI
    // Green for positive, Red for negative. Intensity based on magnitude?
    // Let's use simple thresholds or a gradient.
    // ROI -20% to +20% mapped to color.
    const roi = item.roi;
    let bgColor;
    // Cap intensity at 30% ROI
    const intensity = Math.min(Math.abs(roi) / 30, 1);

    if (roi >= 0) {
      // Emerald
      if (isDark) {
        // Dark Mode: 0% -> Dark (20%), High% -> Vibrant (50%)
        const lightness = 20 + intensity * 30;
        bgColor = `hsl(160, 84%, ${lightness}%)`;
      } else {
        // Light Mode: 0% -> Very Light (95%), High% -> Dark (40%)
        const lightness = 95 - intensity * 55;
        bgColor = `hsl(160, 84%, ${lightness}%)`;
      }
    } else {
      // Rose
      if (isDark) {
        // Dark Mode: 0% -> Dark (15%), High% -> Vibrant (50%)
        const lightness = 15 + intensity * 35;
        bgColor = `hsl(343, 87%, ${lightness}%)`;
      } else {
        // Light Mode: 0% -> Very Light (95%), High% -> Dark (50%)
        const lightness = 95 - intensity * 45;
        bgColor = `hsl(343, 87%, ${lightness}%)`;
      }
    }

    // Determine text color based on theme and intensity
    let textColor;
    if (isDark) {
      // In dark mode, white text works well on both dark (low ROI) and vibrant (high ROI) backgrounds
      textColor = "rgb(241, 245, 249)"; // slate-100
    } else {
      // In light mode, switch to white text when background becomes dark enough
      textColor = intensity > 0.5 ? "white" : "rgb(30, 41, 59)"; // slate-800
    }

    return (
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: `${w}%`,
          height: `${h}%`,
          backgroundColor: bgColor,
          border: isDark ? "1px solid rgb(30, 41, 59)" : "1px solid white",
          overflow: "hidden",
        }}
        className="flex flex-col items-center justify-center p-1 text-xs text-center transition-all hover:opacity-90 hover:z-10 hover:scale-[1.02] cursor-pointer"
        title={`${item.ticker}: ${formatNumber(item.currentValue, { style: "currency" })} (${formatNumber(item.roi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)`}
      >
        <span className="font-bold" style={{ color: textColor }}>
          {item.ticker}
        </span>
        <span className="hidden sm:inline" style={{ color: textColor }}>
          <MaskedNumber
            value={item.roi}
            options={{
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }}
          />
          %
        </span>
      </div>
    );
  }

  // Split items into two groups
  const halfValue = items.reduce((sum, i) => sum + i.currentValue, 0) / 2;
  let currentSum = 0;
  let splitIndex = 0;

  for (let i = 0; i < items.length; i++) {
    if (currentSum + items[i].currentValue > halfValue && i > 0) {
      // Check if adding this item makes it closer or further from half
      const diffWith = Math.abs(currentSum + items[i].currentValue - halfValue);
      const diffWithout = Math.abs(currentSum - halfValue);
      if (diffWith < diffWithout) {
        splitIndex = i + 1;
      } else {
        splitIndex = i;
      }
      break;
    }
    currentSum += items[i].currentValue;
    splitIndex = i + 1;
  }

  const groupA = items.slice(0, splitIndex);
  const groupB = items.slice(splitIndex);

  const valueA = groupA.reduce((sum, i) => sum + i.currentValue, 0);
  const valueB = groupB.reduce((sum, i) => sum + i.currentValue, 0);
  const total = valueA + valueB; // Should match sum of items

  // Split direction: Split along the longer axis
  const isVerticalSplit = w > h; // If width is larger, split vertically (left/right)

  let wA, hA, xB, yB, wB, hB;

  if (isVerticalSplit) {
    wA = (valueA / total) * w;
    hA = h;
    xB = x + wA;
    yB = y;
    wB = w - wA;
    hB = h;
  } else {
    wA = w;
    hA = (valueA / total) * h;
    xB = x;
    yB = y + hA;
    wB = w;
    hB = h - hA;
  }

  return (
    <>
      <TreeMapNode
        items={groupA}
        x={x}
        y={y}
        w={wA}
        h={hA}
        totalValue={totalValue}
        isDark={isDark}
      />
      <TreeMapNode
        items={groupB}
        x={xB}
        y={yB}
        w={wB}
        h={hB}
        totalValue={totalValue}
        isDark={isDark}
      />
    </>
  );
}
