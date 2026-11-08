import { describe, expect, it } from "vitest";
import {
  cloneDefaultDashboardLayout,
  DASHBOARD_WIDGET_IDS,
  moveDashboardWidget,
  normalizeDashboardLayout,
  normalizeDashboardView,
} from "../../../features/dashboard/dashboard-layout";

describe("normalizeDashboardLayout", () => {
  it("returns the default layout for empty or invalid input", () => {
    expect(normalizeDashboardLayout(null).map((widget) => widget.id)).toEqual([
      ...DASHBOARD_WIDGET_IDS,
    ]);
    expect(
      normalizeDashboardLayout("nope").every((widget) => widget.visible),
    ).toBe(true);
  });

  it("drops unknown ids, ignores duplicates, and appends missing widgets", () => {
    const layout = normalizeDashboardLayout([
      { id: "not-a-widget", visible: true, span: "half" },
      { id: "netWorth", visible: false, span: "wide" },
      { id: "netWorth", visible: true, span: "half" },
    ]);

    expect(layout[0]).toEqual({
      id: "netWorth",
      visible: false,
      span: "full",
    });
    expect(layout.map((widget) => widget.id)).toEqual([
      "netWorth",
      ...DASHBOARD_WIDGET_IDS.filter((id) => id !== "netWorth"),
    ]);
  });
});

describe("moveDashboardWidget", () => {
  const layout = cloneDefaultDashboardLayout();

  it("moves a widget and clamps indexes at both ends", () => {
    const moved = moveDashboardWidget(layout, "summaryNetWorth", 1);
    expect(moved[0]?.id).toBe("summaryAccounts");
    expect(moved[1]?.id).toBe("summaryNetWorth");

    expect(moveDashboardWidget(layout, "summaryNetWorth", -5)).toBe(layout);
    expect(moveDashboardWidget(layout, "summaryNetWorth", 0)).toBe(layout);
    expect(moveDashboardWidget(layout, "expensesByCategory", 99)).toBe(layout);
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
