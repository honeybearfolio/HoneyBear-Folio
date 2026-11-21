import { create } from "zustand";
import { rust } from "../api/tauri-client";
import i18n from "../i18n/i18n";
import { handleAsyncError } from "../utils/errors";
import { useToastStore } from "./toast";

interface PortfolioPreferences {
  path: string | null;
  values: Record<string, string>;
}

export const usePortfolioPreferences = create<PortfolioPreferences>(() => ({
  path: null,
  values: {},
}));

interface WriteQueue {
  tail: Promise<void>;
  confirmed: string | undefined;
  sequence: number;
}

const pending = new Map<string, WriteQueue>();

export async function loadPortfolioPreferences(path: string): Promise<void> {
  await Promise.all([...pending.values()].map((queue) => queue.tail));
  const values = await rust.get_portfolio_preferences({ path });
  usePortfolioPreferences.setState({ path, values });
}

export function readPortfolioPreference(key: string): string | null {
  return usePortfolioPreferences.getState().values[key] ?? null;
}

export async function savePortfolioPreference(
  key: string,
  value: string,
): Promise<void> {
  const { path, values } = usePortfolioPreferences.getState();
  if (!path) {
    throw new Error("No portfolio is open");
  }
  const id = JSON.stringify([path, key]);
  const queue = pending.get(id) ?? {
    tail: Promise.resolve(),
    confirmed: values[key],
    sequence: 0,
  };
  const sequence = ++queue.sequence;
  usePortfolioPreferences.setState((state) => ({
    values: { ...state.values, [key]: value },
  }));
  const request = queue.tail
    .then(() => rust.set_portfolio_preference({ path, key, value }))
    .then(() => {
      queue.confirmed = value;
    });
  const settled = request.catch(() => {});
  queue.tail = settled;
  pending.set(id, queue);
  void settled.then(() => {
    if (pending.get(id) === queue && queue.tail === settled) pending.delete(id);
  });
  try {
    await request;
  } catch (error) {
    const state = usePortfolioPreferences.getState();
    if (state.path === path && queue.sequence === sequence) {
      const restored = Object.fromEntries(
        Object.entries(state.values).filter(([entry]) => entry !== key),
      );
      if (queue.confirmed !== undefined) restored[key] = queue.confirmed;
      usePortfolioPreferences.setState({ values: restored });
    }
    throw error;
  }
}

export function writePortfolioPreference(key: string, value: string): void {
  void savePortfolioPreference(key, value).catch((error: unknown) => {
    handleAsyncError({
      context: `Failed to save portfolio preference ${key}`,
      error,
      userMessage: i18n.t("error.failed_to_save"),
      toast: (message) =>
        useToastStore.getState().showToast(message, { type: "error" }),
    });
  });
}
