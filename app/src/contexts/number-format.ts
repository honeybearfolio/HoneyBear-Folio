import { createContext, useContext } from "react";

export interface NumberFormatContextValue {
  locale: string;
  setLocale: React.Dispatch<React.SetStateAction<string>>;
  currency: string;
  setCurrency: React.Dispatch<React.SetStateAction<string>>;
  dateFormat: string;
  setDateFormat: React.Dispatch<React.SetStateAction<string>>;
  firstDayOfWeek: number;
  setFirstDayOfWeek: React.Dispatch<React.SetStateAction<number>>;
  uiLanguage: string;
  setUiLanguage: React.Dispatch<React.SetStateAction<string>>;
  translationVersion: number;
}

export const NumberFormatContext =
  createContext<NumberFormatContextValue | null>(null);

export function useNumberFormat(): NumberFormatContextValue {
  const ctx = useContext(NumberFormatContext);
  if (!ctx) {
    throw new Error("useNumberFormat must be used within NumberFormatProvider");
  }
  return ctx;
}
