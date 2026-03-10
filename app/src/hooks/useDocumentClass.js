import { useLayoutEffect, useState } from "react";

export default function useDocumentClass(className) {
  const [hasClass, setHasClass] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains(className);
    }
    return false;
  });

  useLayoutEffect(() => {
    const syncClassState = () =>
      setHasClass(document.documentElement.classList.contains(className));

    syncClassState();

    const observer = new MutationObserver(syncClassState);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [className]);

  return hasClass;
}
