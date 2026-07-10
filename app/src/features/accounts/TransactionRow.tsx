import type { Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Copy, Trash2, Check, X } from "lucide-react";
import MaskedNumber from "../../components/ui/MaskedNumber";
import { useTranslation } from "react-i18next";
import { useParseNumber, useFormatDate } from "../../utils/format";
import type {
  AccountDetailsAccount,
  Transaction,
  TransactionEditForm,
  AvailableAccount,
  AutocompleteSuggestion,
  TickerSuggestion,
  MenuCoords,
} from "./account-details-types";
import {
  TransactionDateField,
  PayeeField,
  CategoryField,
  NotesField,
  TransactionAmountFields,
  BuySellField,
  TickerField,
  SharesField,
  PricePerShareField,
  FeeField,
  resolveInlineBuySell,
} from "./transaction-fields";

interface TransactionRowProps {
  tx: Transaction;
  account: AccountDetailsAccount;
  hasInvestment: boolean;
  editingId: string | number | null;
  editForm: Partial<TransactionEditForm>;
  setEditForm: Dispatch<SetStateAction<Partial<TransactionEditForm>>>;
  startEditing: (tx: Transaction) => void;
  saveEdit: () => Promise<void>;
  setEditingId: (v: string | number | null) => void;
  menuOpenId: string | number | null;
  setMenuOpenId: (v: string | number | null) => void;
  menuCoords: MenuCoords | null;
  setMenuCoords: (v: MenuCoords | null) => void;
  duplicateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string | number) => Promise<void>;
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

function EditActions({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={onSave}
        className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={onCancel}
        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
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
  const parseNumber = useParseNumber();
  const formatDate = useFormatDate();

  const updateEditForm = (patch: Partial<TransactionEditForm>) => {
    setEditForm((current) => ({ ...current, ...patch }));
  };

  const isBuy = resolveInlineBuySell(
    editForm.payee,
    editForm.shares,
    parseNumber,
  );

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
            <TransactionDateField
              value={editForm.date ?? ""}
              onChange={(date) => {
                updateEditForm({ date });
              }}
              dateFormat={dateFormat}
              firstDayOfWeek={firstDayOfWeek}
              variant="inline"
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
                <BuySellField
                  isBuy={isBuy}
                  onChange={(nextIsBuy) => {
                    updateEditForm({ payee: nextIsBuy ? "Buy" : "Sell" });
                  }}
                  variant="inline"
                  radioName={`txType-${String(tx.id)}`}
                />
              </td>

              <td className="px-6 py-3">
                <input
                  type="text"
                  className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={editForm.category || "Investment"}
                  onChange={(event) => {
                    updateEditForm({ category: event.target.value });
                  }}
                />
              </td>

              <td className="px-6 py-3">
                <NotesField
                  value={editForm.notes || ""}
                  onChange={(notes) => {
                    updateEditForm({ notes });
                  }}
                  variant="inline"
                />
              </td>

              <td className="px-6 py-3">
                <TickerField
                  value={editForm.ticker || ""}
                  onChange={(ticker) => {
                    updateEditForm({ ticker });
                    handleTickerChange(ticker);
                  }}
                  suggestions={tickerSuggestions}
                  showSuggestions={tickerSuggestions.length > 0}
                  onShowSuggestionsChange={() => {}}
                  onSuggestionSelect={(suggestion) => {
                    updateEditForm({
                      ticker: suggestion.symbol,
                      ...(suggestion.currency || editForm.currency
                        ? {
                            currency: suggestion.currency || editForm.currency,
                          }
                        : {}),
                    });
                    setTickerSuggestions([]);
                  }}
                  variant="inline"
                />
              </td>

              <td className="px-6 py-3">
                <SharesField
                  value={editForm.shares}
                  onChange={(shares) => {
                    updateEditForm({ shares });
                  }}
                  variant="inline"
                />
              </td>

              <td className="px-6 py-3">
                <PricePerShareField
                  value={editForm.price_per_share}
                  onChange={(pricePerShare) => {
                    updateEditForm({ price_per_share: pricePerShare });
                  }}
                  variant="inline"
                />
              </td>

              <td className="px-6 py-3">
                <FeeField
                  value={editForm.fee}
                  onChange={(fee) => {
                    updateEditForm({ fee });
                  }}
                  variant="inline"
                />
              </td>

              <td className="px-6 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                <div className="flex flex-col items-end">
                  {(() => {
                    const sharesNum = parseNumber(editForm.shares) || 0;
                    const price = parseNumber(editForm.price_per_share) || 0;
                    const totalNum = Math.abs(sharesNum) * price;
                    const sign =
                      editForm.payee === "Sell" || sharesNum < 0 ? "" : "+";
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
                        {editForm.currency}
                      </span>
                    )}
                </div>
              </td>

              <td className="px-6 py-3 text-center">
                <EditActions
                  onSave={() => {
                    void saveEdit();
                  }}
                  onCancel={() => {
                    setEditingId(null);
                  }}
                />
              </td>
            </>
          ) : (
            <>
              <td className="px-6 py-3">
                <PayeeField
                  value={(editForm.payee as string) || ""}
                  onChange={(payee, isTransfer) => {
                    updateEditForm({
                      payee,
                      ...(isTransfer ? { category: "Transfer" } : {}),
                    });
                  }}
                  suggestions={payeeSuggestions}
                  availableAccounts={availableAccounts}
                  variant="inline"
                />
              </td>

              <td className="px-6 py-3">
                <CategoryField
                  value={(editForm.category as string) || ""}
                  onChange={(category) => {
                    updateEditForm({ category });
                  }}
                  suggestions={categorySuggestions}
                  payee={(editForm.payee as string) || ""}
                  availableAccounts={availableAccounts}
                  variant="inline"
                />
              </td>

              <td className="px-6 py-3">
                <NotesField
                  value={editForm.notes || ""}
                  onChange={(notes) => {
                    updateEditForm({ notes });
                  }}
                  variant="inline"
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
                <TransactionAmountFields
                  amount={editForm.amount}
                  onAmountChange={(amount) => {
                    updateEditForm({ amount });
                  }}
                  currency={editForm.currency || appCurrency}
                  onCurrencyChange={(currency) => {
                    updateEditForm({ currency });
                  }}
                  variant="inline"
                />
              </td>
              <td className="px-6 py-3 text-center">
                <EditActions
                  onSave={() => {
                    void saveEdit();
                  }}
                  onCancel={() => {
                    setEditingId(null);
                  }}
                />
              </td>
            </>
          )}
        </>
      ) : (
        <>
          <td
            className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 font-medium cursor-pointer"
            onClick={() => {
              startEditing(tx);
            }}
          >
            {formatDate(tx.date)}
          </td>

          {account.id === "all" && (
            <td
              className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300"
              onClick={() => {
                startEditing(tx);
              }}
            >
              {tx.account_name || tx.account_id}
            </td>
          )}

          <td
            className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
            onClick={() => {
              startEditing(tx);
            }}
          >
            {tx.payee}
          </td>

          <td
            className="px-6 py-4 whitespace-nowrap text-sm cursor-pointer"
            onClick={() => {
              startEditing(tx);
            }}
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
            onClick={() => {
              startEditing(tx);
            }}
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
                onClick={() => {
                  startEditing(tx);
                }}
              >
                {tx.ticker ? (
                  <span className="font-medium uppercase">{tx.ticker}</span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">-</span>
                )}
              </td>

              <td
                className="px-6 py-4 whitespace-nowrap text-sm text-right cursor-pointer text-slate-700 dark:text-slate-300"
                onClick={() => {
                  startEditing(tx);
                }}
              >
                {typeof tx.shares !== "undefined" ? (
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
                onClick={() => {
                  startEditing(tx);
                }}
              >
                {typeof tx.price_per_share !== "undefined" ? (
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
                onClick={() => {
                  startEditing(tx);
                }}
              >
                {typeof tx.fee !== "undefined" ? (
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
            onClick={() => {
              startEditing(tx);
            }}
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
                        ? (menuCoords.y ?? 0)
                        : (menuCoords.top ?? 0) + (menuCoords.height ?? 0) + 8,
                    left:
                      menuCoords.x !== undefined
                        ? Math.min(menuCoords.x, window.innerWidth - 176 - 8)
                        : Math.min(
                            Math.max((menuCoords.right ?? 0) - 176, 8),
                            window.innerWidth - 176 - 8,
                          ),
                  }}
                >
                  <button
                    onClick={() => {
                      void duplicateTransaction(tx);
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
                      void deleteTransaction(tx.id);
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
