import en from "./en.json";

type LocaleMap = Record<string, string>;

let current: LocaleMap = en as LocaleMap;
let currentLang: string = "en";

export function setLocale(localeObj: LocaleMap): void {
  current = localeObj;
}

interface LanguageOption {
  code: string;
  label: string;
}

export const AVAILABLE_LANGUAGES: readonly LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export function getCurrentLanguage(): string {
  return currentLang;
}

export async function setLanguage(
  langCode: string | null | undefined,
): Promise<void> {
  if (!langCode || langCode === "en") {
    current = en as LocaleMap;
    currentLang = "en";
    return;
  }

  // Use Vite's import.meta.glob so the bundler can analyze available locale files
  // and avoid the `vite:dynamic-import-vars` warning. This is tree-shakeable
  // and only includes files present in this directory (./*.json).
  const loaders = import.meta.glob(["./*.json", "!./en.json"]) as Record<
    string,
    () => Promise<{ default?: LocaleMap } & LocaleMap>
  >;
  const loader = loaders[`./${langCode}.json`];

  if (!loader) {
    console.warn(`Locale "${langCode}" not found — falling back to English`);
    current = en as LocaleMap;
    currentLang = "en";
    return;
  }

  try {
    const mod = await loader();
    const localeObj: LocaleMap =
      mod && mod.default ? mod.default : (mod as unknown as LocaleMap);
    setLocale(localeObj);
    currentLang = langCode;
  } catch (err: unknown) {
    // If loading fails, fall back to English and surface error in console
    // (don't throw so consumers remain resilient)

    console.error(`Failed to load locale ${langCode}:`, err);
    current = en as LocaleMap;
    currentLang = "en";
  }
}

function interpolate(str: string, vars?: Record<string, unknown>): string {
  if (!vars) return str;
  return String(str).replace(/\{(.*?)\}/g, (_, k: string) => {
    return vars[k] === undefined ? `{${k}}` : String(vars[k]);
  });
}

export function t(key: string, vars?: Record<string, unknown>): string {
  // If the current locale provides a non-empty, non-placeholder value, use it.
  // Otherwise fall back to English (en.json) and finally the key as last resort.
  const val = current && current[key];
  const isValidTranslation =
    typeof val === "string" && val.length > 0 && val !== key;

  const enMap = en as LocaleMap;
  const s = isValidTranslation ? val : (enMap && enMap[key]) || key;
  return interpolate(s, vars);
}

export function useTranslation(): { t: typeof t } {
  return { t };
}

export default {
  t,
  setLocale,
  useTranslation,
  setLanguage,
  getCurrentLanguage,
  AVAILABLE_LANGUAGES,
};
