import { create } from "zustand";

type ConfirmKind = "info" | "warning" | "error";

export interface ConfirmOptions {
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: ConfirmKind;
  showCancel?: boolean;
}

export interface ConfirmState {
  isOpen: boolean;
  message: string;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  handleClose: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  message: "",
  options: {},
  resolve: null,
  confirm: (message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, message, options, resolve });
    });
  },
  handleClose: (result: boolean) => {
    const { resolve } = get();
    set({ isOpen: false, resolve: null });
    if (resolve) resolve(result);
  },
}));

export function useConfirm(): (
  message: string,
  options?: ConfirmOptions,
) => Promise<boolean> {
  return useConfirmStore((s) => s.confirm);
}
