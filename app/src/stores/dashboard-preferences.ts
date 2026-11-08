import { create } from "zustand";
import { STORAGE_KEYS } from "../constants/app";
import {
  cloneDefaultDashboardLayout,
  createWidgetInstance,
  defaultDashboardView,
  moveDashboardWidget,
  normalizeDashboardLayout,
  normalizeDashboardView,
  parseIsoDate,
  resizeDashboardWidget,
  type DashboardViewState,
  type DashboardWidgetInstance,
  type DashboardWidgetType,
  type WidgetFilter,
} from "../features/dashboard/dashboard-layout";
import type { DashboardTimeRange } from "../features/dashboard/dashboard-constants";

export interface DashboardPreferencesState {
  layout: DashboardWidgetInstance[];
  view: DashboardViewState;
  setLayout: (layout: DashboardWidgetInstance[]) => void;
  moveWidget: (instanceId: string, x: number, y: number) => void;
  resizeWidget: (instanceId: string, w: number, h: number) => void;
  addWidget: (type: DashboardWidgetType) => void;
  removeWidget: (instanceId: string) => void;
  setWidgetFilters: (instanceId: string, filters: WidgetFilter[]) => void;
  setWidgetTimeRange: (
    instanceId: string,
    timeRange: DashboardTimeRange | null,
    customStartDate?: string | null,
    customEndDate?: string | null,
  ) => void;
  resetLayout: () => void;
  setTimeRange: (timeRange: DashboardViewState["timeRange"]) => void;
  setCustomRange: (customStartDate: string, customEndDate: string) => void;
  setHiddenAccountIds: (hiddenAccountIds: string[]) => void;
  resetView: () => void;
  resetAll: () => void;
}

export function readDashboardLayout(): DashboardWidgetInstance[] {
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

function writeLayout(layout: DashboardWidgetInstance[]) {
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

function replaceWidget(
  layout: DashboardWidgetInstance[],
  instanceId: string,
  update: (widget: DashboardWidgetInstance) => DashboardWidgetInstance,
): DashboardWidgetInstance[] | null {
  const current = layout.find((widget) => widget.instanceId === instanceId);
  if (!current) return null;
  const nextWidget = update(current);
  if (nextWidget === current) return null;
  return layout.map((widget) =>
    widget.instanceId === instanceId ? nextWidget : widget,
  );
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
    moveWidget: (instanceId, x, y) => {
      const next = moveDashboardWidget(get().layout, instanceId, x, y);
      if (next === get().layout) return;
      writeLayout(next);
      set({ layout: next });
    },
    resizeWidget: (instanceId, w, h) => {
      const next = resizeDashboardWidget(get().layout, instanceId, w, h);
      if (next === get().layout) return;
      writeLayout(next);
      set({ layout: next });
    },
    addWidget: (type) => {
      const layout = [
        ...get().layout,
        createWidgetInstance(type, get().layout),
      ];
      writeLayout(layout);
      set({ layout });
    },
    removeWidget: (instanceId) => {
      const layout = get().layout.filter(
        (widget) => widget.instanceId !== instanceId,
      );
      if (layout.length === get().layout.length) return;
      writeLayout(layout);
      set({ layout });
    },
    setWidgetFilters: (instanceId, filters) => {
      const layout = replaceWidget(get().layout, instanceId, (widget) => ({
        ...widget,
        filters,
      }));
      if (!layout) return;
      writeLayout(layout);
      set({ layout });
    },
    setWidgetTimeRange: (
      instanceId,
      timeRange,
      customStartDate,
      customEndDate,
    ) => {
      const layout = replaceWidget(get().layout, instanceId, (widget) => ({
        ...widget,
        timeRange,
        customStartDate:
          customStartDate === undefined
            ? widget.customStartDate
            : customStartDate,
        customEndDate:
          customEndDate === undefined ? widget.customEndDate : customEndDate,
      }));
      if (!layout) return;
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
