export interface DashboardAccountSeries {
  accountId: number;
  currency: string;
  native: number[];
  converted: number[];
}

export interface DashboardIncomeExpenseBucket {
  key: string;
  income: number;
  expenses: number;
}

export interface DashboardCategoryTotal {
  category: string;
  amount: number;
}

export interface DashboardChartSeries {
  dates: string[];
  totals: number[];
  accounts: DashboardAccountSeries[];
  incomeExpense: DashboardIncomeExpenseBucket[];
  categories: DashboardCategoryTotal[];
  tickers: string[];
  bucket: string;
}

export interface DashboardChartQuery {
  accountIds: number[];
  startDate: string;
  endDate: string;
  appCurrency: string;
  bucket: "day" | "month";
  clampStart: boolean;
}

export function emptyDashboardChartSeries(): DashboardChartSeries {
  return {
    dates: [],
    totals: [],
    accounts: [],
    incomeExpense: [],
    categories: [],
    tickers: [],
    bucket: "month",
  };
}

export function normalizeDashboardChartSeries(
  value: unknown,
): DashboardChartSeries {
  if (!value || typeof value !== "object") return emptyDashboardChartSeries();
  const raw = value as Partial<DashboardChartSeries>;
  return {
    dates: raw.dates ?? [],
    totals: raw.totals ?? [],
    accounts: raw.accounts ?? [],
    incomeExpense: raw.incomeExpense ?? [],
    categories: raw.categories ?? [],
    tickers: raw.tickers ?? [],
    bucket: raw.bucket ?? "month",
  };
}

export function dashboardChartQueryKey(query: DashboardChartQuery): string {
  const ids = [...query.accountIds].sort((a, b) => a - b).join(",");
  return [
    ids,
    query.startDate,
    query.endDate,
    query.bucket,
    query.clampStart ? "1" : "0",
    query.appCurrency,
  ].join("|");
}

export function accountIdsOf(
  accounts: ReadonlyArray<{ id: string | number }>,
): number[] {
  return accounts
    .map((account) => Number(account.id))
    .filter((id) => Number.isFinite(id));
}
