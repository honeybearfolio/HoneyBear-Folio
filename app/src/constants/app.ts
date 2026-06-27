export const STORAGE_KEYS = {
  SIDEBAR_VISIBILITY: "hb_sidebar_visibility",
  SIDEBAR_WIDTH: "hb_sidebar_width",
  CURRENCY: "hb_currency",
  FONT_SIZE: "hb_font_size",
  NUMBER_FORMAT: "hb_number_format",
  THEME: "hb_theme",
  DATE_FORMAT: "hb_date_format",
  FIRST_DAY_OF_WEEK: "hb_first_day_of_week",
  UI_LANGUAGE: "hb_ui_language",
  CHAT_THINK: "hb_chat_think",
  PRIVACY_MODE: "hb_privacy_mode",
  FIRST_RUN_COMPLETED: "hb_first_run_completed",
  ACCOUNT_SORT_CONFIG: "hb_account_sort_config",
  ACCOUNT_ORDER: "hb_account_order",
  TAG_COLORS: "hb_tag_colors",
} as const;

export const FIRE_DEFAULTS = {
  CURRENT_NET_WORTH: 0,
  ANNUAL_EXPENSES: 40000,
  EXPECTED_RETURN: 7,
  WITHDRAWAL_RATE: 4,
  ANNUAL_SAVINGS: 20000,
  INFLATION: 2,
  CURRENT_AGE: 30,
  RETIREMENT_AGE: 65,
  RETIREMENT_DURATION: 30,
  SHOW_ADVANCED: false,
  VOLATILITY: 15,
  SIMULATION_COUNT: 1000,
} as const;

export const APP_DEFAULTS = {
  SIDEBAR_MIN_WIDTH: 240,
  SIDEBAR_MAX_WIDTH: 600,
  SIDEBAR_WIDTH: 320,
  FONT_SIZE: 0.9,
  LOCALE: "en-US",
  CURRENCY: "USD",
  THEME: "system",
  DATE_FORMAT: "YYYY-MM-DD",
  FIRST_DAY_OF_WEEK: 1,
  UI_LANGUAGE: "en",
} as const;

export interface SidebarVisibility {
  dashboard: boolean;
  investments: boolean;
  fire: boolean;
  rules: boolean;
  scheduled: boolean;
  all: boolean;
  chat: boolean;
  assets: boolean;
}

export const DEFAULT_SIDEBAR_VISIBILITY: SidebarVisibility = {
  dashboard: true,
  investments: true,
  fire: true,
  rules: true,
  scheduled: true,
  all: true,
  chat: true,
  assets: true,
};

export const RESETTABLE_STORAGE_KEYS: string[] = [
  STORAGE_KEYS.NUMBER_FORMAT,
  STORAGE_KEYS.CURRENCY,
  STORAGE_KEYS.THEME,
  STORAGE_KEYS.FONT_SIZE,
  STORAGE_KEYS.DATE_FORMAT,
  STORAGE_KEYS.FIRST_DAY_OF_WEEK,
  STORAGE_KEYS.UI_LANGUAGE,
  STORAGE_KEYS.SIDEBAR_VISIBILITY,
];

export const EXTERNAL_URLS: Record<string, string> = {
  GITHUB_REPO: "https://github.com/HoneyBearFolio/HoneyBear-Folio",
  WEBSITE: "https://honeybearfolio.github.io",
  BUY_ME_A_COFFEE: "https://buymeacoffee.com/bernatbc",
};

EXTERNAL_URLS.DOCS = `${EXTERNAL_URLS.WEBSITE}/docs`;
EXTERNAL_URLS.LICENSE = `${EXTERNAL_URLS.GITHUB_REPO}/blob/main/LICENSE`;

export const WEEKDAY_KEYS: readonly string[] = [
  "weekday.sunday",
  "weekday.monday",
  "weekday.tuesday",
  "weekday.wednesday",
  "weekday.thursday",
  "weekday.friday",
  "weekday.saturday",
];

export interface ScheduledFormState {
  id: number | null;
  accountId: number | null;
  transactionType: string;
  payee: string;
  amount: string | number;
  category: string;
  notes: string;
  currency: string;
  recurrenceType: string;
  intervalValue: number;
  intervalUnit: string;
  daysOfWeek: number[];
  ordinal: number;
  weekday: number;
  startDate: string;
  endDate: string;
  maxOccurrences: string | number;
  enabled: boolean;
  ticker: string;
  shares: string | number;
  pricePerShare: string | number;
  fee: string | number;
  isBuy: boolean;
}

export function createDefaultScheduledForm(): ScheduledFormState {
  return {
    id: null,
    accountId: null,
    transactionType: "regular",
    payee: "",
    amount: "",
    category: "",
    notes: "",
    currency: "",
    recurrenceType: "every_n",
    intervalValue: 1,
    intervalUnit: "month",
    daysOfWeek: [],
    ordinal: 1,
    weekday: 1,
    startDate: new Date().toISOString().split("T")[0] ?? "",
    endDate: "",
    maxOccurrences: "",
    enabled: true,
    ticker: "",
    shares: "",
    pricePerShare: "",
    fee: "",
    isBuy: true,
  };
}

export interface RuleCondition {
  field: string;
  operator: string;
  value: string;
  negated?: boolean;
}

export interface RuleAction {
  field: string;
  value: string;
}

export interface RuleFormState {
  id: number | null;
  priority: number;
  logic: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export const DEFAULT_RULE_CONDITION: RuleCondition = {
  field: "payee",
  operator: "equals",
  value: "",
  negated: false,
};

export const DEFAULT_RULE_ACTION: RuleAction = { field: "category", value: "" };

export function createDefaultRuleFormState(): RuleFormState {
  return {
    id: null,
    priority: 0,
    logic: "and",
    conditions: [{ ...DEFAULT_RULE_CONDITION }],
    actions: [{ ...DEFAULT_RULE_ACTION }],
  };
}
