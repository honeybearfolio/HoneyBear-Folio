import type { DashboardTimeRange } from "./dashboard-constants";

export const DASHBOARD_WIDGET_IDS = [
  "summaryNetWorth",
  "summaryAccounts",
  "summaryTransactions",
  "netWorth",
  "incomeVsExpenses",
  "cashFlow",
  "assetAllocation",
  "expensesByCategory",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export type ChartSpan = "half" | "full";

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  visible: boolean;
  span: ChartSpan;
}

export interface DashboardViewState {
  timeRange: DashboardTimeRange;
  customStartDate: string;
  customEndDate: string;
  hiddenAccountIds: string[];
}

const SUMMARY_WIDGET_IDS = new Set<DashboardWidgetId>([
  "summaryNetWorth",
  "summaryAccounts",
  "summaryTransactions",
]);

const WIDGET_ID_SET = new Set<string>(DASHBOARD_WIDGET_IDS);

const TIME_RANGES = new Set<DashboardTimeRange>([
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "ALL",
  "CUSTOM",
]);

const DEFAULT_SPAN: Record<DashboardWidgetId, ChartSpan> = {
  summaryNetWorth: "half",
  summaryAccounts: "half",
  summaryTransactions: "half",
  netWorth: "full",
  incomeVsExpenses: "full",
  cashFlow: "full",
  assetAllocation: "half",
  expensesByCategory: "half",
};

export const DEFAULT_DASHBOARD_LAYOUT: readonly DashboardWidgetConfig[] =
  DASHBOARD_WIDGET_IDS.map((id) => ({
    id,
    visible: true,
    span: DEFAULT_SPAN[id],
  }));

export function cloneDefaultDashboardLayout(): DashboardWidgetConfig[] {
  return DEFAULT_DASHBOARD_LAYOUT.map((widget) => ({ ...widget }));
}

export function isSummaryWidget(id: DashboardWidgetId): boolean {
  return SUMMARY_WIDGET_IDS.has(id);
}

export function isDashboardWidgetId(
  value: unknown,
): value is DashboardWidgetId {
  return typeof value === "string" && WIDGET_ID_SET.has(value);
}

export function dashboardSpanClass(widget: DashboardWidgetConfig): string {
  if (isSummaryWidget(widget.id)) return "dashboard-span-card";
  return widget.span === "half" ? "dashboard-span-half" : "dashboard-span-full";
}

export function normalizeDashboardLayout(
  raw: unknown,
): DashboardWidgetConfig[] {
  const seen = new Set<DashboardWidgetId>();
  const result: DashboardWidgetConfig[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as {
        id?: unknown;
        visible?: unknown;
        span?: unknown;
      };
      if (!isDashboardWidgetId(record.id) || seen.has(record.id)) continue;
      seen.add(record.id);
      const span =
        record.span === "half" || record.span === "full"
          ? record.span
          : DEFAULT_SPAN[record.id];
      result.push({
        id: record.id,
        visible: typeof record.visible === "boolean" ? record.visible : true,
        span,
      });
    }
  }

  for (const widget of DEFAULT_DASHBOARD_LAYOUT) {
    if (!seen.has(widget.id)) {
      result.push({ ...widget });
    }
  }

  return result;
}

export function moveDashboardWidget(
  layout: DashboardWidgetConfig[],
  id: DashboardWidgetId,
  toIndex: number,
): DashboardWidgetConfig[] {
  const fromIndex = layout.findIndex((widget) => widget.id === id);
  if (fromIndex === -1) return layout;
  const clamped = Math.max(0, Math.min(layout.length - 1, toIndex));
  if (fromIndex === clamped) return layout;
  const next = layout.slice();
  const [item] = next.splice(fromIndex, 1);
  if (!item) return layout;
  next.splice(clamped, 0, item);
  return next;
}

export function formatIsoDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function defaultDashboardView(
  now: Date = new Date(),
): DashboardViewState {
  const start = new Date(now.getTime());
  start.setFullYear(start.getFullYear() - 1);
  return {
    timeRange: "1Y",
    customStartDate: formatIsoDate(start),
    customEndDate: formatIsoDate(now),
    hiddenAccountIds: [],
  };
}

function isTimeRange(value: unknown): value is DashboardTimeRange {
  return (
    typeof value === "string" && TIME_RANGES.has(value as DashboardTimeRange)
  );
}

export function normalizeDashboardView(
  raw: unknown,
  now: Date = new Date(),
): DashboardViewState {
  const fallback = defaultDashboardView(now);
  if (typeof raw !== "object" || raw === null) return fallback;
  const record = raw as {
    timeRange?: unknown;
    customStartDate?: unknown;
    customEndDate?: unknown;
    hiddenAccountIds?: unknown;
  };

  const customStartDate =
    typeof record.customStartDate === "string" &&
    parseIsoDate(record.customStartDate)
      ? record.customStartDate
      : fallback.customStartDate;
  const customEndDate =
    typeof record.customEndDate === "string" &&
    parseIsoDate(record.customEndDate)
      ? record.customEndDate
      : fallback.customEndDate;

  const hiddenAccountIds = Array.isArray(record.hiddenAccountIds)
    ? [
        ...new Set(
          record.hiddenAccountIds
            .filter((id) => typeof id === "string" || typeof id === "number")
            .map((id) => String(id)),
        ),
      ]
    : [];

  return {
    timeRange: isTimeRange(record.timeRange)
      ? record.timeRange
      : fallback.timeRange,
    customStartDate,
    customEndDate,
    hiddenAccountIds,
  };
}
