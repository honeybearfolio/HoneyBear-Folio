import { describe, expect, it } from "vitest";
import {
  cloneDefaultDashboardLayout,
  DASHBOARD_WIDGET_IDS,
  moveDashboardWidget,
  normalizeDashboardLayout,
  normalizeDashboardView,
  resizeDashboardWidget,
} from "../../../features/dashboard/dashboard-layout";

describe("normalizeDashboardLayout", () => {
  it("returns the default layout for empty or invalid input", () => {
    expect(normalizeDashboardLayout(null).map((widget) => widget.type)).toEqual(
      [...DASHBOARD_WIDGET_IDS],
    );
    expect(normalizeDashboardLayout("nope")).toHaveLength(
      DASHBOARD_WIDGET_IDS.length,
    );
  });

  it("keeps an explicit empty layout", () => {
    expect(normalizeDashboardLayout([])).toEqual([]);
  });

  it("migrates a legacy show/hide layout and drops hidden cards", () => {
    const layout = normalizeDashboardLayout([
      { id: "not-a-widget", visible: true, span: "half" },
      { id: "netWorth", visible: false, span: "wide" },
      { id: "summaryNetWorth", visible: true, span: "half" },
      { id: "assetAllocation", visible: true, span: "half" },
    ]);

    expect(layout.map((widget) => widget.type)).toEqual([
      "summaryNetWorth",
      "assetAllocation",
    ]);
    expect(layout[0]).toMatchObject({ x: 0, y: 0, w: 4, h: 3, filters: [] });
    expect(layout[1]).toMatchObject({ x: 4, y: 0, w: 6, h: 8 });
  });

  it("keeps placed cards, filters, and a custom range", () => {
    const layout = normalizeDashboardLayout([
      {
        instanceId: "custom-1",
        type: "expensesByCategory",
        x: 20,
        y: 1,
        w: 1,
        h: 1,
        timeRange: "3M",
        customStartDate: "nope",
        customEndDate: null,
        filters: [
          { id: "f1", field: "category", operator: "contains", value: "Food" },
          { id: "bad", field: "nope", operator: "equals", value: "x" },
        ],
      },
    ]);

    expect(layout).toHaveLength(1);
    expect(layout[0]).toMatchObject({
      instanceId: "custom-1",
      type: "expensesByCategory",
      x: 9,
      w: 3,
      h: 4,
      timeRange: "3M",
      customStartDate: null,
    });
    expect(layout[0]?.filters).toEqual([
      { id: "f1", field: "category", operator: "contains", value: "Food" },
    ]);
  });
});

describe("moveDashboardWidget", () => {
  const layout = cloneDefaultDashboardLayout();

  it("moves a card by grid units and refuses a cell that is taken", () => {
    const moved = moveDashboardWidget(layout, "default-summaryNetWorth", 0, 40);
    expect(
      moved.find((widget) => widget.instanceId === "default-summaryNetWorth"),
    ).toMatchObject({ x: 0, y: 40 });

    expect(moveDashboardWidget(layout, "default-summaryNetWorth", 4, 0)).toBe(
      layout,
    );
    expect(
      moveDashboardWidget(layout, "default-summaryNetWorth", -5, 0)[0],
    ).toMatchObject({ x: 0, y: 0 });
  });
});

describe("resizeDashboardWidget", () => {
  const layout = cloneDefaultDashboardLayout();

  it("resizes in grid units and keeps the card inside the board", () => {
    const resized = resizeDashboardWidget(
      layout,
      "default-assetAllocation",
      6,
      10,
    );
    expect(
      resized.find((widget) => widget.instanceId === "default-assetAllocation"),
    ).toMatchObject({ w: 6, h: 10 });
    expect(resizeDashboardWidget(layout, "default-assetAllocation", 8, 8)).toBe(
      layout,
    );

    expect(
      resizeDashboardWidget(layout, "default-summaryNetWorth", 12, 3),
    ).toBe(layout);
  });
});

describe("normalizeDashboardView", () => {
  it("falls back when the saved view is invalid", () => {
    const view = normalizeDashboardView(
      {
        timeRange: "NOPE",
        customStartDate: "2024-13-40",
        customEndDate: "yesterday",
        hiddenAccountIds: "nope",
      },
      new Date(2026, 0, 15),
    );

    expect(view).toEqual({
      timeRange: "1Y",
      customStartDate: "2025-01-15",
      customEndDate: "2026-01-15",
      hiddenAccountIds: [],
    });
  });

  it("keeps a valid view and stringifies numeric account ids", () => {
    const view = normalizeDashboardView({
      timeRange: "3M",
      customStartDate: "2024-01-01",
      customEndDate: "2024-06-01",
      hiddenAccountIds: [2, "3", 2],
    });

    expect(view).toEqual({
      timeRange: "3M",
      customStartDate: "2024-01-01",
      customEndDate: "2024-06-01",
      hiddenAccountIds: ["2", "3"],
    });
  });
});
