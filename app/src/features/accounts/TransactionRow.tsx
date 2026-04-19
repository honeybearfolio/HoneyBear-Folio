import DatePicker from "react-datepicker";
import type { Day } from "date-fns";
import { createPortal } from "react-dom";
import { MoreVertical, Copy, Trash2, Check, X } from "lucide-react";
import NumberInput from "../../components/ui/NumberInput";
import MaskedNumber from "../../components/ui/MaskedNumber";
import AutocompleteInput from "./AutocompleteInput";
import { useTranslation } from "react-i18next";
import {
  useFormatNumber,
  useParseNumber,
  useFormatDate,
  getDatePickerFormat,
} from "../../utils/format";
import type {
  Account,
  Transaction,
  AvailableAccount,
  AutocompleteSuggestion,
  TickerSuggestion,
  MenuCoords,
} from "./account-details-types";

interface TransactionRowProps {
  tx: Transaction;
  account: Account;
  hasInvestment: boolean;
  editingId: string | number | null;
  editForm: Record<string, unknown>;
  setEditForm: (v: Record<string, unknown>) => void;
  startEditing: (tx: Transaction) => void;
  saveEdit: () => void;
  setEditingId: (v: string | number | null) => void;
  menuOpenId: string | number | null;
  setMenuOpenId: (v: string | number | null) => void;
  menuCoords: MenuCoords | null;
  setMenuCoords: (v: MenuCoords | null) => void;
  duplicateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string | number) => void;
  payeeSuggestions: AutocompleteSuggestion[];
  categorySuggestions: AutocompleteSuggestion[];
  availableAccounts: AvailableAccount[];
  tickerSuggestions: TickerSuggestion[];
  handleTickerChange: (query: string) => void;
  setTickerSuggestions: (v: TickerSuggestion[]) => void;
  appCurrency: string;
  dateFormat: string;
  firstDayOfWeek: number;
  getTagClasses: (tag: string) => string;
}

export default function TransactionRow({
  tx,
  account,
  hasInvestment,
  editingId,
  editForm,
  setEditForm,
  startEditing,
  saveEdit,
  setEditingId,
  menuOpenId,
  setMenuOpenId,
  menuCoords,
  setMenuCoords,
  duplicateTransaction,
  deleteTransaction,
  payeeSuggestions,
  categorySuggestions,
  availableAccounts,
  tickerSuggestions,
  handleTickerChange,
  setTickerSuggestions,
  appCurrency,
  dateFormat,
  firstDayOfWeek,
  getTagClasses,
}: TransactionRowProps) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const parseNumber = useParseNumber();
  const formatDate = useFormatDate();

  return (
    <tr
      key={tx.id}
      className="hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent dark:hover:from-slate-700/50 group transition-all duration-200"
      onContextMenu={(e) => {
        if (editingId !== tx.id) {
          e.preventDefault();
          setMenuCoords({ x: e.clientX, y: e.clientY });
          setMenuOpenId(tx.id);
        }
      }}
    >
      {editingId === tx.id ? (
        <>
          <td className="px-6 py-3">
            <DatePicker
              selected={
                editForm.date ? new Date(editForm.date as string) : null
              }
              onChange={(date: Date | null) =>
                setEditForm({
                  ...editForm,
                  date: date ? date.toISOString().split("T")[0] : "",
                })
              }
              dateFormat={getDatePickerFormat(dateFormat)}
              calendarStartDay={firstDayOfWeek as Day}
              shouldCloseOnSelect={false}
              portalId="datepicker-portal"
              className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </td>

          {account.id === "all" && (
            <td className="px-6 py-3">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {(editForm.account_name as string) ||
                  String(editForm.account_id ?? "")}
              </span>
            </td>
          )}

          {hasInvestment && editForm.ticker ? (
            <>
              <td className="px-6 py-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`txType-${tx.id}`}
                      checked={
                        editForm.payee === "Buy" ||
                        (editForm.payee !== "Sell" &&
                          (parseNumber(editForm.shares) || 0) > 0)
                      }
                      onChange={() =>
                        setEditForm({ ...editForm, payee: "Buy" })
                      }
                      className="w-4 h-4 text-slate-600 dark:text-slate-400 accent-brand-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {t("transaction.type.buy")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`txType-${tx.id}`}
                      checked={
                        editForm.payee === "Sell" ||
                        (editForm.payee !== "Buy" &&
                          (parseNumber(editForm.shares) || 0) < 0)
                      }
                      onChange={() =>
                        setEditForm({
                          ...editForm,
                          payee: "Sell",
                        })
                      }
                      className="w-4 h-4 text-slate-600 dark:text-slate-400 accent-brand-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {t("transaction.type.sell")}
                    </span>
                  </label>
                </div>
              </td>

              <td className="px-6 py-3">
                <input
                  type="text"
                  className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={(editForm.category as string) || "Investment"}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      category: e.target.value,
                    })
                  }
                />
              </td>

              <td className="px-6 py-3">
                <input
                  type="text"
                  className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={(editForm.notes as string) || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder={t("account.notes_placeholder")}
                />
              </td>

              <td className="px-6 py-3">
                <div className="relative">
                  <input
                    type="text"
                    className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                    value={(editForm.ticker as string) || ""}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setEditForm({
                        ...editForm,
                        ticker: val,
                      });
                      handleTickerChange(val);
                    }}
                  />
                  {tickerSuggestions.length > 0 && (
                    <div className="absolute z-[100] w-64 mt-1 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                      {tickerSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.symbol}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex flex-col gap-0.5 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                          onClick={() => {
                            setEditForm({
                              ...editForm,
                              ticker: suggestion.symbol,
                              currency:
                                suggestion.currency || editForm.currency,
                            });
                            setTickerSuggestions([]);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">
                              {suggestion.symbol}
                            </span>
                            {suggestion.currency && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                {suggestion.currency}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {suggestion.shortname || suggestion.longname}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </td>

              <td className="px-6 py-3">
                <NumberInput
                  value={editForm.shares as number | string | undefined}
                  onChange={(num) =>
                    setEditForm({
                      ...editForm,
                      shares: num,
                    })
                  }
                  className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-right"
                  maximumFractionDigits={6}
                  useGrouping={false}
                />
              </td>

              <td className="px-6 py-3">
                <div className="relative">
                  <NumberInput
                    value={
                      editForm.price_per_share as number | string | undefined
                    }
                    onChange={(num) =>
                      setEditForm({
                        ...editForm,
                        price_per_share: num,
                      })
                    }
                    className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-right"
                    maximumFractionDigits={8}
                    useGrouping={false}
                  />
                </div>
              </td>

              <td className="px-6 py-3">
                <div className="relative">
                  <NumberInput
                    value={editForm.fee as number | string | undefined}
                    onChange={(num) =>
                      setEditForm({
                        ...editForm,
                        fee: num,
                      })
                    }
                    className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-right"
                    maximumFractionDigits={2}
                    minimumFractionDigits={2}
                  />
                </div>
              </td>

              <td className="px-6 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                <div className="flex flex-col items-end">
                  {(() => {
                    const s = parseNumber(editForm.shares) || 0;
                    const p = parseNumber(editForm.price_per_share) || 0;
                    const totalNum = Math.abs(s) * p;
                    const sign = editForm.payee === "Sell" || s < 0 ? "" : "+";
                    return (
                      <span className="flex items-center gap-1 justify-end">
                        {sign}
                        <MaskedNumber
                          value={totalNum}
                          options={{
                            style: "currency",
                            currency: editForm.currency || appCurrency,
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          }}
                        />
                      </span>
                    );
                  })()}
                  {typeof editForm.currency === "string" &&
                    editForm.currency !== appCurrency && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                        {editForm.currency as string}
                      </span>
                    )}
                </div>
              </td>

              <td className="px-6 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={saveEdit}
                    className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </>
          ) : (
            <>
              <td className="px-6 py-3">
                <AutocompleteInput
                  suggestions={payeeSuggestions}
                  className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={editForm.payee as string}
                  onChange={(val) => setEditForm({ ...editForm, payee: val })}
                />
              </td>

              <td className="px-6 py-3">
                <AutocompleteInput
                  suggestions={categorySuggestions}
                  className={`w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none ${
                    availableAccounts?.some((a) => a.name === editForm.payee)
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      : ""
                  }`}
                  value={(editForm.category as string) || ""}
                  onChange={(val) =>
                    setEditForm({
                      ...editForm,
                      category: val,
                    })
                  }
                  disabled={availableAccounts?.some(
                    (a) => a.name === editForm.payee,
                  )}
                />
              </td>

              <td className="px-6 py-3">
                <input
                  type="text"
                  className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={(editForm.notes as string) || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      notes: e.target.value,
                    })
                  }
                />
              </td>

              {hasInvestment && (
                <>
                  <td className="px-6 py-3">
                    <span className="text-slate-400 dark:text-slate-500">
                      -
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-slate-400 dark:text-slate-500">
                      -
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-slate-400 dark:text-slate-500">
                      -
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-slate-400 dark:text-slate-500">
                      -
                    </span>
                  </td>
                </>
              )}

              <td className="px-6 py-3">
                <NumberInput
                  value={editForm.amount as number | string | undefined}
                  onChange={(num) =>
                    setEditForm({
                      ...editForm,
                      amount: num,
                    })
                  }
                  placeholder={formatNumber(0, {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}
                  className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-right"
                  maximumFractionDigits={2}
                  minimumFractionDigits={2}
                />
              </td>
              <td className="px-6 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={saveEdit}
                    className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </>
          )}
        </>
      ) : (
        <>
          <td
            className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 font-medium cursor-pointer"
            onClick={() => startEditing(tx)}
          >
            {formatDate(tx.date)}
          </td>

          {account.id === "all" && (
            <td
              className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300"
              onClick={() => startEditing(tx)}
            >
              {tx.account_name || tx.account_id}
            </td>
          )}

          <td
            className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
            onClick={() => startEditing(tx)}
          >
            {tx.payee}
          </td>

          <td
            className="px-6 py-4 whitespace-nowrap text-sm cursor-pointer"
            onClick={() => startEditing(tx)}
          >
            {tx.category ? (
              <span
                className={`px-2 py-1 inline-flex text-xs font-bold rounded-lg border ${getTagClasses(tx.category)}`}
              >
                {tx.category}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">-</span>
            )}
          </td>
          <td
            className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate cursor-pointer"
            onClick={() => startEditing(tx)}
          >
            {tx.notes || (
              <span className="text-slate-300 dark:text-slate-600 italic">
                {t("account.no_notes")}
              </span>
            )}
          </td>

          {hasInvestment && (
            <>
              <td
                className="px-6 py-4 whitespace-nowrap text-sm cursor-pointer text-slate-700 dark:text-slate-300"
                onClick={() => startEditing(tx)}
              >
                {tx.ticker ? (
                  <span className="font-medium uppercase">{tx.ticker}</span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">-</span>
                )}
              </td>

              <td
                className="px-6 py-4 whitespace-nowrap text-sm text-right cursor-pointer text-slate-700 dark:text-slate-300"
                onClick={() => startEditing(tx)}
              >
                {typeof tx.shares !== "undefined" && tx.shares !== null ? (
                  <span>
                    <MaskedNumber
                      value={Math.abs(tx.shares)}
                      options={{
                        maximumFractionDigits: 6,
                        minimumFractionDigits: 0,
                        useGrouping: false,
                      }}
                    />
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">-</span>
                )}
              </td>

              <td
                className="px-6 py-4 whitespace-nowrap text-sm text-right cursor-pointer text-slate-700 dark:text-slate-300"
                onClick={() => startEditing(tx)}
              >
                {typeof tx.price_per_share !== "undefined" &&
                tx.price_per_share !== null ? (
                  <span>
                    <MaskedNumber
                      value={tx.price_per_share}
                      options={{
                        style: "currency",
                        currency: tx.currency || appCurrency,
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      }}
                    />
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">-</span>
                )}
              </td>

              <td
                className="px-6 py-4 whitespace-nowrap text-sm text-right cursor-pointer text-slate-700 dark:text-slate-300"
                onClick={() => startEditing(tx)}
              >
                {typeof tx.fee !== "undefined" && tx.fee !== null ? (
                  <span>
                    <MaskedNumber
                      value={tx.fee}
                      options={{
                        style: "currency",
                        currency: tx.currency || appCurrency,
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      }}
                    />
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">-</span>
                )}
              </td>
            </>
          )}

          <td
            className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold cursor-pointer ${tx.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
            onClick={() => startEditing(tx)}
          >
            {tx.amount >= 0 ? "+" : ""}
            <MaskedNumber
              value={Math.abs(tx.amount)}
              options={{
                style: "currency",
                currency: tx.currency || appCurrency,
              }}
            />
          </td>
          <td className="px-2 py-4 whitespace-nowrap text-right text-sm font-medium relative action-menu-container">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (menuOpenId === tx.id) {
                  setMenuOpenId(null);
                  setMenuCoords(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuCoords({
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    right: rect.right + window.scrollX,
                    bottom: rect.bottom + window.scrollY,
                    width: rect.width,
                    height: rect.height,
                  });
                  setMenuOpenId(tx.id);
                }
              }}
              className={`p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 ${menuOpenId === tx.id ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200" : ""}`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpenId === tx.id &&
              menuCoords &&
              createPortal(
                <div
                  className="fixed z-50 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 py-1.5 animate-fade-in action-menu-portal"
                  style={{
                    top:
                      menuCoords.x !== undefined
                        ? `${menuCoords.y}px`
                        : `${(menuCoords.top ?? 0) + (menuCoords.height ?? 0) + 8}px`,
                    left:
                      menuCoords.x !== undefined
                        ? `${Math.min(menuCoords.x, window.innerWidth - 176 - 8)}px`
                        : `${Math.min(Math.max((menuCoords.right ?? 0) - 176, 8), window.innerWidth - 176 - 8)}px`,
                  }}
                >
                  <button
                    onClick={() => {
                      duplicateTransaction(tx);
                      setMenuOpenId(null);
                      setMenuCoords(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 font-medium transition-colors"
                  >
                    <Copy className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    {t("transaction.duplicate")}
                  </button>
                  <button
                    onClick={() => {
                      deleteTransaction(tx.id);
                      setMenuOpenId(null);
                      setMenuCoords(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-3 font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("transaction.delete")}
                  </button>
                </div>,
                document.body,
              )}
          </td>
        </>
      )}
    </tr>
  );
}
