import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../../constants/app";
import { DASHBOARD_WIDGET_IDS } from "../../features/dashboard/dashboard-layout";
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
    store.setWidgetSpan("assetAllocation", "full");
    store.setWidgetVisible("summaryAccounts", false);
    store.setTimeRange("ALL");
    store.setHiddenAccountIds(["4"]);
    store.setCustomRange("2024-02-01", "2024-03-01");

    useDashboardPreferencesStore.setState({
      layout: readDashboardLayout(),
      view: readDashboardView(),
    });

    const next = useDashboardPreferencesStore.getState();
    expect(
      next.layout.find((widget) => widget.id === "assetAllocation")?.span,
    ).toBe("full");
    expect(
      next.layout.find((widget) => widget.id === "summaryAccounts")?.visible,
    ).toBe(false);
    expect(next.view.timeRange).toBe("ALL");
    expect(next.view.hiddenAccountIds).toEqual(["4"]);
    expect(next.view.customStartDate).toBe("2024-02-01");
    expect(next.view.customEndDate).toBe("2024-03-01");
  });

  it("falls back when stored JSON is corrupt", () => {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_LAYOUT, "{");
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_VIEW, "nope");

    expect(readDashboardLayout().map((widget) => widget.id)).toEqual([
      ...DASHBOARD_WIDGET_IDS,
    ]);
    expect(readDashboardView().timeRange).toBe("1Y");
    expect(readDashboardView().hiddenAccountIds).toEqual([]);
  });

  it("resetAll restores defaults and clears storage", () => {
    const store = useDashboardPreferencesStore.getState();
    store.setTimeRange("6M");
    store.moveWidget("cashFlow", 0);

    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW)).toBeTruthy();

    store.resetAll();

    const next = useDashboardPreferencesStore.getState();
    expect(next.view.timeRange).toBe("1Y");
    expect(next.view.hiddenAccountIds).toEqual([]);
    expect(next.layout.map((widget) => widget.id)).toEqual([
      ...DASHBOARD_WIDGET_IDS,
    ]);
    expect(next.layout.every((widget) => widget.visible)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW)).toBeNull();
  });

  it("resetLayout keeps the saved view", () => {
    const store = useDashboardPreferencesStore.getState();
    store.setTimeRange("YTD");
    store.setWidgetVisible("netWorth", false);

    store.resetLayout();

    const next = useDashboardPreferencesStore.getState();
    expect(next.view.timeRange).toBe("YTD");
    expect(
      next.layout.find((widget) => widget.id === "netWorth")?.visible,
    ).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW)).toBeTruthy();
  });

  it("ignores span changes on summary cards and invalid dates", () => {
    const store = useDashboardPreferencesStore.getState();
    store.setWidgetSpan("summaryNetWorth", "full");
    expect(
      useDashboardPreferencesStore
        .getState()
        .layout.find((widget) => widget.id === "summaryNetWorth")?.span,
    ).toBe("half");

    const start = useDashboardPreferencesStore.getState().view.customStartDate;
    store.setCustomRange("bad", "2024-01-01");
    expect(useDashboardPreferencesStore.getState().view.customStartDate).toBe(
      start,
    );
  });
});
