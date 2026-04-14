import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { create } from "zustand";
import { rust } from "../api/tauri-client";

export interface ThemeState {
  theme: string;
  setTheme: (newTheme: string) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hb_theme") || "system";
    }
    return "system";
  })(),
  setTheme: (newTheme: string) => {
    localStorage.setItem("hb_theme", newTheme);
    set({ theme: newTheme });
  },
}));

export function useTheme(): ThemeState {
  return useThemeStore();
}

export function ThemeEffects() {
  const theme = useThemeStore((s) => s.theme);

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
        root.classList.add("light");
      }
    };

    if (theme === "system") {
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
          try {
            mediaQuery.addListener(handleChange);
          } catch {
            /* ignore */
          }
        }
      }

      (async () => {
        try {
          const sys = await rust.get_system_theme();
          if (sys === "dark" || sys === "light") {
            applyTheme(sys);
          }
        } catch (err) {
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

  return null;
}
