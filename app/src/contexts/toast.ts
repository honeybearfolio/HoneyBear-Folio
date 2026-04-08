import { createContext, useContext } from "react";

type ToastType = "info" | "success" | "error";

export interface ToastContextValue {
  showToast: (message: string, options?: { type?: ToastType; duration?: number }) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // If there's no provider (e.g., in isolated tests), return a safe noop implementation
  if (!ctx) return { showToast: () => {} };
  return ctx;
}
