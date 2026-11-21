import { beforeEach, describe, expect, it, vi } from "vitest";
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
import {
  usePortfolioPreferences,
  readPortfolioPreference,
} from "../../stores/portfolio-preferences";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe("useDashboardPreferencesStore", () => {
  beforeEach(() => {
    usePortfolioPreferences.setState({ path: "/test.db", values: {} });
    useDashboardPreferencesStore.getState().resetAll();
  });

  it("round-trips layout and view through portfolio preferences", () => {
    const store = useDashboardPreferencesStore.getState();
    const card = store.layout.find(
      (widget) => widget.type === "assetAllocation",
    );
    expect(card).toBeDefined();
    store.resizeWidget(card!.instanceId, 6, 7);
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
    expect(saved).toMatchObject({ w: 6, h: 7, timeRange: "ALL", filters });
    expect(
      next.layout.some((widget) => widget.type === "summaryAccounts"),
    ).toBe(false);
    expect(next.view.timeRange).toBe("ALL");
    expect(next.view.hiddenAccountIds).toEqual(["4"]);
    expect(next.view.customStartDate).toBe("2024-02-01");
    expect(next.view.customEndDate).toBe("2024-03-01");
  });

  it("falls back when stored JSON is corrupt", () => {
    usePortfolioPreferences.setState({
      values: {
        [STORAGE_KEYS.DASHBOARD_LAYOUT]: "{",
        [STORAGE_KEYS.DASHBOARD_VIEW]: "nope",
      },
    });

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

    expect(readPortfolioPreference(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBeTruthy();
    expect(readPortfolioPreference(STORAGE_KEYS.DASHBOARD_VIEW)).toBeTruthy();

    store.resetAll();

    const next = useDashboardPreferencesStore.getState();
    expect(next.view.timeRange).toBe("1Y");
    expect(next.view.hiddenAccountIds).toEqual([]);
    expect(next.layout.map((widget) => widget.type)).toEqual([
      ...DASHBOARD_WIDGET_IDS,
    ]);
    expect(readPortfolioPreference(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBe("");
    expect(readPortfolioPreference(STORAGE_KEYS.DASHBOARD_VIEW)).toBe("");
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
    expect(readPortfolioPreference(STORAGE_KEYS.DASHBOARD_LAYOUT)).toBe("");
    expect(readPortfolioPreference(STORAGE_KEYS.DASHBOARD_VIEW)).toBeTruthy();
  });

  it("rejects an invalid custom date", () => {
    const start = useDashboardPreferencesStore.getState().view.customStartDate;
    useDashboardPreferencesStore.getState().setCustomRange("bad", "2024-01-01");
    expect(useDashboardPreferencesStore.getState().view.customStartDate).toBe(
      start,
    );
  });
});
