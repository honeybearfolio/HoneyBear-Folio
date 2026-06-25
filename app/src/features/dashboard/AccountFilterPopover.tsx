import { useRef, useEffect, useState } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import MaskedNumber from "../../components/ui/MaskedNumber";
import type { Account } from "../../api/types";

interface AccountFilterPopoverProps {
  accounts: Account[];
  toggledAccounts: Record<string | number, boolean>;
  selectedAccountIds: Set<unknown>;
  toggleAccountVisibility: (accountId: string | number) => void;
  setAllAccountsVisibility: (visible: boolean) => void;
  marketValues: Record<string, number>;
  appCurrency: string;
  chartDatasets?: Array<{
    accountId?: string | number;
    _color?: string;
    [key: string]: unknown;
  }>;
}

export default function AccountFilterPopover({
  accounts,
  toggledAccounts,
  selectedAccountIds,
  toggleAccountVisibility,
  setAllAccountsVisibility,
  marketValues,
  appCurrency,
  chartDatasets,
}: AccountFilterPopoverProps) {
  const { t } = useTranslation();
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowAccountFilter(false);
      }
    };
    if (showAccountFilter) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountFilter]);

  return (
    <div className="relative" ref={filterRef}>
      <button
        onClick={() => setShowAccountFilter((v) => !v)}
        className={`account-filter-trigger ${
          selectedAccountIds.size < accounts.length
            ? "account-filter-trigger-active"
            : ""
        }`}
      >
        <Filter className="w-4 h-4" />
        <span className="hidden sm:inline">
          {t("dashboard.accounts_filter")}
        </span>
        {selectedAccountIds.size < accounts.length && (
          <span className="account-filter-badge">
            {selectedAccountIds.size}/{accounts.length}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${
            showAccountFilter ? "rotate-180" : ""
          }`}
        />
      </button>

      {showAccountFilter && (
        <div className="account-filter-popover">
          <div className="account-filter-header">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("dashboard.accounts_filter")}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="toggle-all text-xs"
                onClick={() => setAllAccountsVisibility(true)}
              >
                {t("dashboard.show_all")}
              </button>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <button
                className="toggle-all text-xs"
                onClick={() => setAllAccountsVisibility(false)}
              >
                {t("dashboard.hide_all")}
              </button>
            </div>
          </div>
          <div className="account-filter-list">
            {accounts.map((acc) => {
              const ds = chartDatasets?.find((d) => d.accountId === acc.id);
              const color = ds?._color || "rgb(148, 163, 184)";
              return (
                <label key={acc.id} className="account-filter-item">
                  <input
                    type="checkbox"
                    className="account-checkbox"
                    checked={!!toggledAccounts[acc.id]}
                    onChange={() => toggleAccountVisibility(acc.id)}
                    aria-label={acc.name}
                    style={
                      {
                        ["--hb-account-color" as string]: color,
                      } as React.CSSProperties
                    }
                  />
                  <span
                    className="account-dot w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="account-name truncate">{acc.name}</span>
                  <span className="account-balance ml-auto text-slate-500 dark:text-slate-400 text-xs">
                    <MaskedNumber
                      value={
                        marketValues && marketValues[acc.id] !== undefined
                          ? (acc.balance || 0) + marketValues[acc.id]
                          : acc.balance || 0
                      }
                      options={{
                        style: "currency",
                        currency: acc.currency || appCurrency,
                      }}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
