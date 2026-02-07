import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Info, CheckCircle, AlertCircle, X } from "lucide-react";
import "../../styles/Toast.css";
import { ToastContext } from "../../contexts/toast";
import { t } from "../../i18n/i18n";

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (message, { type = "info", duration = 4000 } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((t) => [...t, { id, message, type }]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }

      return id;
    },
    [removeToast],
  );

  const getIcon = (type) => {
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
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
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
      </div>
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ToastProvider;
