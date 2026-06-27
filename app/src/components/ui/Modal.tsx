import { useEffect, useRef } from "react";
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

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function Modal({
  children,
  onClose,
  size = "md",
  className = "",
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Prevent scroll on body when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Focus trap: move focus into the modal and keep it there
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));

    // Focus the first focusable element, or the container itself as fallback
    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusable[0]!.focus();
    } else {
      container.focus();
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (
          document.activeElement === first ||
          document.activeElement === container
        ) {
          e.preventDefault();
          last!.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first!.focus();
        }
      }
    };

    // Redirect focus back into the modal if it escapes through non-Tab means
    const handleFocusIn = (e: FocusEvent) => {
      if (!container.contains(e.target as Node)) {
        const focusable = getFocusable();
        if (focusable.length > 0) {
          focusable[0]!.focus();
        } else {
          container.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTab);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleTab);
      document.removeEventListener("focusin", handleFocusIn);
      previouslyFocused?.focus();
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
        ref={containerRef}
        className={`modal-container w-full ${sizeClasses[size] || "max-w-md"} ${className}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
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
