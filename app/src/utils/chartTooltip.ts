import type { ChartType, TooltipItem } from "chart.js";
import type { NumberFormatOptions } from "./format";

export type ChartFormatNumber = (
  value: unknown,
  options?: NumberFormatOptions,
) => string;

type TooltipContext = {
  parsed: unknown;
  raw?: unknown;
  dataset: { data?: unknown[] };
  dataIndex: number;
};

export function extractTooltipNumericValue(
  ctx: TooltipContext,
): number | undefined {
  const parsed: unknown = ctx.parsed;
  const parsedValue: unknown =
    parsed !== null && typeof parsed === "object" && "y" in parsed
      ? parsed.y
      : parsed;

  const value =
    parsedValue ??
    ctx.raw ??
    (Array.isArray(ctx.dataset.data)
      ? ctx.dataset.data[ctx.dataIndex]
      : undefined);

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return undefined;
  return numericValue;
}

export function formatChartTooltipCurrency(
  formatNumber: ChartFormatNumber,
  value: number,
  options?: NumberFormatOptions,
): string {
  return formatNumber(value, {
    style: "currency",
    ...options,
  });
}

export function defaultChartTooltipLabelCallback(
  formatNumber: ChartFormatNumber,
): (ctx: TooltipItem<ChartType>) => string {
  return function (ctx) {
    const label =
      typeof ctx.dataset.label === "string" ? `${ctx.dataset.label}: ` : "";

    const numericValue = extractTooltipNumericValue(ctx);
    if (numericValue === undefined) return label;

    return label + formatChartTooltipCurrency(formatNumber, numericValue);
  };
}

type DatasetWithOriginalData = { originalData?: number[] };

export function extractDoughnutTooltipValue(
  context: TooltipItem<"doughnut">,
): number | undefined {
  const dataset = context.dataset as typeof context.dataset &
    DatasetWithOriginalData;
  const raw = dataset.originalData
    ? dataset.originalData[context.dataIndex]
    : context.raw;

  if (raw === null || raw === undefined) return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

export function createDoughnutSliceTooltipLabel(
  formatNumber: ChartFormatNumber,
  getValue: (
    ctx: TooltipItem<"doughnut">,
  ) => number | undefined = extractDoughnutTooltipValue,
): (ctx: TooltipItem<"doughnut">) => string {
  return function (context) {
    let label = context.label || "";
    if (label) label += ": ";

    const value = getValue(context);
    if (value !== undefined) {
      label += formatChartTooltipCurrency(formatNumber, value);
    }
    return label;
  };
}

export function createChartTooltipLabel(
  formatNumber: ChartFormatNumber,
  options: {
    getPrefix?: (ctx: TooltipItem<ChartType>) => string;
    getValue?: (ctx: TooltipItem<ChartType>) => number | undefined;
    getFormatOptions?: (ctx: TooltipItem<ChartType>) => NumberFormatOptions;
    formatLabel?: (
      ctx: TooltipItem<ChartType>,
      formattedValue: string,
    ) => string;
  },
): (ctx: TooltipItem<ChartType>) => string {
  const { getPrefix, getValue, getFormatOptions, formatLabel } = options;

  return function (ctx) {
    const prefix = getPrefix
      ? getPrefix(ctx)
      : typeof ctx.dataset.label === "string"
        ? `${ctx.dataset.label}: `
        : "";

    const value = getValue ? getValue(ctx) : extractTooltipNumericValue(ctx);
    if (value === undefined) return prefix;

    const formatted = formatChartTooltipCurrency(
      formatNumber,
      value,
      getFormatOptions?.(ctx),
    );

    if (formatLabel) {
      return formatLabel(ctx, formatted);
    }
    return prefix + formatted;
  };
}
