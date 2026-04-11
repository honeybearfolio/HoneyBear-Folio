import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import "../../styles/Modal.css";
import { useTranslation } from "react-i18next";

type ModalSize =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl"
  | "6xl"
  | "full";

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  size?: ModalSize;
  className?: string;
}

export function Modal({
  children,
  onClose,
  size = "md",
  className = "",
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent scroll on body when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const sizeClasses: Record<ModalSize, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    full: "w-full mx-4",
  };

  return createPortal(
    <div className="modal-overlay">
      <div
        className={`modal-container w-full ${sizeClasses[size] || "max-w-md"} ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ModalHeaderProps {
  children?: React.ReactNode;
  onClose?: () => void;
  title?: React.ReactNode;
  icon?: LucideIcon;
}

export function ModalHeader({
  children,
  onClose,
  title,
  icon: Icon,
}: ModalHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="modal-header">
      <h2 className="modal-title">
        {Icon && <Icon className="w-5 h-5 text-brand-500" />}
        {title || children}
      </h2>
      {onClose && (
        <button
          onClick={onClose}
          className="modal-close-button"
          aria-label={t("modal.close")}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = "" }: ModalBodyProps) {
  return <div className={`modal-body ${className}`}>{children}</div>;
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
  return <div className={`modal-footer ${className}`}>{children}</div>;
}
