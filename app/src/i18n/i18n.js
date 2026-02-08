import en from "./en.json";

let current = en;
let currentLang = "en";

export function setLocale(localeObj) {
  current = localeObj;
}

export const AVAILABLE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export function getCurrentLanguage() {
  return currentLang;
}

export async function setLanguage(langCode) {
  if (!langCode || langCode === "en") {
    current = en;
    currentLang = "en";
    return;
  }

  // Use Vite's import.meta.glob so the bundler can analyze available locale files
  // and avoid the `vite:dynamic-import-vars` warning. This is tree-shakeable
  // and only includes files present in this directory (./*.json).
  const loaders = import.meta.glob("./*.json");
  const loader = loaders[`./${langCode}.json`];

  if (!loader) {
    console.warn(`Locale "${langCode}" not found — falling back to English`);
    current = en;
    currentLang = "en";
    return;
  }

  try {
    const mod = await loader();
    const localeObj = mod && mod.default ? mod.default : mod;
    setLocale(localeObj);
    currentLang = langCode;
  } catch (err) {
    // If loading fails, fall back to English and surface error in console
    // (don't throw so consumers remain resilient)

    console.error(`Failed to load locale ${langCode}:`, err);
    current = en;
    currentLang = "en";
  }
}

function interpolate(str, vars) {
  if (!vars) return str;
  return String(str).replace(/\{(.*?)\}/g, (_, k) => {
    return vars[k] === undefined ? `{${k}}` : String(vars[k]);
  });
}

export function t(key, vars) {
  // If the current locale provides a non-empty, non-placeholder value, use it.
  // Otherwise fall back to English (en.json) and finally the key as last resort.
  const val = current && current[key];
  const isValidTranslation =
    typeof val === "string" && val.length > 0 && val !== key;

  const s = isValidTranslation ? val : (en && en[key]) || key;
  return interpolate(s, vars);
}

export function useTranslation() {
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
