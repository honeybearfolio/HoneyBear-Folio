import { createContext, useContext } from "react";

export interface PrivacyContextValue {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
}

export const PrivacyContext = createContext<PrivacyContextValue>({
  isPrivacyMode: false,
  togglePrivacyMode: () => {},
});

export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
