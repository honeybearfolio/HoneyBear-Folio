import { useEffect } from "react";
import { useNumberFormatStore } from "../stores/number-format";
import i18n from "../i18n/i18n";

export function NumberFormatEffects() {
  const uiLanguage = useNumberFormatStore((s) => s.uiLanguage);

  useEffect(() => {
    i18n.changeLanguage(uiLanguage).catch((e) => {
      console.error("Failed to apply UI language:", e);
    });
  }, [uiLanguage]);

  return null;
}
