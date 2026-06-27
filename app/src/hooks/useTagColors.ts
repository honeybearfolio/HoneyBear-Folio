import { useState, useCallback } from "react";
import {
  getColorClasses,
  DEFAULT_COLOR,
  TRANSFER_DEFAULT_COLOR,
} from "../config/tag-colors";
import { STORAGE_KEYS } from "../constants/app";

type TagColorMap = Record<string, string>;

function isTagColorMap(value: unknown): value is TagColorMap {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
}

function readFromStorage(): TagColorMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAG_COLORS);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return isTagColorMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeToStorage(map: TagColorMap): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TAG_COLORS, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

interface UseTagColorsReturn {
  tagColors: TagColorMap;
  setTagColor: (categoryName: string, colorKey: string) => void;
  removeTagColor: (categoryName: string) => void;
  resetAll: () => void;
  getTagClasses: (categoryName: string) => string;
}

export default function useTagColors(): UseTagColorsReturn {
  const [tagColors, setTagColors] = useState<TagColorMap>(readFromStorage);

  const setTagColor = useCallback((categoryName: string, colorKey: string) => {
    setTagColors((prev) => {
      const next = { ...prev, [categoryName]: colorKey };
      writeToStorage(next);
      return next;
    });
  }, []);

  const removeTagColor = useCallback((categoryName: string) => {
    setTagColors((prev) => {
      const { [categoryName]: _removed, ...next } = prev;
      writeToStorage(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setTagColors({});
    try {
      localStorage.removeItem(STORAGE_KEYS.TAG_COLORS);
    } catch {
      /* ignore */
    }
  }, []);

  const getTagClasses = useCallback(
    (categoryName: string): string => {
      if (!categoryName) return getColorClasses(DEFAULT_COLOR);

      const assigned = tagColors[categoryName];
      if (assigned) return getColorClasses(assigned);

      // Default: purple for Transfer, slate for everything else
      if (categoryName === "Transfer") {
        return getColorClasses(TRANSFER_DEFAULT_COLOR);
      }
      return getColorClasses(DEFAULT_COLOR);
    },
    [tagColors],
  );

  return { tagColors, setTagColor, removeTagColor, resetAll, getTagClasses };
}
