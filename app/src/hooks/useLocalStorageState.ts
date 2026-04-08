import { useEffect, useState, Dispatch, SetStateAction } from "react";

function resolveDefault<T>(defaultValue: T | (() => T)): T {
  return typeof defaultValue === "function"
    ? (defaultValue as () => T)()
    : defaultValue;
}

export default function useLocalStorageState<T>(
  key: string,
  defaultValue: T | (() => T),
  deserialize: (value: string) => T = (value) => value as unknown as T,
  serialize: (value: T) => string = String,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
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
