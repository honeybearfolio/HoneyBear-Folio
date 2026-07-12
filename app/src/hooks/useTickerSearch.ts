import { useState, useRef, useCallback, useEffect } from "react";
import { rust } from "../api/tauri-client";
import type { TickerSuggestion } from "../api/types";
import { logError } from "../utils/errors";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function useTickerSearch() {
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const clearSuggestions = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const searchTicker = useCallback((query: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const results = await rust.search_ticker({ query: trimmed });
          setSuggestions(results);
          if (results.length > 0) {
            setShowSuggestions(true);
          }
        } catch (error) {
          logError("Error fetching ticker suggestions", error);
        }
      })();
    }, DEBOUNCE_MS);
  }, []);

  return {
    suggestions,
    showSuggestions,
    setShowSuggestions,
    searchTicker,
    clearSuggestions,
  };
}
