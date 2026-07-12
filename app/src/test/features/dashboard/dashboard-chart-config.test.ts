import { describe, it, expect, vi } from "vitest";
import {
  createBarChartOptions,
  createDoughnutChartOptions,
  createExpensesDoughnutChartOptions,
  createLineChartOptions,
  registerDashboardCharts,
} from "../../../features/dashboard/dashboard-chart-config";
import type { ChartColors } from "../../../hooks/useChartColors";

const chartColors: ChartColors = {
  primary: "#000",
  secondary: "#111",
  success: "#0f0",
  line: "rgb(59, 130, 246)",
  profit: "rgb(16, 185, 129)",
  loss: "rgb(239, 68, 68)",
  text: "rgb(100, 116, 139)",
  grid: "rgba(0,0,0,0.1)",
  background: "#fff",
  tooltipBg: "#000",
  tooltipText: "#fff",
  palette: ["rgb(59, 130, 246)"],
};

const formatNumber = vi.fn((value: unknown) => `$${String(value)}`);

describe("dashboard-chart-config", () => {
  it("registerDashboardCharts is idempotent", () => {
    expect(() => {
      registerDashboardCharts();
      registerDashboardCharts();
    }).not.toThrow();
  });

  it("createDoughnutChartOptions wires doughnut tooltip callbacks", () => {
    const options = createDoughnutChartOptions(
      false,
      formatNumber,
      chartColors,
    );
    const label = options.plugins?.tooltip?.callbacks?.label;
    expect(label).toBeTypeOf("function");
    expect(options.plugins?.tooltip?.callbacks?.labelColor).toBeTypeOf(
      "function",
    );
  });

  it("createExpensesDoughnutChartOptions uses raw value extractor", () => {
    const options = createExpensesDoughnutChartOptions(
      true,
      formatNumber,
      chartColors,
    );
    const label = options.plugins?.tooltip?.callbacks?.label;
    expect(label).toBeTypeOf("function");
  });

  it("createBarChartOptions formats y-axis ticks as currency", () => {
    const options = createBarChartOptions(formatNumber, chartColors);
    const callback = options.scales?.y?.ticks?.callback as (
      value: string | number,
    ) => string | number;
    expect(callback(1000)).toBe("$1000");
  });

  it("createLineChartOptions hides legend and wires tooltip callback", () => {
    const options = createLineChartOptions(formatNumber, chartColors);
    expect(options.plugins?.legend?.display).toBe(false);
    expect(options.plugins?.tooltip?.callbacks?.label).toBeTypeOf("function");
  });
});
