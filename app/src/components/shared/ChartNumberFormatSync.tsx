import { useEffect } from "react";
import ChartJS from "chart.js/auto";
import { useFormatNumber } from "../../utils/format";
import { defaultChartTooltipLabelCallback } from "../../utils/chartTooltip";

export default function ChartNumberFormatSync() {
  const formatNumber = useFormatNumber();

  useEffect(() => {
    ChartJS.defaults.plugins.tooltip.callbacks.label =
      defaultChartTooltipLabelCallback(formatNumber);

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
