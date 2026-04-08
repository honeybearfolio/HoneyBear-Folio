import { useState, useEffect, useCallback } from "react";
import { rust } from "../../api/tauri-client";
import { Pencil, Trash2, RefreshCw } from "lucide-react";
import { t } from "../../i18n/i18n";
import { useConfirm } from "../../contexts/confirm";
import "../../styles/Settings.css";

interface ExchangeRate {
  currency: string;
  rate: number;
  isCustom: boolean;
}

interface ExchangeRatesListProps {
  onRateChange?: () => void;
}

/**
 * Component to display and manage exchange rates.
 * Shows custom rates with edit/delete options and Yahoo-sourced
 * currencies with an option to override.
 */
export default function ExchangeRatesList({ onRateChange }: ExchangeRatesListProps) {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const confirm = useConfirm();

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const appCurrency = localStorage.getItem("hb_currency") || "USD";
      const result = (await rust.get_all_exchange_rates({
        appCurrency,
      })) as ExchangeRate[];
      // Sort: custom rates first, then Yahoo, alphabetically within each group
      result.sort((a: ExchangeRate, b: ExchangeRate) => {
        if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
        return a.currency.localeCompare(b.currency);
      });
      setRates(result);
    } catch (e) {
      console.error("Failed to load exchange rates:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const handleEdit = (currency: string, currentRate: number | string) => {
    setEditingCurrency(currency);
    setEditValue(currentRate ? String(currentRate) : "");
  };

  const handleCancelEdit = () => {
    setEditingCurrency(null);
    setEditValue("");
  };

  const handleSaveEdit = async (currency: string) => {
    const newRate = parseFloat(editValue);
    if (isNaN(newRate) || newRate <= 0) return;

    try {
      await rust.set_custom_exchange_rate({ currency, rate: newRate });
      setEditingCurrency(null);
      setEditValue("");
      await loadRates();
      onRateChange?.();
    } catch (e) {
      console.error("Failed to update rate:", e);
    }
  };

  const handleDelete = async (currency: string) => {
    const confirmed = await confirm(
      t("settings.exchange_rate_delete_confirm", { currency }),
      { kind: "warning" },
    );
    if (!confirmed) return;

    try {
      await rust.delete_custom_exchange_rate({ currency });
      await loadRates();
      onRateChange?.();
    } catch (e) {
      console.error("Failed to delete rate:", e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currency: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(currency);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  if (loading) {
    return (
      <div className="exchange-rates-list">
        <div className="exchange-rates-loading">
          <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="exchange-rates-list">
        <p className="exchange-rates-empty">
          {t("settings.exchange_rates_empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="exchange-rates-list">
      {rates.map((entry) => (
        <div key={entry.currency} className="exchange-rate-row">
          <div className="exchange-rate-info">
            <span className="exchange-rate-currency">{entry.currency}</span>
            <span
              className={`exchange-rate-badge ${entry.isCustom ? "exchange-rate-badge-custom" : "exchange-rate-badge-auto"}`}
            >
              {entry.isCustom
                ? t("settings.exchange_rates_custom")
                : t("settings.exchange_rates_auto")}
            </span>
          </div>

          {editingCurrency === entry.currency ? (
            <div className="exchange-rate-edit">
              <input
                type="number"
                step="any"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, entry.currency)}
                className="exchange-rate-input"
                placeholder={t("settings.exchange_rate_placeholder")}
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleSaveEdit(entry.currency)}
                className="btn-primary btn-sm"
              >
                {t("confirm.save")}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-secondary btn-sm"
              >
                {t("account.cancel")}
              </button>
            </div>
          ) : entry.isCustom ? (
            <div className="exchange-rate-value-actions">
              <span className="exchange-rate-value">
                {entry.rate.toFixed(6)}
              </span>
              <div className="exchange-rate-actions">
                <button
                  type="button"
                  onClick={() => handleEdit(entry.currency, entry.rate)}
                  className="exchange-rate-action-btn"
                  title={t("settings.exchange_rate_edit")}
                  aria-label={t("settings.exchange_rate_edit")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.currency)}
                  className="exchange-rate-action-btn exchange-rate-action-delete"
                  title={t("settings.exchange_rate_delete")}
                  aria-label={t("settings.exchange_rate_delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="exchange-rate-value-actions">
              <span className="exchange-rate-value exchange-rate-value-auto">
                Yahoo Finance
              </span>
              <button
                type="button"
                onClick={() => handleEdit(entry.currency, "")}
                className="btn-secondary btn-sm"
              >
                {t("settings.exchange_rate_override")}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}



