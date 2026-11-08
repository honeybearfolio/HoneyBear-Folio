import { create } from "zustand";
import { STORAGE_KEYS } from "../constants/app";
import {
  cloneDefaultDashboardLayout,
  defaultDashboardView,
  isSummaryWidget,
  moveDashboardWidget,
  normalizeDashboardLayout,
  normalizeDashboardView,
  parseIsoDate,
  type ChartSpan,
  type DashboardViewState,
  type DashboardWidgetConfig,
  type DashboardWidgetId,
} from "../features/dashboard/dashboard-layout";

export interface DashboardPreferencesState {
  layout: DashboardWidgetConfig[];
  view: DashboardViewState;
  setLayout: (layout: DashboardWidgetConfig[]) => void;
  moveWidget: (id: DashboardWidgetId, toIndex: number) => void;
  setWidgetVisible: (id: DashboardWidgetId, visible: boolean) => void;
  setWidgetSpan: (id: DashboardWidgetId, span: ChartSpan) => void;
  resetLayout: () => void;
  setTimeRange: (timeRange: DashboardViewState["timeRange"]) => void;
  setCustomRange: (customStartDate: string, customEndDate: string) => void;
  setHiddenAccountIds: (hiddenAccountIds: string[]) => void;
  resetView: () => void;
  resetAll: () => void;
}

export function readDashboardLayout(): DashboardWidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT);
    if (!raw) return cloneDefaultDashboardLayout();
    return normalizeDashboardLayout(JSON.parse(raw) as unknown);
  } catch {
    return cloneDefaultDashboardLayout();
  }
}

export function readDashboardView(): DashboardViewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW);
    if (!raw) return defaultDashboardView();
    return normalizeDashboardView(JSON.parse(raw) as unknown);
  } catch {
    return defaultDashboardView();
  }
}

function writeLayout(layout: DashboardWidgetConfig[]) {
  localStorage.setItem(STORAGE_KEYS.DASHBOARD_LAYOUT, JSON.stringify(layout));
}

function writeView(view: DashboardViewState) {
  localStorage.setItem(STORAGE_KEYS.DASHBOARD_VIEW, JSON.stringify(view));
}

function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const useDashboardPreferencesStore = create<DashboardPreferencesState>(
  (set, get) => ({
    layout: readDashboardLayout(),
    view: readDashboardView(),
    setLayout: (layout) => {
      const next = normalizeDashboardLayout(layout);
      writeLayout(next);
      set({ layout: next });
    },
    moveWidget: (id, toIndex) => {
      const next = moveDashboardWidget(get().layout, id, toIndex);
      if (next === get().layout) return;
      writeLayout(next);
      set({ layout: next });
    },
    setWidgetVisible: (id, visible) => {
      const current = get().layout.find((widget) => widget.id === id);
      if (!current || current.visible === visible) return;
      const layout = get().layout.map((widget) =>
        widget.id === id ? { ...widget, visible } : widget,
      );
      writeLayout(layout);
      set({ layout });
    },
    setWidgetSpan: (id, span) => {
      if (isSummaryWidget(id)) return;
      const current = get().layout.find((widget) => widget.id === id);
      if (!current || current.span === span) return;
      const layout = get().layout.map((widget) =>
        widget.id === id ? { ...widget, span } : widget,
      );
      writeLayout(layout);
      set({ layout });
    },
    resetLayout: () => {
      removeKey(STORAGE_KEYS.DASHBOARD_LAYOUT);
      set({ layout: cloneDefaultDashboardLayout() });
    },
    setTimeRange: (timeRange) => {
      const view = { ...get().view, timeRange };
      writeView(view);
      set({ view });
    },
    setCustomRange: (customStartDate, customEndDate) => {
      if (!parseIsoDate(customStartDate) || !parseIsoDate(customEndDate))
        return;
      const view = { ...get().view, customStartDate, customEndDate };
      writeView(view);
      set({ view });
    },
    setHiddenAccountIds: (hiddenAccountIds) => {
      const view = {
        ...get().view,
        hiddenAccountIds: [...new Set(hiddenAccountIds.map(String))],
      };
      writeView(view);
      set({ view });
    },
    resetView: () => {
      removeKey(STORAGE_KEYS.DASHBOARD_VIEW);
      set({ view: defaultDashboardView() });
    },
    resetAll: () => {
      removeKey(STORAGE_KEYS.DASHBOARD_LAYOUT);
      removeKey(STORAGE_KEYS.DASHBOARD_VIEW);
      set({
        layout: cloneDefaultDashboardLayout(),
        view: defaultDashboardView(),
      });
    },
  }),
);
