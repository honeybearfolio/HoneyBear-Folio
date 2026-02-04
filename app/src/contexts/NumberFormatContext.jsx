import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { NumberFormatContext } from "./number-format";

export function NumberFormatProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    try {
      return localStorage.getItem("hb_number_format") || "en-US";
    } catch {
      return "en-US";
    }
  });

  const [currency, setCurrency] = useState(() => {
    try {
      return localStorage.getItem("hb_currency") || "USD";
    } catch {
      return "USD";
    }
  });

  const [dateFormat, setDateFormat] = useState(() => {
    try {
      return localStorage.getItem("hb_date_format") || "YYYY-MM-DD";
    } catch {
      return "YYYY-MM-DD";
    }
  });

  const [firstDayOfWeek, setFirstDayOfWeek] = useState(() => {
    try {
      const v = localStorage.getItem("hb_first_day_of_week");
      return v !== null ? parseInt(v, 10) : 1; // Default to Monday
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("hb_number_format", locale);
    } catch {
      // ignore
    }
  }, [locale]);

  useEffect(() => {
    try {
      localStorage.setItem("hb_currency", currency);
    } catch {
      // ignore
    }
  }, [currency]);

  useEffect(() => {
    try {
      localStorage.setItem("hb_date_format", dateFormat);
    } catch {
      // ignore
    }
  }, [dateFormat]);

  useEffect(() => {
    try {
      localStorage.setItem("hb_first_day_of_week", String(firstDayOfWeek));
    } catch {
      // ignore
    }
  }, [firstDayOfWeek]);

  // UI language (controls the translations used by the app). Default is English.
  const [uiLanguage, setUiLanguage] = useState(() => {
    try {
      return localStorage.getItem("hb_ui_language") || "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("hb_ui_language", uiLanguage);
    } catch {
      // ignore
    }
    // apply the UI language to the i18n runtime (lazy-loads when needed)
    // imported dynamically here to avoid circular import in some test setups
    (async () => {
      try {
        const i18n = await import("../i18n/i18n");
        if (i18n && typeof i18n.setLanguage === "function") {
          await i18n.setLanguage(uiLanguage);
        }
      } catch (e) {
        // don't block UI on language load failures
        // eslint-disable-next-line no-console
        console.error("Failed to apply UI language:", e);
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
      }}
    >
      {children}
    </NumberFormatContext.Provider>
  );
}

NumberFormatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
