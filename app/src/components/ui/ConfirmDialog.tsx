import { useEffect, useRef } from "react";
import { useConfirmStore } from "../../stores/confirm";
import { useTranslation } from "react-i18next";
import "../../styles/Modal.css";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";

type ConfirmKind = "info" | "warning" | "error";

export function ConfirmDialogContainer() {
  const isOpen = useConfirmStore((s) => s.isOpen);
  const message = useConfirmStore((s) => s.message);
  const options = useConfirmStore((s) => s.options);
  const handleClose = useConfirmStore((s) => s.handleClose);
  const { t } = useTranslation();

  if (!isOpen) return null;

  const title = options.title || t("confirm.title");
  const okLabel = options.okLabel || t("confirm.ok");
  const cancelLabel = options.cancelLabel || t("account.cancel");
  const kind = options.kind || "info";
  const showCancel =
    options.showCancel !== undefined ? options.showCancel : true;

  return (
    <ConfirmDialog
      message={message}
      title={title}
      okLabel={okLabel}
      cancelLabel={cancelLabel}
      kind={kind}
      showCancel={showCancel}
      onConfirm={() => handleClose(true)}
      onCancel={() => handleClose(false)}
    />
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
  const isDestructive = kind === "warning" || kind === "error";
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isDestructive && showCancel && cancelRef.current) {
      cancelRef.current.focus();
    } else if (!isDestructive && okRef.current) {
      okRef.current.focus();
    }
  }, [isDestructive, showCancel]);

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
          <button ref={cancelRef} onClick={onCancel} className="btn-secondary">
            {cancelLabel}
          </button>
        )}
        <button ref={okRef} onClick={onConfirm} className={getButtonClass()}>
          {okLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
