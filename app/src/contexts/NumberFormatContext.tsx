import React, { useState, useEffect } from "react";
import { NumberFormatContext } from "./number-format";
import useLocalStorageState from "../hooks/useLocalStorageState";
import { setLanguage } from "../i18n/i18n";

const parseFirstDayOfWeek = (value: string): number => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
};

interface NumberFormatProviderProps {
  children: React.ReactNode;
}

export function NumberFormatProvider({ children }: NumberFormatProviderProps) {
  const [locale, setLocale] = useLocalStorageState<string>(
    "hb_number_format",
    "en-US",
  );
  const [currency, setCurrency] = useLocalStorageState<string>(
    "hb_currency",
    "USD",
  );
  const [dateFormat, setDateFormat] = useLocalStorageState<string>(
    "hb_date_format",
    "YYYY-MM-DD",
  );
  const [firstDayOfWeek, setFirstDayOfWeek] = useLocalStorageState<number>(
    "hb_first_day_of_week",
    1,
    parseFirstDayOfWeek,
  );

  // UI language (controls the translations used by the app). Default is English.
  const [uiLanguage, setUiLanguage] = useLocalStorageState<string>(
    "hb_ui_language",
    "en",
  );

  // small counter used only to force a provider re-render after async
  // language resources finish loading so components that call `t()`
  // during render pick up the new locale object.
  const [translationVersion, setTranslationVersion] = useState(0);

  useEffect(() => {
    // apply the UI language to the i18n runtime (lazy-loads locale JSON when needed)
    (async () => {
      try {
        await setLanguage(uiLanguage);
      } catch (e) {
        // don't block UI on language load failures

        console.error("Failed to apply UI language:", e);
      } finally {
        // Ensure the provider (and therefore the app subtree) re-renders
        // after the async language load completes (success or fallback).
        setTranslationVersion((v) => v + 1);
      }
    })();
  }, [uiLanguage]);

  return (
    <NumberFormatContext.Provider
      value={{
        locale,
        setLocale,
        currency,
        setCurrency,
        dateFormat,
        setDateFormat,
        firstDayOfWeek,
        setFirstDayOfWeek,
        uiLanguage,
        setUiLanguage,
        translationVersion,
      }}
    >
      {children}
    </NumberFormatContext.Provider>
  );
}
