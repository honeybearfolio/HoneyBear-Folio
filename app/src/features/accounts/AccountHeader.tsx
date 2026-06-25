import type { RefObject } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  Check,
  X,
  Edit,
  Trash2,
} from "lucide-react";
import MaskedNumber from "../../components/ui/MaskedNumber";
import { useTranslation } from "react-i18next";
import type {
  AvailableAccount,
  AccountDetailsAccount,
} from "./account-details-types";

interface AccountHeaderProps {
  account: AccountDetailsAccount;
  isRenamingAccount: boolean;
  setIsRenamingAccount: (v: boolean) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleRenameAccount: (e: React.FormEvent) => void;
  renameInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isAdding: boolean;
  setIsAdding: (v: boolean) => void;
  accountMenuOpen: boolean;
  setAccountMenuOpen: (v: boolean) => void;
  handleDeleteAccount: () => void;
  availableAccounts: AvailableAccount[];
}

export default function AccountHeader({
  account,
  isRenamingAccount,
  setIsRenamingAccount,
  renameValue,
  setRenameValue,
  handleRenameAccount,
  renameInputRef,
  searchQuery,
  setSearchQuery,
  isAdding,
  setIsAdding,
  accountMenuOpen,
  setAccountMenuOpen,
  handleDeleteAccount,
  availableAccounts,
}: AccountHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="hb-header-container mb-large">
      <div>
        {isRenamingAccount ? (
          <form
            onSubmit={handleRenameAccount}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={renameValue}
              ref={renameInputRef}
              onChange={(e) => setRenameValue(e.target.value)}
              className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight bg-transparent border-b-2 border-brand-500 focus:outline-none min-w-[200px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsRenamingAccount(false);
                  setRenameValue(account.name);
                }
              }}
            />
            <div className="flex gap-1">
              <button
                type="submit"
                className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                title={t("account.save_name")}
                aria-label={t("account.save_name")}
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRenamingAccount(false);
                  setRenameValue(account.name);
                }}
                className="p-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-rose-500 transition-colors"
                title={t("account.cancel")}
                aria-label={t("account.cancel")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </form>
        ) : (
          <h1 className="hb-header-title">{account.name}</h1>
        )}

        <div className="flex flex-col mt-2 gap-1">
          {account.totalValue !== undefined &&
          Math.abs(account.totalValue - (account.balance ?? 0)) > 0.01 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t("account.total_value_label")}
                </span>
                <span
                  className={`text-3xl font-bold tracking-tight ${
                    account.totalValue >= 0
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  <MaskedNumber
                    value={account.totalValue}
                    options={{
                      style: "currency",
                      currency: account.currency,
                    }}
                  />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t("account.cash_balance")}
                </span>
                <span
                  className={`text-lg font-medium tracking-tight ${
                    (account.balance ?? 0) >= 0
                      ? "text-emerald-600 dark:text-emerald-400 opacity-80"
                      : "text-rose-600 dark:text-rose-400 opacity-80"
                  }`}
                >
                  <MaskedNumber
                    value={account.balance}
                    options={{
                      style: "currency",
                      currency: account.currency,
                    }}
                  />
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t("account.balance")}
              </span>
              <span
                className={`text-3xl font-bold tracking-tight ${
                  (account.balance ?? 0) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {(account.balance ?? 0) >= 0 ? "+" : ""}
                <MaskedNumber
                  value={account.balance}
                  options={{
                    style: "currency",
                    currency: account.currency,
                  }}
                />
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 w-full md:w-auto">
        <div className="relative flex-1 md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t("account.search_transactions")}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm transition-all hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-slate-100"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          {!(account.id === "all" && availableAccounts.length === 0) &&
            (!isAdding ? (
              <button
                onClick={() => {
                  setIsAdding(true);
                }}
                className="btn-primary px-3 sm:px-5 py-3 rounded-xl font-semibold text-sm shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">
                  {t("account.add_transaction")}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setIsAdding(false)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-2 px-3 sm:px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-colors"
              >
                <X className="w-5 h-5" />
                <span className="hidden sm:inline">{t("account.cancel")}</span>
              </button>
            ))}
        </div>

        {account.id !== "all" && (
          <div className="relative account-action-menu">
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="p-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {accountMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => {
                    setIsRenamingAccount(true);
                    setAccountMenuOpen(false);
                    setTimeout(() => renameInputRef.current?.focus(), 50);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4 text-slate-400" />
                  {t("account.action.rename")}
                </button>

                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                <button
                  onClick={handleDeleteAccount}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("account.action.delete")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
