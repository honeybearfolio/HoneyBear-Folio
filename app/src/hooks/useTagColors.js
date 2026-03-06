import { useState, useCallback } from "react";
import {
  getColorClasses,
  DEFAULT_COLOR,
  TRANSFER_DEFAULT_COLOR,
} from "../config/tag-colors";

const STORAGE_KEY = "hb_tag_colors";

function readFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeToStorage(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export default function useTagColors() {
  const [tagColors, setTagColors] = useState(readFromStorage);

  const setTagColor = useCallback((categoryName, colorKey) => {
    setTagColors((prev) => {
      const next = { ...prev, [categoryName]: colorKey };
      writeToStorage(next);
      return next;
    });
  }, []);

  const removeTagColor = useCallback((categoryName) => {
    setTagColors((prev) => {
      const next = { ...prev };
      delete next[categoryName];
      writeToStorage(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setTagColors({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const getTagClasses = useCallback(
    (categoryName) => {
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
