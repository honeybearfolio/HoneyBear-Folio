import { useState, useLayoutEffect } from "react";

export default function useIsHighContrast() {
  const [isHighContrast, setIsHighContrast] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("high-contrast");
    }
    return false;
  });

  useLayoutEffect(() => {
    const check = () =>
      setIsHighContrast(
        document.documentElement.classList.contains("high-contrast"),
      );

    check();

    const observer = new MutationObserver(() => {
      check();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return isHighContrast;
}
