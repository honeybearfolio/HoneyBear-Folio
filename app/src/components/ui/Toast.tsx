import { createPortal } from "react-dom";
import { Info, CheckCircle, AlertCircle, X } from "lucide-react";
import "../../styles/Toast.css";
import { useToastStore } from "../../stores/toast";
import { useTranslation } from "react-i18next";

type ToastType = "info" | "success" | "error" | "warning";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const { t } = useTranslation();

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

  return createPortal(
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
  );
}

export default ToastContainer;
