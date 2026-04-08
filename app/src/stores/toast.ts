import { create } from "zustand";

type ToastType = "info" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface ToastState {
  toasts: Toast[];
  showToast: (
    message: string,
    options?: { type?: ToastType; duration?: number },
  ) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (
    message: string,
    {
      type = "info",
      duration = 4000,
    }: { type?: ToastType; duration?: number } = {},
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  removeToast: (id: string) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export interface ToastContextValue {
  showToast: (
    message: string,
    options?: { type?: ToastType; duration?: number },
  ) => void;
}

export function useToast(): ToastContextValue {
  const showToast = useToastStore((s) => s.showToast);
  return { showToast };
}
