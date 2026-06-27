import { create } from "zustand";
import { useEffect } from "react";
import i18n from "../i18n/i18n";
import { APP_DEFAULTS, STORAGE_KEYS } from "../constants/app";

export interface NumberFormatState {
  locale: string;
  setLocale: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  dateFormat: string;
  setDateFormat: (v: string) => void;
  firstDayOfWeek: number;
  setFirstDayOfWeek: (v: number) => void;
  uiLanguage: string;
  setUiLanguage: (v: string) => void;
}

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function readLSNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const parsed = parseInt(v, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export const useNumberFormatStore = create<NumberFormatState>((set) => ({
  locale: readLS(STORAGE_KEYS.NUMBER_FORMAT, APP_DEFAULTS.LOCALE),
  setLocale: (v: string) => {
    writeLS(STORAGE_KEYS.NUMBER_FORMAT, v);
    set({ locale: v });
  },
  currency: readLS(STORAGE_KEYS.CURRENCY, APP_DEFAULTS.CURRENCY),
  setCurrency: (v: string) => {
    writeLS(STORAGE_KEYS.CURRENCY, v);
    set({ currency: v });
  },
  dateFormat: readLS(STORAGE_KEYS.DATE_FORMAT, APP_DEFAULTS.DATE_FORMAT),
  setDateFormat: (v: string) => {
    writeLS(STORAGE_KEYS.DATE_FORMAT, v);
    set({ dateFormat: v });
  },
  firstDayOfWeek: readLSNumber(
    STORAGE_KEYS.FIRST_DAY_OF_WEEK,
    APP_DEFAULTS.FIRST_DAY_OF_WEEK,
  ),
  setFirstDayOfWeek: (v: number) => {
    writeLS(STORAGE_KEYS.FIRST_DAY_OF_WEEK, String(v));
    set({ firstDayOfWeek: v });
  },
  uiLanguage: readLS(STORAGE_KEYS.UI_LANGUAGE, APP_DEFAULTS.UI_LANGUAGE),
  setUiLanguage: (v: string) => {
    writeLS(STORAGE_KEYS.UI_LANGUAGE, v);
    set({ uiLanguage: v });
  },
}));

export function useNumberFormat(): NumberFormatState {
  return useNumberFormatStore();
}

export function NumberFormatEffects() {
  const uiLanguage = useNumberFormatStore((s) => s.uiLanguage);

  useEffect(() => {
    i18n.changeLanguage(uiLanguage).catch((e: unknown) => {
      console.error("Failed to apply UI language:", e);
    });
  }, [uiLanguage]);

  return null;
}
