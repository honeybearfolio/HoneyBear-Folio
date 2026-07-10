import { describe, it, expect, vi } from "vitest";
import type { TooltipItem } from "chart.js";
import {
  createChartTooltipLabel,
  createDoughnutSliceTooltipLabel,
  defaultChartTooltipLabelCallback,
  extractDoughnutTooltipValue,
  extractTooltipNumericValue,
  type ChartFormatNumber,
} from "../../utils/chartTooltip";

const mockFormatNumber = vi.fn(
  (value: unknown, options?: { style?: string; currency?: string }) => {
    const num = Number(value);
    if (options?.currency === "EUR") return `€${num.toFixed(2)}`;
    return `$${num.toFixed(2)}`;
  },
) as unknown as ChartFormatNumber;

describe("chartTooltip", () => {
  it("extractTooltipNumericValue reads parsed.y", () => {
    expect(
      extractTooltipNumericValue({
        parsed: { y: 42 },
        raw: 0,
        dataset: { data: [] },
        dataIndex: 0,
      }),
    ).toBe(42);
  });

  it("extractTooltipNumericValue falls back to dataset.data", () => {
    expect(
      extractTooltipNumericValue({
        parsed: null,
        raw: undefined,
        dataset: { data: [99, 100] },
        dataIndex: 0,
      }),
    ).toBe(99);
  });

  it("extractTooltipNumericValue returns undefined for non-numeric values", () => {
    expect(
      extractTooltipNumericValue({
        parsed: null,
        raw: "n/a",
        dataset: { data: [] },
        dataIndex: 0,
      }),
    ).toBeUndefined();
  });

  it("defaultChartTooltipLabelCallback formats dataset label and value", () => {
    const callback = defaultChartTooltipLabelCallback(mockFormatNumber);
    const result = callback({
      dataset: { label: "Revenue", data: [10] },
      parsed: { y: 1234.5 },
      dataIndex: 0,
    } as TooltipItem<"line">);

    expect(result).toBe("Revenue: $1234.50");
    expect(mockFormatNumber).toHaveBeenCalledWith(1234.5, {
      style: "currency",
    });
  });

  it("extractDoughnutTooltipValue prefers originalData over raw", () => {
    const value = extractDoughnutTooltipValue({
      dataset: { originalData: [-250], data: [250] },
      dataIndex: 0,
      raw: 250,
    } as unknown as TooltipItem<"doughnut">);

    expect(value).toBe(-250);
  });

  it("createDoughnutSliceTooltipLabel uses slice label prefix", () => {
    const callback = createDoughnutSliceTooltipLabel(mockFormatNumber);
    const result = callback({
      label: "Groceries",
      dataset: { data: [80] },
      dataIndex: 0,
      raw: 80,
    } as unknown as TooltipItem<"doughnut">);

    expect(result).toBe("Groceries: $80.00");
  });

  it("createChartTooltipLabel supports custom format options", () => {
    const callback = createChartTooltipLabel(mockFormatNumber, {
      getValue: () => 100,
      getFormatOptions: () => ({ currency: "EUR" }),
      formatLabel: (_ctx, formatted) => `Total: ${formatted}`,
    });

    expect(
      callback({
        dataset: { data: [] },
        dataIndex: 0,
      } as unknown as TooltipItem<"line">),
    ).toBe("Total: €100.00");
  });

  it("createChartTooltipLabel supports flow-style labels", () => {
    const callback = createChartTooltipLabel(mockFormatNumber, {
      getValue: (ctx) => (ctx.raw as { flow: number }).flow,
      formatLabel: (ctx, formatted) => {
        const item = ctx.raw as { from: string; to: string };
        return `${item.from} -> ${item.to}: ${formatted}`;
      },
    });

    const result = callback({
      raw: { from: "Income", to: "Rent", flow: 1200 },
      dataset: { data: [] },
      dataIndex: 0,
    } as unknown as TooltipItem<"sankey">);

    expect(result).toBe("Income -> Rent: $1200.00");
  });
});
