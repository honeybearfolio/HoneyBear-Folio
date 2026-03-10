import { useEffect, useState } from "react";

function resolveDefault(defaultValue) {
  return typeof defaultValue === "function" ? defaultValue() : defaultValue;
}

export default function useLocalStorageState(
  key,
  defaultValue,
  deserialize = (value) => value,
  serialize = String,
) {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return resolveDefault(defaultValue);
    }

    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue === null) {
        return resolveDefault(defaultValue);
      }

      return deserialize(storedValue);
    } catch {
      return resolveDefault(defaultValue);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(state));
    } catch {
      // ignore localStorage failures in unsupported/private contexts
    }
  }, [key, serialize, state]);

  return [state, setState];
}
