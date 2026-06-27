import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import es from "./es.json";
import { APP_DEFAULTS, STORAGE_KEYS } from "../constants/app";

interface LanguageOption {
  code: string;
  label: string;
}

export const AVAILABLE_LANGUAGES: readonly LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: readLS(STORAGE_KEYS.UI_LANGUAGE, APP_DEFAULTS.UI_LANGUAGE),
  fallbackLng: "en",
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
});

export default i18n;
