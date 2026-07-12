/**
 * Vi.mock-safe format utilities (no React, stores, or Tauri imports).
 * Import via dynamic `import()` inside `vi.mock` factories to avoid hoisting issues.
 */
import type { NumberFormatOptions } from "../../utils/format";

/** Lightweight formatter used by {@link createFormatUtilsMock}. */
export type FormatNumberFn = (
  value: unknown,
  options?: NumberFormatOptions,
) => string;

export type FormatDateFn = (value: string | Date | null | undefined) => string;

/** Stringify numbers for simple component tests. */
export const defaultFormatNumber: FormatNumberFn = (value) =>
  typeof value === "number" || typeof value === "string" ? String(value) : "";

/** Prefix numbers with `fmt-` (used by Sidebar tests). */
export const prefixedFormatNumber: FormatNumberFn = (value) =>
  `fmt-${defaultFormatNumber(value)}`;

/** USD-style currency formatting for tests that assert on `$` output. */
export const currencyFormatNumber: FormatNumberFn = (value, options) =>
  options?.style === "currency"
    ? `$${Number(value).toLocaleString("en-US")}`
    : defaultFormatNumber(value);

/** Fixed-decimal currency formatting for table-style assertions. */
export const currencyFixedFormatNumber: FormatNumberFn = (value, options) =>
  options?.style === "currency"
    ? `$${Number(value).toFixed(2)}`
    : defaultFormatNumber(value);

export type FormatUtilsMockOptions = {
  formatNumber?: FormatNumberFn;
  formatDate?: FormatDateFn;
};

const defaultFormatDate: FormatDateFn = (value) => {
  if (value == null) return "";
  const date = typeof value === "string" ? value : value.toISOString();
  return date.split("T")[0] ?? "";
};

/**
 * Vi.mock factory for `utils/format` hooks.
 * Keeps `useFormatNumber` / `useFormatDate` stubs consistent across tests.
 */
export function createFormatUtilsMock(options: FormatUtilsMockOptions = {}): {
  useFormatNumber: () => FormatNumberFn;
  useFormatDate: () => FormatDateFn;
} {
  const formatNumber = options.formatNumber ?? defaultFormatNumber;
  const formatDate = options.formatDate ?? defaultFormatDate;

  return {
    useFormatNumber: () => formatNumber,
    useFormatDate: () => formatDate,
  };
}

/**
 * Vi.mock factory that preserves real `utils/format` exports while stubbing hooks.
 */
export async function extendFormatUtilsMock(
  importOriginal: () => Promise<typeof import("../../utils/format")>,
  options: FormatUtilsMockOptions = {},
): Promise<typeof import("../../utils/format")> {
  const actual = await importOriginal();
  return {
    ...actual,
    ...createFormatUtilsMock(options),
  };
}
