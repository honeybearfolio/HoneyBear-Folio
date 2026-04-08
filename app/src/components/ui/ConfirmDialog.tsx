import { useState, useCallback, useRef } from "react";
import { ConfirmContext } from "../../contexts/confirm";
import { t } from "../../i18n/i18n";
import "../../styles/Modal.css";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";

type ConfirmKind = "info" | "warning" | "error";

interface ConfirmOptions {
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: ConfirmKind;
  showCancel?: boolean;
}

interface ConfirmState {
  message: string;
  title: string;
  okLabel: string;
  cancelLabel: string;
  kind: ConfirmKind;
  showCancel?: boolean;
}

interface ConfirmDialogProviderProps {
  children: React.ReactNode;
}

export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmState>({
    message: "",
    title: t("confirm.title"),
    okLabel: t("confirm.ok"),
    cancelLabel: t("account.cancel"),
    kind: "info" as ConfirmKind,
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setOptions({
        message,
        title: opts.title || t("confirm.title"),
        okLabel: opts.okLabel || t("confirm.ok"),
        cancelLabel: opts.cancelLabel || t("account.cancel"),
        kind: opts.kind || "info",
        showCancel: opts.showCancel !== undefined ? opts.showCancel : true,
      });
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <ConfirmDialog
          {...options}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

interface ConfirmDialogProps {
  message: string;
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: ConfirmKind;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  message,
  title,
  okLabel,
  cancelLabel,
  kind,
  showCancel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (typeof document === "undefined") return null;

  const getButtonClass = () => {
    switch (kind) {
      case "warning":
        return "btn-warning";
      case "error":
        return "btn-danger";
      default:
        return "btn-primary";
    }
  };

  return (
    <Modal onClose={onCancel} size="md">
      <ModalHeader title={title} onClose={showCancel ? onCancel : undefined} />
      <ModalBody>
        <p className="text-slate-600 dark:text-slate-300">{message}</p>
      </ModalBody>
      <ModalFooter>
        {showCancel && (
          <button onClick={onCancel} className="btn-secondary">
            {cancelLabel}
          </button>
        )}
        <button onClick={onConfirm} className={getButtonClass()}>
          {okLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}



