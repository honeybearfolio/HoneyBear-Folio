import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info, CheckCircle, AlertCircle, X } from "lucide-react";
import "../../styles/Toast.css";
import { ToastContext } from "../../contexts/toast";
import { t } from "../../i18n/i18n";

type ToastType = "info" | "success" | "error" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      {
        type = "info",
        duration = 4000,
      }: { type?: ToastType; duration?: number } = {},
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((t) => [...t, { id, message, type }]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }

      return id;
    },
    [removeToast],
  );

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle size={18} className="text-emerald-500" />;
      case "error":
        return <AlertCircle size={18} className="text-red-500" />;
      case "info":
      default:
        return <Info size={18} className="text-brand-500" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="toast-container" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}`}
              role="status"
            >
              <div className="toast-content">
                <span className="toast-icon">{getIcon(toast.type)}</span>
                <span className="toast-message">{toast.message}</span>
                <button
                  aria-label={t("toast.dismiss")}
                  className="toast-close"
                  onClick={() => removeToast(toast.id)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
