import { APP_DEFAULTS, STORAGE_KEYS } from "../constants/app";
import { CURRENCIES } from "./currencies";

export interface SystemPreferences {
  uiLanguage: string;
  locale: string;
  currency: string;
  dateFormat: string;
  firstDayOfWeek: number;
}

const SUPPORTED_NUMBER_LOCALES = [
  "en-US",
  "de-DE",
  "fr-FR",
  "de-CH",
  "en-IN",
] as const;

const NUMERIC_DATE_FORMATS: Record<string, string> = {
  "Y-M-D|-": "YYYY-MM-DD",
  "Y-M-D|/": "YYYY/MM/DD",
  "M-D-Y|/": "MM/DD/YYYY",
  "D-M-Y|/": "DD/MM/YYYY",
  "D-M-Y|-": "DD-MM-YYYY",
  "D-M-Y|.": "DD.MM.YYYY",
};

const DATE_ORDER_FALLBACK: Record<string, string> = {
  "Y-M-D": "YYYY-MM-DD",
  "M-D-Y": "MM/DD/YYYY",
  "D-M-Y": "DD/MM/YYYY",
};

/** Primary currency for a region. Unknown regions fall back to USD. */
const REGION_CURRENCIES: Record<string, string> = {
  AD: "EUR",
  AE: "AED",
  AF: "AFN",
  AG: "XCD",
  AL: "ALL",
  AM: "AMD",
  AO: "AOA",
  AR: "ARS",
  AS: "USD",
  AT: "EUR",
  AU: "AUD",
  AW: "AWG",
  AX: "EUR",
  AZ: "AZN",
  BA: "BAM",
  BB: "BBD",
  BD: "BDT",
  BE: "EUR",
  BF: "XOF",
  BG: "EUR",
  BH: "BHD",
  BI: "BIF",
  BJ: "XOF",
  BL: "EUR",
  BM: "BMD",
  BN: "BND",
  BO: "BOB",
  BQ: "USD",
  BR: "BRL",
  BS: "BSD",
  BT: "BTN",
  BW: "BWP",
  BY: "BYN",
  BZ: "BZD",
  CA: "CAD",
  CD: "CDF",
  CF: "XAF",
  CG: "XAF",
  CH: "CHF",
  CI: "XOF",
  CL: "CLP",
  CM: "XAF",
  CN: "CNY",
  CO: "COP",
  CR: "CRC",
  CU: "CUP",
  CV: "CVE",
  CW: "ANG",
  CY: "EUR",
  CZ: "CZK",
  DE: "EUR",
  DJ: "DJF",
  DK: "DKK",
  DM: "XCD",
  DO: "DOP",
  DZ: "DZD",
  EC: "USD",
  EE: "EUR",
  EG: "EGP",
  ER: "ERN",
  ES: "EUR",
  ET: "ETB",
  FI: "EUR",
  FJ: "FJD",
  FK: "FKP",
  FM: "USD",
  FO: "DKK",
  FR: "EUR",
  GA: "XAF",
  GB: "GBP",
  GD: "XCD",
  GE: "GEL",
  GF: "EUR",
  GG: "GBP",
  GH: "GHS",
  GI: "GIP",
  GL: "DKK",
  GM: "GMD",
  GN: "GNF",
  GP: "EUR",
  GQ: "XAF",
  GR: "EUR",
  GT: "GTQ",
  GU: "USD",
  GW: "XOF",
  GY: "GYD",
  HK: "HKD",
  HN: "HNL",
  HR: "EUR",
  HT: "HTG",
  HU: "HUF",
  ID: "IDR",
  IE: "EUR",
  IL: "ILS",
  IM: "GBP",
  IN: "INR",
  IQ: "IQD",
  IR: "IRR",
  IS: "ISK",
  IT: "EUR",
  JE: "GBP",
  JM: "JMD",
  JO: "JOD",
  JP: "JPY",
  KE: "KES",
  KG: "KGS",
  KH: "KHR",
  KM: "KMF",
  KN: "XCD",
  KP: "KPW",
  KR: "KRW",
  KW: "KWD",
  KY: "KYD",
  KZ: "KZT",
  LA: "LAK",
  LB: "LBP",
  LC: "XCD",
  LI: "CHF",
  LK: "LKR",
  LR: "LRD",
  LS: "LSL",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  LY: "LYD",
  MA: "MAD",
  MC: "EUR",
  MD: "MDL",
  ME: "EUR",
  MF: "EUR",
  MG: "MGA",
  MH: "USD",
  MK: "MKD",
  ML: "XOF",
  MM: "MMK",
  MN: "MNT",
  MO: "MOP",
  MP: "USD",
  MQ: "EUR",
  MR: "MRU",
  MT: "EUR",
  MU: "MUR",
  MV: "MVR",
  MW: "MWK",
  MX: "MXN",
  MY: "MYR",
  MZ: "MZN",
  NA: "NAD",
  NC: "XPF",
  NE: "XOF",
  NG: "NGN",
  NI: "NIO",
  NL: "EUR",
  NO: "NOK",
  NP: "NPR",
  NZ: "NZD",
  OM: "OMR",
  PA: "PAB",
  PE: "PEN",
  PF: "XPF",
  PG: "PGK",
  PH: "PHP",
  PK: "PKR",
  PL: "PLN",
  PM: "EUR",
  PR: "USD",
  PS: "ILS",
  PT: "EUR",
  PW: "USD",
  PY: "PYG",
  QA: "QAR",
  RE: "EUR",
  RO: "RON",
  RS: "RSD",
  RU: "RUB",
  RW: "RWF",
  SA: "SAR",
  SB: "SBD",
  SC: "SCR",
  SD: "SDG",
  SE: "SEK",
  SG: "SGD",
  SH: "SHP",
  SI: "EUR",
  SK: "EUR",
  SL: "SLL",
  SM: "EUR",
  SN: "XOF",
  SO: "SOS",
  SR: "SRD",
  SS: "SSP",
  ST: "STN",
  SV: "USD",
  SX: "ANG",
  SY: "SYP",
  SZ: "SZL",
  TC: "USD",
  TD: "XAF",
  TG: "XOF",
  TH: "THB",
  TJ: "TJS",
  TL: "USD",
  TM: "TMT",
  TN: "TND",
  TO: "TOP",
  TR: "TRY",
  TT: "TTD",
  TW: "TWD",
  TZ: "TZS",
  UA: "UAH",
  UG: "UGX",
  UM: "USD",
  US: "USD",
  UY: "UYU",
  UZ: "UZS",
  VA: "EUR",
  VC: "XCD",
  VE: "VES",
  VG: "USD",
  VI: "USD",
  VN: "VND",
  VU: "VUV",
  WF: "XPF",
  WS: "WST",
  XK: "EUR",
  YE: "YER",
  YT: "EUR",
  ZA: "ZAR",
  ZM: "ZMW",
  ZW: "ZWL",
};

const KNOWN_CURRENCIES = new Set(CURRENCIES.map((currency) => currency.code));

const DATE_FIELDS = new Set(["day", "month", "year"]);

function builtinPreferences(): SystemPreferences {
  return {
    uiLanguage: APP_DEFAULTS.UI_LANGUAGE,
    locale: APP_DEFAULTS.LOCALE,
    currency: APP_DEFAULTS.CURRENCY,
    dateFormat: APP_DEFAULTS.DATE_FORMAT,
    firstDayOfWeek: APP_DEFAULTS.FIRST_DAY_OF_WEEK,
  };
}

function normalizeGroup(group: string): string {
  return /\s/u.test(group) ? " " : group;
}

interface NumberSignature {
  decimal: string;
  group: string;
  widths: string;
}

function numberSignature(locale: string): NumberSignature | null {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.89);
    const decimal = parts.find((part) => part.type === "decimal")?.value ?? "";
    const group = normalizeGroup(
      parts.find((part) => part.type === "group")?.value ?? "",
    );
    const widths = parts
      .filter((part) => part.type === "integer")
      .map((part) => String(part.value.length))
      .join(",");
    return { decimal, group, widths };
  } catch {
    return null;
  }
}

function matchNumberLocale(languageTag: string): string {
  const target = numberSignature(languageTag);
  if (!target) return APP_DEFAULTS.LOCALE;

  for (const candidate of SUPPORTED_NUMBER_LOCALES) {
    const signature = numberSignature(candidate);
    if (
      signature &&
      signature.decimal === target.decimal &&
      signature.group === target.group &&
      signature.widths === target.widths
    ) {
      return candidate;
    }
  }

  return APP_DEFAULTS.LOCALE;
}

function fieldOrder(type: string): string {
  if (type === "year") return "Y";
  if (type === "month") return "M";
  if (type === "day") return "D";
  return "";
}

function separatorBetween(parts: Intl.DateTimeFormatPart[]): string {
  let seenFields = 0;
  let literal = "";
  for (const part of parts) {
    if (DATE_FIELDS.has(part.type)) {
      seenFields += 1;
      if (seenFields === 2) break;
      continue;
    }
    if (seenFields === 1 && part.type === "literal") {
      literal += part.value;
    }
  }
  return literal.match(/[./-]/)?.[0] ?? "";
}

function namedDateFormat(
  languageTag: string,
  order: string,
  monthValue: string,
): string {
  const probe = new Date(2026, 10, 7);
  try {
    const longName = new Intl.DateTimeFormat(languageTag, {
      month: "long",
    }).format(probe);
    const shortName = new Intl.DateTimeFormat(languageTag, {
      month: "short",
    }).format(probe);
    const isLong = monthValue === longName && monthValue !== shortName;
    if (order === "M-D-Y") return isLong ? "MMMM D, YYYY" : "MMM DD, YYYY";
    if (order === "D-M-Y") return "DD MMM YYYY";
  } catch {
    return APP_DEFAULTS.DATE_FORMAT;
  }
  return APP_DEFAULTS.DATE_FORMAT;
}

function detectDateFormat(languageTag: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat(languageTag).formatToParts(
      new Date(2026, 10, 7),
    );
  } catch {
    return APP_DEFAULTS.DATE_FORMAT;
  }

  const fields = parts.filter((part) => DATE_FIELDS.has(part.type));
  if (fields.length < 3) return APP_DEFAULTS.DATE_FORMAT;

  const order = fields.map((part) => fieldOrder(part.type)).join("-");
  const month = fields.find((part) => part.type === "month");
  if (month && !/^\p{Nd}+$/u.test(month.value)) {
    return namedDateFormat(languageTag, order, month.value);
  }

  const separator = separatorBetween(parts);
  return (
    NUMERIC_DATE_FORMATS[`${order}|${separator}`] ??
    DATE_ORDER_FALLBACK[order] ??
    APP_DEFAULTS.DATE_FORMAT
  );
}

interface WeekInfo {
  firstDay: number;
}

function readWeekInfo(locale: Intl.Locale): WeekInfo | undefined {
  const withInfo = locale as Intl.Locale & {
    weekInfo?: WeekInfo;
    getWeekInfo?: () => WeekInfo;
  };
  if (typeof withInfo.weekInfo?.firstDay === "number") return withInfo.weekInfo;
  if (typeof withInfo.getWeekInfo !== "function") return undefined;
  try {
    return withInfo.getWeekInfo();
  } catch {
    return undefined;
  }
}

function detectFirstDay(languageTag: string): number {
  try {
    const info = readWeekInfo(new Intl.Locale(languageTag));
    const day = info?.firstDay;
    if (
      typeof day !== "number" ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 7
    ) {
      return APP_DEFAULTS.FIRST_DAY_OF_WEEK;
    }
    return day === 7 ? 0 : day;
  } catch {
    return APP_DEFAULTS.FIRST_DAY_OF_WEEK;
  }
}

function detectCurrency(languageTag: string): string {
  try {
    const region = new Intl.Locale(languageTag).maximize().region;
    if (!region) return APP_DEFAULTS.CURRENCY;
    const code = REGION_CURRENCIES[region];
    if (!code || !KNOWN_CURRENCIES.has(code)) return APP_DEFAULTS.CURRENCY;
    return code;
  } catch {
    return APP_DEFAULTS.CURRENCY;
  }
}

function detectUiLanguage(languageTag: string): string {
  const base = languageTag.split("-")[0]?.toLowerCase() ?? "";
  return base === "es" ? "es" : APP_DEFAULTS.UI_LANGUAGE;
}

export function detectSystemPreferences(
  languageTag: string,
): SystemPreferences {
  const tag = languageTag.trim();
  if (!tag) return builtinPreferences();

  try {
    new Intl.NumberFormat(tag);
  } catch {
    return builtinPreferences();
  }

  return {
    uiLanguage: detectUiLanguage(tag),
    locale: matchNumberLocale(tag),
    currency: detectCurrency(tag),
    dateFormat: detectDateFormat(tag),
    firstDayOfWeek: detectFirstDay(tag),
  };
}

function writeIfAbsent(key: string, value: string): void {
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, value);
  }
}

/**
 * On a fresh install, persist locale-derived preferences and mark first run
 * complete. Existing installs (and any key already stored) are left alone.
 */
export function applySystemPreferencesIfNeeded(): void {
  if (typeof navigator === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    if (localStorage.getItem(STORAGE_KEYS.FIRST_RUN_COMPLETED)) return;

    const prefs = detectSystemPreferences(navigator.language || "");
    writeIfAbsent(STORAGE_KEYS.UI_LANGUAGE, prefs.uiLanguage);
    writeIfAbsent(STORAGE_KEYS.NUMBER_FORMAT, prefs.locale);
    writeIfAbsent(STORAGE_KEYS.CURRENCY, prefs.currency);
    writeIfAbsent(STORAGE_KEYS.DATE_FORMAT, prefs.dateFormat);
    writeIfAbsent(STORAGE_KEYS.FIRST_DAY_OF_WEEK, String(prefs.firstDayOfWeek));
    localStorage.setItem(STORAGE_KEYS.FIRST_RUN_COMPLETED, "true");
  } catch {
    // localStorage can throw in private or restricted contexts
  }
}
