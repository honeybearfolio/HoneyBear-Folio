import React, { useEffect, useState } from "react";
import { ThemeContext } from "./theme-core";
import { rust } from "../api/tauri-client";
import { listen } from "@tauri-apps/api/event";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hb_theme") || "system";
    }
    return "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;

    const removeOldTheme = () => {
      root.classList.remove("dark");
      root.classList.remove("light");
      root.classList.remove("high-contrast");
      root.classList.remove("ink");
    };

    const applyTheme = (themeToApply: string) => {
      removeOldTheme();
      if (themeToApply === "dark") {
        root.classList.add("dark");
      } else if (themeToApply === "high-contrast-dark") {
        root.classList.add("dark");
        root.classList.add("high-contrast");
      } else if (themeToApply === "high-contrast-light") {
        root.classList.add("light");
        root.classList.add("high-contrast");
      } else if (themeToApply === "ink-light") {
        root.classList.add("light");
        root.classList.add("ink");
      } else if (themeToApply === "ink-dark") {
        root.classList.add("dark");
        root.classList.add("ink");
      } else if (themeToApply === "light") {
        root.classList.add("light"); // Optional, usually default
      }
    };

    if (theme === "system") {
      // First try the browser/media query (works on macOS/Windows and newer webviews)
      let mediaQuery: MediaQueryList | undefined;
      let handleChange: ((e: MediaQueryListEvent) => void) | undefined;
      if (typeof window.matchMedia === "function") {
        mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        applyTheme(mediaQuery.matches ? "dark" : "light");
        handleChange = (e) => {
          applyTheme(e.matches ? "dark" : "light");
        };
        try {
          mediaQuery.addEventListener("change", handleChange);
        } catch {
          // Some older webviews only support addListener
          try {
            mediaQuery.addListener(handleChange);
          } catch {
            /* ignore */
          }
        }
      }

      // Also ask the backend for the system theme (Linux/older webviews may report wrong prefers-color-scheme)
      (async () => {
        try {
          const sys = await rust.get_system_theme({});
          if (sys === "dark" || sys === "light") {
            applyTheme(sys);
          }
        } catch (err) {
          // ignore failures and rely on media query
          console.debug("get_system_theme failed:", err);
        }
      })();

      let unlistenFn: (() => void) | undefined;
      listen("system-theme-changed", (event: { payload: unknown }) => {
        const sys = event.payload;
        if (sys === "dark" || sys === "light") {
          applyTheme(sys);
        }
      }).then((fn) => {
        unlistenFn = fn;
      });

      return () => {
        if (mediaQuery && handleChange) {
          try {
            mediaQuery.removeEventListener("change", handleChange);
          } catch {
            try {
              mediaQuery.removeListener(handleChange);
            } catch {
              /* ignore */
            }
          }
        }
        if (unlistenFn) unlistenFn();
      };
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: string) => {
      setTheme(newTheme);
      localStorage.setItem("hb_theme", newTheme);
    },
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
