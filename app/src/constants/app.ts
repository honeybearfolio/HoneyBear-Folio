export const STORAGE_KEYS = {
  SIDEBAR_VISIBILITY: "hb_sidebar_visibility",
  CURRENCY: "hb_currency",
  FONT_SIZE: "hb_font_size",
  NUMBER_FORMAT: "hb_number_format",
  THEME: "hb_theme",
  DATE_FORMAT: "hb_date_format",
  FIRST_DAY_OF_WEEK: "hb_first_day_of_week",
  UI_LANGUAGE: "hb_ui_language",
  CHAT_THINK: "hb_chat_think",
};

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
};

export const DEFAULT_SIDEBAR_VISIBILITY = {
  dashboard: true,
  investments: true,
  fire: true,
  rules: true,
  scheduled: true,
  all: true,
  chat: true,
};

export const RESETTABLE_STORAGE_KEYS = [
  STORAGE_KEYS.NUMBER_FORMAT,
  STORAGE_KEYS.CURRENCY,
  STORAGE_KEYS.THEME,
  STORAGE_KEYS.FONT_SIZE,
  STORAGE_KEYS.DATE_FORMAT,
  STORAGE_KEYS.FIRST_DAY_OF_WEEK,
  STORAGE_KEYS.UI_LANGUAGE,
  STORAGE_KEYS.SIDEBAR_VISIBILITY,
];

export const EXTERNAL_URLS = {
  GITHUB_REPO: "https://github.com/HoneyBearFolio/HoneyBear-Folio",
  WEBSITE: "https://honeybearfolio.github.io",
};

EXTERNAL_URLS.DOCS = `${EXTERNAL_URLS.WEBSITE}/docs`;
EXTERNAL_URLS.LICENSE = `${EXTERNAL_URLS.GITHUB_REPO}/blob/main/LICENSE`;

export const WEEKDAY_KEYS = [
  "weekday.sunday",
  "weekday.monday",
  "weekday.tuesday",
  "weekday.wednesday",
  "weekday.thursday",
  "weekday.friday",
  "weekday.saturday",
];

export function createDefaultScheduledForm() {
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
    startDate: new Date().toISOString().split("T")[0],
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

export const DEFAULT_RULE_CONDITION = {
  field: "payee",
  operator: "equals",
  value: "",
  negated: false,
};

export const DEFAULT_RULE_ACTION = { field: "category", value: "" };

export function createDefaultRuleFormState() {
  return {
    id: null,
    priority: 0,
    logic: "and",
    conditions: [{ ...DEFAULT_RULE_CONDITION }],
    actions: [{ ...DEFAULT_RULE_ACTION }],
  };
}
