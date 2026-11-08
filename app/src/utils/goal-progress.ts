import type { GoalLinkInput } from "../api/types";
import type { HoldingValueMap } from "./market-values";

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.4375;
const ON_TRACK_TOLERANCE = 0.98;

export type GoalStatus =
  | "reached"
  | "on_track"
  | "behind"
  | "projected"
  | "unscheduled";

export interface ProgressAccount {
  id: string | number;
  name: string;
  balance: number;
  exchangeRate: number;
}

export interface ProgressLink {
  sourceType: "account" | "holding";
  accountId?: number | null;
  ticker?: string | null;
  allocationPercent: number;
}

export interface LinkContribution {
  link: ProgressLink;
  amount: number;
  missing: boolean;
  overlapsAccount: boolean;
}

export interface GoalProgress {
  current: number;
  target: number;
  percent: number;
  remaining: number;
  status: GoalStatus;
  requiredMonthly: number | null;
  projectedDate: string | null;
  contributions: LinkContribution[];
  hasOverlap: boolean;
}

export interface GoalProgressInput {
  targetAmount: number;
  exchangeRate: number;
  createdAt: string;
  targetDate?: string | null;
  monthlyContribution?: number | null;
  links: ProgressLink[];
  accounts: ProgressAccount[];
  holdingValues: HoldingValueMap;
  now?: Date;
}

export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function tickersForAccount(
  holdingValues: HoldingValueMap,
  accountId: string | null,
): string[] {
  if (accountId) {
    return Object.keys(holdingValues[accountId] ?? {}).sort((a, b) =>
      a.localeCompare(b),
    );
  }
  const tickers = new Set<string>();
  for (const holdings of Object.values(holdingValues)) {
    for (const ticker of Object.keys(holdings)) tickers.add(ticker);
  }
  return [...tickers].sort((a, b) => a.localeCompare(b));
}

function accountMarketValue(
  holdingValues: HoldingValueMap,
  accountId: string,
): number {
  const holdings = holdingValues[accountId] ?? {};
  let total = 0;
  for (const value of Object.values(holdings)) {
    if (value != null) total += value;
  }
  return total;
}

function tickerValue(
  holdingValues: HoldingValueMap,
  accountId: string,
  ticker: string,
): number | null | undefined {
  const holdings = holdingValues[accountId];
  if (!holdings) return undefined;
  const key = Object.keys(holdings).find(
    (name) => name.toLowerCase() === ticker.toLowerCase(),
  );
  if (!key) return undefined;
  return holdings[key];
}

export function holdingOverlapsAccountLink(
  link: ProgressLink,
  links: ProgressLink[],
  holdingValues: HoldingValueMap,
): boolean {
  if (link.sourceType !== "holding") return false;
  const accountLinks = links.filter(
    (other) => other.sourceType === "account" && other.accountId != null,
  );
  if (link.accountId != null) {
    return accountLinks.some((other) => other.accountId === link.accountId);
  }
  const ticker = (link.ticker ?? "").trim().toLowerCase();
  if (!ticker) return false;
  return accountLinks.some((other) => {
    const accountId = String(other.accountId);
    const holdings = holdingValues[accountId] ?? {};
    return Object.keys(holdings).some((name) => name.toLowerCase() === ticker);
  });
}

function findAccount(
  accounts: ProgressAccount[],
  accountId: number,
): ProgressAccount | undefined {
  return accounts.find((account) => Number(account.id) === accountId);
}

function contributeHolding(
  link: ProgressLink,
  accounts: ProgressAccount[],
  holdingValues: HoldingValueMap,
): { amount: number; missing: boolean } {
  const ticker = (link.ticker ?? "").trim();
  if (!ticker) return { amount: 0, missing: true };

  const scoped =
    link.accountId == null
      ? accounts
      : accounts.filter((account) => Number(account.id) === link.accountId);
  if (link.accountId != null && scoped.length === 0) {
    return { amount: 0, missing: true };
  }

  let amount = 0;
  let found = false;
  let missingQuote = false;
  for (const account of scoped) {
    const value = tickerValue(holdingValues, String(account.id), ticker);
    if (value === undefined) continue;
    found = true;
    if (value == null) {
      missingQuote = true;
      continue;
    }
    amount += value * (account.exchangeRate || 1);
  }

  if (!found) return { amount: 0, missing: true };
  return {
    amount: amount * (link.allocationPercent / 100),
    missing: missingQuote,
  };
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getTime() + months * MONTH_MS);
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MONTH_MS;
}

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function computeGoalProgress(input: GoalProgressInput): GoalProgress {
  const now = input.now ?? new Date();
  const rate = input.exchangeRate || 1;
  const target = input.targetAmount * rate;
  const monthly =
    input.monthlyContribution != null && input.monthlyContribution > 0
      ? input.monthlyContribution * rate
      : null;

  const contributions: LinkContribution[] = input.links.map((link) => {
    const overlapsAccount = holdingOverlapsAccountLink(
      link,
      input.links,
      input.holdingValues,
    );
    if (link.sourceType === "account") {
      if (link.accountId == null) {
        return { link, amount: 0, missing: true, overlapsAccount };
      }
      const account = findAccount(input.accounts, link.accountId);
      if (!account) {
        return { link, amount: 0, missing: true, overlapsAccount };
      }
      const total =
        (account.balance +
          accountMarketValue(input.holdingValues, String(account.id))) *
        (account.exchangeRate || 1);
      return {
        link,
        amount: total * (link.allocationPercent / 100),
        missing: false,
        overlapsAccount,
      };
    }
    const holding = contributeHolding(
      link,
      input.accounts,
      input.holdingValues,
    );
    return { link, ...holding, overlapsAccount };
  });

  const current = contributions.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(0, target - current);
  const percent = target > 0 ? (current / target) * 100 : 0;
  const hasOverlap = contributions.some((item) => item.overlapsAccount);

  const targetDate = input.targetDate ? parseIsoDate(input.targetDate) : null;
  const createdAt = parseIsoDate(input.createdAt) ?? now;

  let status: GoalStatus = "unscheduled";
  let requiredMonthly: number | null = null;
  let projectedDate: string | null = null;

  if (target > 0 && current + 1e-6 >= target) {
    status = "reached";
  } else if (targetDate && monthly) {
    const monthsNeeded = remaining / monthly;
    const projected = addMonths(now, monthsNeeded);
    projectedDate = formatIsoDate(projected);
    const monthsLeft = monthsBetween(now, targetDate);
    requiredMonthly = monthsLeft > 0 ? remaining / monthsLeft : null;
    status = utcDay(projected) <= utcDay(targetDate) ? "on_track" : "behind";
  } else if (targetDate) {
    const span = targetDate.getTime() - createdAt.getTime();
    const elapsed = now.getTime() - createdAt.getTime();
    let expectedFraction = 0;
    if (now.getTime() >= targetDate.getTime()) expectedFraction = 1;
    else if (span > 0)
      expectedFraction = Math.min(1, Math.max(0, elapsed / span));
    const expected = target * expectedFraction;
    const threshold = expected > 0 ? expected * ON_TRACK_TOLERANCE : 0;
    status = current + 1e-6 >= threshold ? "on_track" : "behind";
    const monthsLeft = monthsBetween(now, targetDate);
    requiredMonthly = monthsLeft > 0 ? remaining / monthsLeft : null;
  } else if (monthly) {
    status = "projected";
    projectedDate = formatIsoDate(addMonths(now, remaining / monthly));
  }

  return {
    current,
    target,
    percent,
    remaining,
    status,
    requiredMonthly,
    projectedDate,
    contributions,
    hasOverlap,
  };
}

export function progressLinkFromInput(link: GoalLinkInput): ProgressLink {
  return {
    sourceType: link.sourceType,
    accountId: link.accountId ?? null,
    ticker: link.ticker ?? null,
    allocationPercent: link.allocationPercent,
  };
}
