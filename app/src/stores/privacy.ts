import { create } from "zustand";
import { STORAGE_KEYS } from "../constants/app";

export interface PrivacyState {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
}

export const usePrivacyStore = create<PrivacyState>((set) => ({
  isPrivacyMode: (() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.PRIVACY_MODE) === "true";
    } catch {
      return false;
    }
  })(),
  togglePrivacyMode: () =>
    set((state) => {
      const next = !state.isPrivacyMode;
      try {
        localStorage.setItem(STORAGE_KEYS.PRIVACY_MODE, String(next));
      } catch {
        // ignore
      }
      return { isPrivacyMode: next };
    }),
}));

export function usePrivacy(): PrivacyState {
  return usePrivacyStore();
}
