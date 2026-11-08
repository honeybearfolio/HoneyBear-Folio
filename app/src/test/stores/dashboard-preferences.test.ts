import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../../constants/app";
import {
  DASHBOARD_WIDGET_IDS,
  type WidgetFilter,
} from "../../features/dashboard/dashboard-layout";
import {
  readDashboardLayout,
  readDashboardView,
  useDashboardPreferencesStore,
} from "../../stores/dashboard-preferences";

describe("useDashboardPreferencesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useDashboardPreferencesStore.getState().resetAll();
  });

  it("round-trips layout and view through localStorage", () => {
    const store = useDashboardPreferencesStore.getState();
    const card = store.layout.find(
      (widget) => widget.type === "assetAllocation",
    );
    expect(card).toBeDefined();
    store.resizeWidget(card!.instanceId, 6, 10);
    store.removeWidget(
      store.layout.find((widget) => widget.type === "summaryAccounts")!
        .instanceId,
    );
    const filters: WidgetFilter[] = [
      { id: "f1", field: "payee", operator: "contains", value: "Rent" },
    ];
    store.setWidgetFilters(card!.instanceId, filters);
    store.setWidgetTimeRange(card!.instanceId, "ALL");
    store.setTimeRange("ALL");
    store.setHiddenAccountIds(["4"]);
    store.setCustomRange("2024-02-01", "2024-03-01");

    useDashboardPreferencesStore.setState({
      layout: readDashboardLayout(),
      view: readDashboardView(),
    });

    const next = useDashboardPreferencesStore.getState();
    const saved = next.layout.find(
      (widget) => widget.instanceId === card!.instanceId,
    );
    expect(saved).toMatchObject({ w: 6, h: 10, timeRange: "ALL", filters });
    expect(
      next.layout.some((widget) => widget.type === "summaryAccounts"),
    ).toBe(false);
    expect(next.view.timeRange).toBe("ALL");
    expect(next.view.hiddenAccountIds).toEqual(["4"]);
    expect(next.view.customStartDate).toBe("2024-02-01");
    expect(next.view.customEndDate).toBe("2024-03-01");
  });

  it("falls back when stored JSON is corrupt", () => {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_LAYOUT, "{");
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_VIEW, "nope");

    expect(readDashboardLayout().map((widget) => widget.type)).toEqual([
      ...DASHBOARD_WIDGET_IDS,
    ]);
    expect(readDashboardView().timeRange).toBe("1Y");
    expect(readDashboardView().hiddenAccountIds).toEqual([]);
  });

  it("resetAll restores defaults and clears storage", () => {
    const store = useDashboardPreferencesStore.getState();
    store.setTimeRange("6M");
    store.addWidget("netWorth");

    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW)).toBeTruthy();

    store.resetAll();

    const next = useDashboardPreferencesStore.getState();
    expect(next.view.timeRange).toBe("1Y");
    expect(next.view.hiddenAccountIds).toEqual([]);
    expect(next.layout.map((widget) => widget.type)).toEqual([
      ...DASHBOARD_WIDGET_IDS,
    ]);
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW)).toBeNull();
  });

  it("resetLayout keeps the saved view", () => {
    const store = useDashboardPreferencesStore.getState();
    store.setTimeRange("YTD");
    store.removeWidget(
      store.layout.find((widget) => widget.type === "netWorth")!.instanceId,
    );

    store.resetLayout();

    const next = useDashboardPreferencesStore.getState();
    expect(next.view.timeRange).toBe("YTD");
    expect(next.layout.some((widget) => widget.type === "netWorth")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW)).toBeTruthy();
  });

  it("rejects an invalid custom date", () => {
    const start = useDashboardPreferencesStore.getState().view.customStartDate;
    useDashboardPreferencesStore.getState().setCustomRange("bad", "2024-01-01");
    expect(useDashboardPreferencesStore.getState().view.customStartDate).toBe(
      start,
    );
  });
});
