import { create } from "zustand";

export interface PrivacyState {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
}

export const usePrivacyStore = create<PrivacyState>((set) => ({
  isPrivacyMode: (() => {
    try {
      return localStorage.getItem("hb_privacy_mode") === "true";
    } catch {
      return false;
    }
  })(),
  togglePrivacyMode: () =>
    set((state) => {
      const next = !state.isPrivacyMode;
      try {
        localStorage.setItem("hb_privacy_mode", String(next));
      } catch {
        // ignore
      }
      return { isPrivacyMode: next };
    }),
}));

export function usePrivacy(): PrivacyState {
  return usePrivacyStore();
}
