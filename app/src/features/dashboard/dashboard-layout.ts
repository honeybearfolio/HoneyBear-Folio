import type { DashboardTimeRange } from "./dashboard-constants";

export const DASHBOARD_COLUMNS = 12;
export const DASHBOARD_ROW_HEIGHT = 48;

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
export type DashboardWidgetType = DashboardWidgetId;

export const WIDGET_FILTER_FIELDS = [
  "account",
  "category",
  "payee",
  "notes",
  "amount",
  "currency",
  "ticker",
  "tags",
  "fee",
  "shares",
  "price",
  "date",
] as const;

export type WidgetFilterField = (typeof WIDGET_FILTER_FIELDS)[number];

export interface WidgetFilter {
  id: string;
  field: WidgetFilterField;
  operator: string;
  value: string;
}

export interface DashboardWidgetInstance {
  instanceId: string;
  type: DashboardWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Null follows the dashboard header range. */
  timeRange: DashboardTimeRange | null;
  customStartDate: string | null;
  customEndDate: string | null;
  filters: WidgetFilter[];
}

export interface DashboardViewState {
  timeRange: DashboardTimeRange;
  customStartDate: string;
  customEndDate: string;
  hiddenAccountIds: string[];
}

const SUMMARY_WIDGET_IDS = new Set<DashboardWidgetType>([
  "summaryNetWorth",
  "summaryAccounts",
  "summaryTransactions",
]);

const WIDGET_ID_SET = new Set<string>(DASHBOARD_WIDGET_IDS);
const FILTER_FIELD_SET = new Set<string>(WIDGET_FILTER_FIELDS);

const TIME_RANGES = new Set<DashboardTimeRange>([
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "ALL",
  "CUSTOM",
]);

const NUMBER_FIELDS = new Set<WidgetFilterField>([
  "amount",
  "fee",
  "shares",
  "price",
]);

interface WidgetSize {
  w: number;
  h: number;
}

const DEFAULT_PLACEMENTS: Array<{
  type: DashboardWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
}> = [
  { type: "summaryNetWorth", x: 0, y: 0, w: 4, h: 3 },
  { type: "summaryAccounts", x: 4, y: 0, w: 4, h: 3 },
  { type: "summaryTransactions", x: 8, y: 0, w: 4, h: 3 },
  { type: "netWorth", x: 0, y: 3, w: 12, h: 8 },
  { type: "incomeVsExpenses", x: 0, y: 11, w: 12, h: 8 },
  { type: "cashFlow", x: 0, y: 19, w: 12, h: 10 },
  { type: "assetAllocation", x: 0, y: 29, w: 6, h: 8 },
  { type: "expensesByCategory", x: 6, y: 29, w: 6, h: 8 },
];

export const WIDGET_TITLE_KEYS: Record<DashboardWidgetType, string> = {
  summaryNetWorth: "dashboard.current_net_worth",
  summaryAccounts: "dashboard.total_accounts",
  summaryTransactions: "dashboard.total_transactions",
  netWorth: "dashboard.networth_evolution",
  incomeVsExpenses: "dashboard.income_vs_expenses",
  cashFlow: "dashboard.cash_flow",
  assetAllocation: "dashboard.asset_allocation",
  expensesByCategory: "dashboard.expenses_by_category",
};

export function isSummaryWidget(type: DashboardWidgetType): boolean {
  return SUMMARY_WIDGET_IDS.has(type);
}

export function isDashboardWidgetId(
  value: unknown,
): value is DashboardWidgetType {
  return typeof value === "string" && WIDGET_ID_SET.has(value);
}

export function isWidgetFilterField(
  value: unknown,
): value is WidgetFilterField {
  return typeof value === "string" && FILTER_FIELD_SET.has(value);
}

export function defaultWidgetSize(type: DashboardWidgetType): WidgetSize {
  if (isSummaryWidget(type)) return { w: 4, h: 3 };
  if (type === "cashFlow") return { w: 12, h: 10 };
  if (type === "assetAllocation" || type === "expensesByCategory") {
    return { w: 6, h: 8 };
  }
  return { w: 12, h: 8 };
}

export function minWidgetSize(type: DashboardWidgetType): WidgetSize {
  if (isSummaryWidget(type)) return { w: 2, h: 2 };
  return { w: 3, h: 4 };
}

export function operatorsForField(field: WidgetFilterField): string[] {
  if (field === "account") {
    return [
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "starts_with",
      "ends_with",
      "is_empty",
      "is_not_empty",
      "matches_regex",
      "not_matches_regex",
    ];
  }
  if (NUMBER_FIELDS.has(field)) {
    return [
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "is_empty",
      "is_not_empty",
    ];
  }
  if (field === "date") {
    return ["equals", "greater_than", "less_than", "is_empty", "is_not_empty"];
  }
  return [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
    "matches_regex",
    "not_matches_regex",
  ];
}

function emptyWidgetData(): Pick<
  DashboardWidgetInstance,
  "timeRange" | "customStartDate" | "customEndDate" | "filters"
> {
  return {
    timeRange: null,
    customStartDate: null,
    customEndDate: null,
    filters: [],
  };
}

export function cloneDefaultDashboardLayout(): DashboardWidgetInstance[] {
  return DEFAULT_PLACEMENTS.map((placement) => ({
    instanceId: `default-${placement.type}`,
    type: placement.type,
    x: placement.x,
    y: placement.y,
    w: placement.w,
    h: placement.h,
    ...emptyWidgetData(),
  }));
}

export function rectsOverlap(
  a: Pick<DashboardWidgetInstance, "x" | "y" | "w" | "h">,
  b: Pick<DashboardWidgetInstance, "x" | "y" | "w" | "h">,
): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export function boardRows(layout: readonly DashboardWidgetInstance[]): number {
  return layout.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function fitRect(
  type: DashboardWidgetType,
  x: number,
  y: number,
  w: number,
  h: number,
): Pick<DashboardWidgetInstance, "x" | "y" | "w" | "h"> {
  const min = minWidgetSize(type);
  const nextW = clampInt(w, min.w, DASHBOARD_COLUMNS, min.w);
  const nextX = clampInt(x, 0, DASHBOARD_COLUMNS - nextW, 0);
  const width = Math.min(nextW, DASHBOARD_COLUMNS - nextX);
  return {
    x: nextX,
    y: clampInt(y, 0, 200, 0),
    w: Math.max(min.w, width),
    h: clampInt(h, min.h, 40, min.h),
  };
}

export function findOpenSpot(
  layout: readonly DashboardWidgetInstance[],
  w: number,
  h: number,
): { x: number; y: number } {
  const maxY = boardRows(layout);
  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= DASHBOARD_COLUMNS - w; x += 1) {
      const candidate = { x, y, w, h };
      const blocked = layout.some((widget) => rectsOverlap(widget, candidate));
      if (!blocked) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}

export function createWidgetInstance(
  type: DashboardWidgetType,
  layout: readonly DashboardWidgetInstance[],
): DashboardWidgetInstance {
  const size = defaultWidgetSize(type);
  const spot = findOpenSpot(layout, size.w, size.h);
  return {
    instanceId: createInstanceId(),
    type,
    x: spot.x,
    y: spot.y,
    w: size.w,
    h: size.h,
    ...emptyWidgetData(),
  };
}

export function createInstanceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `widget-${String(Date.now())}`;
}

export function createWidgetFilter(
  field: WidgetFilterField = "category",
): WidgetFilter {
  const operators = operatorsForField(field);
  return {
    id: createInstanceId(),
    field,
    operator: operators[0] ?? "equals",
    value: "",
  };
}

function normalizeFilter(raw: unknown): WidgetFilter | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as {
    id?: unknown;
    field?: unknown;
    operator?: unknown;
    value?: unknown;
  };
  if (!isWidgetFilterField(record.field)) return null;
  const operators = operatorsForField(record.field);
  const operator =
    typeof record.operator === "string" && operators.includes(record.operator)
      ? record.operator
      : (operators[0] ?? "equals");
  return {
    id:
      typeof record.id === "string" && record.id
        ? record.id
        : createInstanceId(),
    field: record.field,
    operator,
    value: typeof record.value === "string" ? record.value : "",
  };
}

function isTimeRange(value: unknown): value is DashboardTimeRange {
  return (
    typeof value === "string" && TIME_RANGES.has(value as DashboardTimeRange)
  );
}

function normalizeInstance(raw: unknown): DashboardWidgetInstance | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as {
    instanceId?: unknown;
    type?: unknown;
    x?: unknown;
    y?: unknown;
    w?: unknown;
    h?: unknown;
    timeRange?: unknown;
    customStartDate?: unknown;
    customEndDate?: unknown;
    filters?: unknown;
  };
  if (!isDashboardWidgetId(record.type)) return null;
  const rect = fitRect(
    record.type,
    clampInt(record.x, 0, DASHBOARD_COLUMNS, 0),
    clampInt(record.y, 0, 200, 0),
    clampInt(record.w, 1, DASHBOARD_COLUMNS, defaultWidgetSize(record.type).w),
    clampInt(record.h, 1, 40, defaultWidgetSize(record.type).h),
  );
  const filters = Array.isArray(record.filters)
    ? record.filters
        .map((filter) => normalizeFilter(filter))
        .filter((filter): filter is WidgetFilter => filter !== null)
    : [];
  return {
    instanceId:
      typeof record.instanceId === "string" && record.instanceId
        ? record.instanceId
        : `default-${record.type}`,
    type: record.type,
    ...rect,
    timeRange:
      record.timeRange === null || record.timeRange === undefined
        ? null
        : isTimeRange(record.timeRange)
          ? record.timeRange
          : null,
    customStartDate:
      typeof record.customStartDate === "string" &&
      parseIsoDate(record.customStartDate)
        ? record.customStartDate
        : null,
    customEndDate:
      typeof record.customEndDate === "string" &&
      parseIsoDate(record.customEndDate)
        ? record.customEndDate
        : null,
    filters,
  };
}

function isLegacyRecord(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const record = raw as { id?: unknown; instanceId?: unknown; type?: unknown };
  return record.instanceId == null && record.type == null && "id" in record;
}

function isLegacyItem(raw: unknown): raw is {
  id: DashboardWidgetType;
  visible?: boolean;
  span?: string;
} {
  if (!isLegacyRecord(raw)) return false;
  const record = raw as { id?: unknown; visible?: unknown };
  return (
    isDashboardWidgetId(record.id) &&
    (typeof record.visible === "boolean" || "span" in record)
  );
}

function migrateLegacyLayout(raw: unknown[]): DashboardWidgetInstance[] {
  const placed: DashboardWidgetInstance[] = [];
  for (const item of raw) {
    if (!isLegacyItem(item) || item.visible === false) continue;
    const size = defaultWidgetSize(item.id);
    const spot = findOpenSpot(placed, size.w, size.h);
    placed.push({
      instanceId: `default-${item.id}`,
      type: item.id,
      x: spot.x,
      y: spot.y,
      w: size.w,
      h: size.h,
      ...emptyWidgetData(),
    });
  }
  return placed;
}

export function normalizeDashboardLayout(
  raw: unknown,
): DashboardWidgetInstance[] {
  if (!Array.isArray(raw)) return cloneDefaultDashboardLayout();
  if (raw.length === 0) return [];
  if (raw.every((item) => isLegacyRecord(item)))
    return migrateLegacyLayout(raw);

  const seen = new Set<string>();
  const result: DashboardWidgetInstance[] = [];
  for (const item of raw) {
    const widget = normalizeInstance(item);
    if (!widget || seen.has(widget.instanceId)) continue;
    seen.add(widget.instanceId);
    result.push(widget);
  }
  return result;
}

export function moveDashboardWidget(
  layout: DashboardWidgetInstance[],
  instanceId: string,
  x: number,
  y: number,
): DashboardWidgetInstance[] {
  const current = layout.find((widget) => widget.instanceId === instanceId);
  if (!current) return layout;
  const nextX = clampInt(x, 0, DASHBOARD_COLUMNS - current.w, current.x);
  const nextY = clampInt(y, 0, 200, current.y);
  if (nextX === current.x && nextY === current.y) return layout;
  const moved = { ...current, x: nextX, y: nextY };
  if (
    layout.some((widget) => widget !== current && rectsOverlap(widget, moved))
  ) {
    return layout;
  }
  return layout.map((widget) =>
    widget.instanceId === instanceId ? moved : widget,
  );
}

export function resizeDashboardWidget(
  layout: DashboardWidgetInstance[],
  instanceId: string,
  w: number,
  h: number,
): DashboardWidgetInstance[] {
  const current = layout.find((widget) => widget.instanceId === instanceId);
  if (!current) return layout;
  const rect = fitRect(current.type, current.x, current.y, w, h);
  if (rect.w === current.w && rect.h === current.h) return layout;
  const resized = { ...current, ...rect };
  if (
    layout.some((widget) => widget !== current && rectsOverlap(widget, resized))
  ) {
    return layout;
  }
  return layout.map((widget) =>
    widget.instanceId === instanceId ? resized : widget,
  );
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
