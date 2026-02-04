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

  try {
    // lazy-load language file to keep initial bundle small
    const mod = await import(`./${langCode}.json`);
    const localeObj = mod && mod.default ? mod.default : mod;
    setLocale(localeObj);
    currentLang = langCode;
  } catch (err) {
    // If loading fails, fall back to English and surface error in console
    // (don't throw so consumers remain resilient)
    // eslint-disable-next-line no-console
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
  const s = (current && current[key]) || key;
  return interpolate(s, vars);
}

export function useTranslation() {
  return { t };
}

export default { t, setLocale, useTranslation, setLanguage, getCurrentLanguage, AVAILABLE_LANGUAGES };
