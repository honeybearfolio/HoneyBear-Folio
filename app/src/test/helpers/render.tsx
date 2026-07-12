/**
 * Shared test utilities for component tests.
 *
 * Use these helpers instead of copy-pasting store setup, format mocks, and
 * Tauri invoke handlers across test files.
 *
 * @example
 * ```ts
 * import { renderWithStores, mockTauri } from "../../helpers/render";
 *
 * vi.mock("../../../utils/format", async () => {
 *   const { createFormatUtilsMock } = await import("../../helpers/format-mocks");
 *   return createFormatUtilsMock();
 * });
 *
 * beforeEach(() => {
 *   mockTauri({ get_accounts: [] });
 * });
 *
 * it("renders", () => {
 *   renderWithStores(<MyComponent />);
 * });
 * ```
 */
import type { ReactElement } from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { vi } from "vitest";
import { APP_DEFAULTS } from "../../constants/app";
import { useNumberFormatStore } from "../../stores/number-format";

export type { FormatNumberFn, FormatUtilsMockOptions } from "./format-mocks";
export {
  createFormatUtilsMock,
  currencyFixedFormatNumber,
  currencyFormatNumber,
  defaultFormatNumber,
  extendFormatUtilsMock,
  prefixedFormatNumber,
} from "./format-mocks";

/** Partial number-format store state applied by {@link mockNumberFormat}. */
export type NumberFormatMockState = {
  locale?: string;
  currency?: string;
  dateFormat?: string;
  firstDayOfWeek?: number;
  uiLanguage?: string;
};

const DEFAULT_NUMBER_FORMAT: Required<NumberFormatMockState> = {
  locale: APP_DEFAULTS.LOCALE,
  currency: APP_DEFAULTS.CURRENCY,
  dateFormat: APP_DEFAULTS.DATE_FORMAT,
  firstDayOfWeek: APP_DEFAULTS.FIRST_DAY_OF_WEEK,
  uiLanguage: APP_DEFAULTS.UI_LANGUAGE,
};

type TauriCommandResult = string | number | boolean | null | object;

type TauriMockHandler = (args?: unknown) => TauriCommandResult;

export type TauriMockMap = Record<
  string,
  TauriCommandResult | TauriMockHandler
>;

export type TauriInvokeHandler = (
  cmd: string,
  args?: unknown,
) => Promise<unknown>;

function isTauriMockHandler(
  entry: TauriCommandResult | TauriMockHandler,
): entry is TauriMockHandler {
  return typeof entry === "function";
}

/** Default invoke responses mirrored from `src/test/setup.ts`. */
const DEFAULT_TAURI_RESPONSES: TauriMockMap = {
  compute_net_worth: 0,
  build_holdings_from_transactions: {
    currentHoldings: [],
    firstTradeDate: null,
  },
  merge_holdings_with_quotes: [],
  compute_portfolio_totals: { totalValue: 0, totalCostBasis: 0 },
  compute_net_worth_market_values: {},
};

/**
 * Reset the number-format Zustand store to predictable defaults.
 * Call in `beforeEach` or rely on {@link renderWithStores} to do it per render.
 */
export function mockNumberFormat(overrides: NumberFormatMockState = {}): void {
  useNumberFormatStore.setState({
    ...DEFAULT_NUMBER_FORMAT,
    ...overrides,
  });
}

/**
 * Configure the global Tauri `invoke` mock from `src/test/setup.ts`.
 *
 * Pass a command map (`{ get_accounts: [] }`) or a custom handler function.
 * Command map values may be constants or `(args) => result` factories.
 */
export function mockTauri(
  handlerOrMap?: TauriInvokeHandler | TauriMockMap,
): void {
  if (typeof handlerOrMap === "function") {
    vi.mocked(invoke).mockImplementation(handlerOrMap);
    return;
  }

  const map: TauriMockMap = {
    ...DEFAULT_TAURI_RESPONSES,
    ...handlerOrMap,
  };

  vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
    const entry = map[cmd];
    if (entry === undefined) return Promise.resolve(null);
    if (isTauriMockHandler(entry)) return Promise.resolve(entry(args));
    return Promise.resolve(entry);
  });
}

export type RenderWithStoresOptions = {
  /** Overrides applied via {@link mockNumberFormat} before render. */
  numberFormat?: NumberFormatMockState;
  /** Passed through to `@testing-library/react` `render`. */
  renderOptions?: RenderOptions;
};

/**
 * Render a component after seeding Zustand stores with test-friendly defaults.
 * Replaces the legacy `renderWithContext` helper from the React-context era.
 */
export function renderWithStores(
  ui: ReactElement,
  options: RenderWithStoresOptions = {},
): RenderResult {
  mockNumberFormat(options.numberFormat);
  return render(ui, options.renderOptions);
}
