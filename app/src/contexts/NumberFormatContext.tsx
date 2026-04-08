import { useEffect } from "react";
import { useNumberFormatStore } from "../stores/number-format";
import { setLanguage } from "../i18n/i18n";

export function NumberFormatEffects() {
  const uiLanguage = useNumberFormatStore((s) => s.uiLanguage);
  const bumpTranslationVersion = useNumberFormatStore(
    (s) => s.bumpTranslationVersion,
  );

  useEffect(() => {
    (async () => {
      try {
        await setLanguage(uiLanguage);
      } catch (e) {
        console.error("Failed to apply UI language:", e);
      } finally {
        bumpTranslationVersion();
      }
    })();
  }, [uiLanguage, bumpTranslationVersion]);

  return null;
}
