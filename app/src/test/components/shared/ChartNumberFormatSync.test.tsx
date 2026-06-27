import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChartJS from "chart.js/auto";
import ChartNumberFormatSync from "../../../components/shared/ChartNumberFormatSync";

// Mock format utility
const mockFormatNumber = vi.fn(
  (value: number, _options: unknown) => `$${value.toFixed(2)}`,
);
vi.mock("../../../utils/format", () => ({
  useFormatNumber: () => mockFormatNumber,
}));

type TooltipCallback = (ctx: {
  dataset: { label?: string };
  parsed: { y?: number } | null;
  raw?: unknown;
}) => string;

type TickCallback = (
  value: unknown,
  index: number,
  values: unknown[],
) => unknown;

function deleteTooltipLabel(): void {
  const callbacks = ChartJS.defaults.plugins.tooltip
    .callbacks as unknown as Record<string, unknown>;
  delete callbacks.label;
}

function deleteLinearTickCallback(): void {
  const ticks = ChartJS.defaults.scales.linear.ticks as unknown as
    | Record<string, unknown>
    | undefined;
  if (ticks) {
    delete ticks.callback;
  }
}

describe("ChartNumberFormatSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteTooltipLabel();
    deleteLinearTickCallback();
  });

  it("renders nothing (null)", () => {
    const { container } = render(<ChartNumberFormatSync />);

    expect(container.firstChild).toBeNull();
  });

  it("sets up tooltip label callback on Chart.js defaults", () => {
    render(<ChartNumberFormatSync />);

    const callbacks = ChartJS.defaults.plugins.tooltip
      .callbacks as unknown as Record<string, unknown>;
    expect(callbacks.label).toBeDefined();
    expect(typeof callbacks.label).toBe("function");
  });

  it("sets up linear scale tick callback on Chart.js defaults", () => {
    render(<ChartNumberFormatSync />);

    expect(ChartJS.defaults.scales.linear.ticks.callback).toBeDefined();
    expect(typeof ChartJS.defaults.scales.linear.ticks.callback).toBe(
      "function",
    );
  });

  it("tooltip callback formats parsed.y value", () => {
    render(<ChartNumberFormatSync />);

    const callback: TooltipCallback = (ctx) =>
      (ChartJS.defaults.plugins.tooltip.callbacks.label as TooltipCallback)(
        ctx,
      );
    const ctx = {
      dataset: { label: "Revenue" },
      parsed: { y: 1234.56 },
    };

    const _result = callback(ctx);

    expect(mockFormatNumber).toHaveBeenCalledWith(1234.56, {
      style: "currency",
    });
    expect(_result).toContain("Revenue:");
  });

  it("tooltip callback handles doughnut chart raw values", () => {
    render(<ChartNumberFormatSync />);

    const callback: TooltipCallback = (ctx) =>
      (ChartJS.defaults.plugins.tooltip.callbacks.label as TooltipCallback)(
        ctx,
      );
    const ctx = {
      dataset: { label: "Category" },
      parsed: null,
      raw: 500,
    };

    callback(ctx);

    expect(mockFormatNumber).toHaveBeenCalledWith(500, { style: "currency" });
  });

  it("tooltip callback returns label without value for NaN", () => {
    render(<ChartNumberFormatSync />);

    const callback: TooltipCallback = (ctx) =>
      (ChartJS.defaults.plugins.tooltip.callbacks.label as TooltipCallback)(
        ctx,
      );
    const ctx = {
      dataset: { label: "Test" },
      parsed: null,
      raw: "not a number",
    };

    const _result = callback(ctx);

    expect(_result).toBe("Test: ");
  });

  it("tick callback formats numeric values", () => {
    render(<ChartNumberFormatSync />);

    const callback: TickCallback = (value, index, values) =>
      (ChartJS.defaults.scales.linear.ticks.callback as TickCallback)(
        value,
        index,
        values,
      );
    callback(1000, 0, []);

    expect(mockFormatNumber).toHaveBeenCalledWith(1000, { style: "currency" });
  });

  it("tick callback returns original value for NaN", () => {
    render(<ChartNumberFormatSync />);

    const callback: TickCallback = (value, index, values) =>
      (ChartJS.defaults.scales.linear.ticks.callback as TickCallback)(
        value,
        index,
        values,
      );
    const result = callback("not a number", 0, []);

    expect(result).toBe("not a number");
  });
});
