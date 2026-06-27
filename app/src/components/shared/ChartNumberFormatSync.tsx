import { useEffect } from "react";
import ChartJS from "chart.js/auto";
import { useFormatNumber } from "../../utils/format";

export default function ChartNumberFormatSync() {
  const formatNumber = useFormatNumber();

  useEffect(() => {
    // Tooltip label: tries to handle line/bar (parsed.y), doughnut (raw), or dataset data
    ChartJS.defaults.plugins.tooltip.callbacks.label = function (ctx) {
      const label =
        typeof ctx.dataset.label === "string" ? `${ctx.dataset.label}: ` : "";

      const parsed: unknown = ctx.parsed;
      const parsedValue: unknown =
        parsed !== null && typeof parsed === "object" && "y" in parsed
          ? parsed.y
          : parsed;

      // Try several places to get the numeric value
      const value =
        parsedValue ??
        ctx.raw ??
        (Array.isArray(ctx.dataset.data)
          ? ctx.dataset.data[ctx.dataIndex]
          : undefined);

      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return label;

      // Use currency style so grouping and decimal separators follow the app locale
      return (
        label +
        formatNumber(numericValue, {
          style: "currency",
        })
      );
    };

    // Linear scales (y axes) ticks
    ChartJS.defaults.scales.linear.ticks.callback = function (v) {
      // v might be a string (Chart passes numbers or strings)
      const num = Number(v);
      if (Number.isNaN(num)) return v;
      return formatNumber(num, {
        style: "currency",
      });
    };
  }, [formatNumber]);

  return null;
}
