import { create } from "zustand";

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
