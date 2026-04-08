import React, { useState, useEffect } from "react";
import { PrivacyContext } from "./privacy";

interface PrivacyProviderProps {
  children: React.ReactNode;
}

export function PrivacyProvider({ children }: PrivacyProviderProps) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    try {
      return localStorage.getItem("hb_privacy_mode") === "true";
    } catch {
      return false;
    }
  });

  const togglePrivacyMode = () => {
    setIsPrivacyMode((prev) => !prev);
  };

  useEffect(() => {
    try {
      localStorage.setItem("hb_privacy_mode", String(isPrivacyMode));
    } catch {
      // ignore
    }
  }, [isPrivacyMode]);

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyContext.Provider>
  );
}
