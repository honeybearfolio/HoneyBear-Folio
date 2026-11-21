import { useCallback, useMemo } from "react";
import {
  getColorClasses,
  DEFAULT_COLOR,
  TRANSFER_DEFAULT_COLOR,
} from "../config/tag-colors";
import { STORAGE_KEYS } from "../constants/app";
import {
  usePortfolioPreferences,
  writePortfolioPreference,
} from "../stores/portfolio-preferences";

type TagColorMap = Record<string, string>;

function isTagColorMap(value: unknown): value is TagColorMap {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
}

function readFromStorage(raw: string | undefined): TagColorMap {
  try {
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
  writePortfolioPreference(STORAGE_KEYS.TAG_COLORS, JSON.stringify(map));
}

interface UseTagColorsReturn {
  tagColors: TagColorMap;
  setTagColor: (categoryName: string, colorKey: string) => void;
  removeTagColor: (categoryName: string) => void;
  resetAll: () => void;
  getTagClasses: (categoryName: string) => string;
}

export default function useTagColors(): UseTagColorsReturn {
  const raw = usePortfolioPreferences(
    (state) => state.values[STORAGE_KEYS.TAG_COLORS],
  );
  const tagColors = useMemo(() => readFromStorage(raw), [raw]);

  const setTagColor = useCallback((categoryName: string, colorKey: string) => {
    const current = readFromStorage(
      usePortfolioPreferences.getState().values[STORAGE_KEYS.TAG_COLORS],
    );
    writeToStorage({ ...current, [categoryName]: colorKey });
  }, []);

  const removeTagColor = useCallback((categoryName: string) => {
    const current = readFromStorage(
      usePortfolioPreferences.getState().values[STORAGE_KEYS.TAG_COLORS],
    );
    const { [categoryName]: _removed, ...next } = current;
    writeToStorage(next);
  }, []);

  const resetAll = useCallback(() => {
    writeToStorage({});
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
