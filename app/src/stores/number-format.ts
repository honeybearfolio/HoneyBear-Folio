import { create } from "zustand";

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
  locale: readLS("hb_number_format", "en-US"),
  setLocale: (v: string) => {
    writeLS("hb_number_format", v);
    set({ locale: v });
  },
  currency: readLS("hb_currency", "USD"),
  setCurrency: (v: string) => {
    writeLS("hb_currency", v);
    set({ currency: v });
  },
  dateFormat: readLS("hb_date_format", "YYYY-MM-DD"),
  setDateFormat: (v: string) => {
    writeLS("hb_date_format", v);
    set({ dateFormat: v });
  },
  firstDayOfWeek: readLSNumber("hb_first_day_of_week", 1),
  setFirstDayOfWeek: (v: number) => {
    writeLS("hb_first_day_of_week", String(v));
    set({ firstDayOfWeek: v });
  },
  uiLanguage: readLS("hb_ui_language", "en"),
  setUiLanguage: (v: string) => {
    writeLS("hb_ui_language", v);
    set({ uiLanguage: v });
  },
}));

export function useNumberFormat(): NumberFormatState {
  return useNumberFormatStore();
}
