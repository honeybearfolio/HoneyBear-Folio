import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  BarElement,
} from "chart.js";
import type { ChartOptions, TooltipItem } from "chart.js";
import type { ChartColors } from "../../hooks/useChartColors";
import {
  createChartTooltipLabel,
  createDoughnutSliceTooltipLabel,
  type ChartFormatNumber,
} from "../../utils/chartTooltip";

let chartJsRegistered = false;

export function registerDashboardCharts(): void {
  if (chartJsRegistered) return;
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ArcElement,
    BarElement,
  );
  chartJsRegistered = true;
}

function doughnutLegendLabels(isDark: boolean) {
  return {
    usePointStyle: true as const,
    boxWidth: 8,
    padding: 20,
    color: isDark ? "rgb(148, 163, 184)" : "rgb(100, 116, 139)",
    font: {
      family: "Inter",
      size: 12,
    },
  };
}

function baseTooltipStyle(chartColors: ChartColors) {
  return {
    backgroundColor: chartColors.tooltipBg,
    titleColor: chartColors.tooltipText,
    bodyColor: chartColors.tooltipText,
    padding: 12,
    cornerRadius: 8,
    titleFont: { family: "Inter", size: 13 },
    bodyFont: { family: "Inter", size: 12 },
  };
}

function doughnutLabelColor(
  context: TooltipItem<"doughnut">,
  chartColors: ChartColors,
  borderFallback?: string,
) {
  const dataset = context.dataset;
  const index = context.dataIndex;
  const tooltipBg = chartColors.tooltipBg;

  const bgValue: unknown =
    Array.isArray(dataset.backgroundColor) &&
    dataset.backgroundColor[index] !== undefined
      ? dataset.backgroundColor[index]
      : dataset.backgroundColor;
  const borderValue: unknown =
    Array.isArray(dataset.borderColor) &&
    dataset.borderColor[index] !== undefined
      ? dataset.borderColor[index]
      : dataset.borderColor;
  const bg = typeof bgValue === "string" ? bgValue : "";
  const border =
    typeof borderValue === "string"
      ? borderValue
      : (borderFallback ?? chartColors.grid);

  const backgroundColor =
    bg === "transparent" || bg === "rgba(0, 0, 0, 0)" ? tooltipBg : bg;

  return {
    borderColor: border,
    backgroundColor,
    borderWidth: 2,
  };
}

export function createDoughnutChartOptions(
  isDark: boolean,
  formatNumber: ChartFormatNumber,
  chartColors: ChartColors,
): ChartOptions<"doughnut"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    borderRadius: 4,
    plugins: {
      legend: {
        position: "right" as const,
        labels: doughnutLegendLabels(isDark),
      },
      title: {
        display: false,
      },
      tooltip: {
        ...baseTooltipStyle(chartColors),
        callbacks: {
          label: createDoughnutSliceTooltipLabel(formatNumber),
          labelColor: (context) => doughnutLabelColor(context, chartColors),
        },
      },
    },
  } as ChartOptions<"doughnut">;
}

export function createExpensesDoughnutChartOptions(
  isDark: boolean,
  formatNumber: ChartFormatNumber,
  chartColors: ChartColors,
): ChartOptions<"doughnut"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    borderRadius: 4,
    plugins: {
      legend: {
        position: "right" as const,
        labels: doughnutLegendLabels(isDark),
      },
      title: {
        display: false,
      },
      tooltip: {
        ...baseTooltipStyle(chartColors),
        callbacks: {
          label: createDoughnutSliceTooltipLabel(formatNumber, (context) => {
            const num = Number(context.raw ?? 0);
            return Number.isFinite(num) ? num : undefined;
          }),
          labelColor: (context) =>
            doughnutLabelColor(context, chartColors, chartColors.grid),
        },
      },
    },
  } as ChartOptions<"doughnut">;
}

export function createBarChartOptions(
  formatNumber: ChartFormatNumber,
  chartColors: ChartColors,
): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        align: "end" as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
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
      tooltip: baseTooltipStyle(chartColors),
    },
    scales: {
      y: {
        beginAtZero: true,
        border: {
          display: false,
        },
        grid: {
          color: chartColors.grid,
          borderDash: [4, 4],
          drawBorder: false,
        },
        ticks: {
          font: {
            family: "Inter",
            size: 11,
          },
          color: chartColors.text,
          padding: 10,
          callback: function (value: string | number) {
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
          display: false,
          drawBorder: false,
        },
        ticks: {
          font: {
            family: "Inter",
            size: 11,
          },
          color: chartColors.text,
        },
      },
    },
  } as ChartOptions<"bar">;
}

export function createLineChartOptions(
  formatNumber: ChartFormatNumber,
  chartColors: ChartColors,
): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        ...baseTooltipStyle(chartColors),
        displayColors: false,
        callbacks: {
          label: createChartTooltipLabel(formatNumber, {
            getPrefix: (context) => {
              let label = context.dataset.label || "";
              if (label) label += ": ";
              return label;
            },
            getValue: (context) => {
              const ds = context.dataset as typeof context.dataset & {
                accountCurrency?: string;
                originalData?: number[];
              };
              if (ds.accountCurrency) {
                const nativeVal = ds.originalData?.[context.dataIndex];
                if (nativeVal !== undefined) return nativeVal;
              }
              return context.parsed.y;
            },
            getFormatOptions: (context) => {
              const ds = context.dataset as typeof context.dataset & {
                accountCurrency?: string;
              };
              return ds.accountCurrency ? { currency: ds.accountCurrency } : {};
            },
          }),
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        border: {
          display: false,
        },
        grid: {
          color: chartColors.grid,
          borderDash: [4, 4],
          drawBorder: false,
        },
        ticks: {
          font: {
            family: "Inter",
            size: 11,
          },
          color: chartColors.text,
          padding: 10,
          callback: function (value: string | number) {
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
          display: false,
          drawBorder: false,
        },
        ticks: {
          font: {
            family: "Inter",
            size: 11,
          },
          color: chartColors.text,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
    },
  } as ChartOptions<"line">;
}
