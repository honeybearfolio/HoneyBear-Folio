import { createPortal } from "react-dom";
import {
  MoreVertical,
  CalendarClock,
  CalendarCheck,
  SkipForward,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormatNumber, useFormatDate } from "../../utils/format";
import type {
  Account,
  PendingOccurrence as PendingOccurrenceType,
  Transaction,
  MenuCoords,
} from "./account-details-types";

interface PendingOccurrencesProps {
  pendingOccurrences: PendingOccurrenceType[];
  account: Account;
  hasInvestment: boolean;
  menuOpenId: string | number | null;
  setMenuOpenId: (v: string | number | null) => void;
  menuCoords: MenuCoords | null;
  setMenuCoords: (v: MenuCoords | null) => void;
  handleApplyOccurrence: (
    occ: PendingOccurrenceType,
    useToday: boolean,
  ) => void;
  handleSkipOccurrence: (occ: PendingOccurrenceType) => void;
  filteredTransactions: Transaction[];
}

export default function PendingOccurrences({
  pendingOccurrences,
  account,
  hasInvestment,
  menuOpenId,
  setMenuOpenId,
  menuCoords,
  setMenuCoords,
  handleApplyOccurrence,
  handleSkipOccurrence,
  filteredTransactions,
}: PendingOccurrencesProps) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const formatDate = useFormatDate();

  if (pendingOccurrences.length === 0) return null;

  const colSpan =
    account.id === "all" ? (!hasInvestment ? 7 : 11) : !hasInvestment ? 6 : 10;

  return (
    <>
      <tr className="scheduled-ghost-separator">
        <td
          colSpan={colSpan}
          className="px-6 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide bg-amber-50/50 dark:bg-amber-900/10"
        >
          <div className="flex items-center gap-2">
            <CalendarClock size={14} className="text-amber-500" />
            {t("scheduled.pending_transactions")}
          </div>
        </td>
      </tr>
      {pendingOccurrences.map((occ, idx) => (
        <tr
          key={`sched-${occ.scheduled_tx_id}-${occ.date}-${idx}`}
          className="scheduled-ghost-row group"
          onContextMenu={(e) => {
            e.preventDefault();
            const occId = `sched-${occ.scheduled_tx_id}-${occ.date}-${idx}`;
            setMenuCoords({ x: e.clientX, y: e.clientY });
            setMenuOpenId(occId);
          }}
        >
          <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                {formatDate(occ.date)}
              </span>
              <span
                className={`scheduled-ghost-badge ${
                  occ.status === "missed"
                    ? "scheduled-ghost-badge-missed"
                    : "scheduled-ghost-badge-upcoming"
                }`}
              >
                {occ.status === "missed"
                  ? t("scheduled.status.missed")
                  : t("scheduled.status.upcoming")}
              </span>
            </div>
          </td>

          {account.id === "all" && (
            <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
              {occ.account_name || occ.account_id}
            </td>
          )}

          <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
            {occ.payee}
          </td>

          <td className="px-6 py-3 whitespace-nowrap text-sm">
            {occ.category ? (
              <span className="px-2 py-1 inline-flex text-xs font-bold rounded-lg border bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 border-dashed">
                {occ.category}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            )}
          </td>

          <td className="px-6 py-3 text-sm text-slate-400 dark:text-slate-500 max-w-xs truncate">
            {occ.notes || (
              <span className="text-slate-300 dark:text-slate-600">-</span>
            )}
          </td>

          {hasInvestment && (
            <>
              <td className="px-6 py-3">
                <span className="text-slate-300 dark:text-slate-600">-</span>
              </td>
              <td className="px-6 py-3 text-right">
                <span className="text-slate-300 dark:text-slate-600">-</span>
              </td>
              <td className="px-6 py-3 text-right">
                <span className="text-slate-300 dark:text-slate-600">-</span>
              </td>
              <td className="px-6 py-3 text-right">
                <span className="text-slate-300 dark:text-slate-600">-</span>
              </td>
            </>
          )}

          <td
            className={`px-6 py-3 text-sm font-semibold text-right tabular-nums ${
              occ.amount >= 0
                ? "text-emerald-500/60 dark:text-emerald-400/60"
                : "text-rose-500/60 dark:text-rose-400/60"
            }`}
          >
            {formatNumber(occ.amount, { style: "currency" })}
          </td>

          <td className="px-2 py-4 whitespace-nowrap text-right text-sm font-medium relative action-menu-container">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const occId = `sched-${occ.scheduled_tx_id}-${occ.date}-${idx}`;
                if (menuOpenId === occId) {
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
                  setMenuOpenId(occId);
                }
              }}
              className={`p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 ${
                menuOpenId === `sched-${occ.scheduled_tx_id}-${occ.date}-${idx}`
                  ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  : ""
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpenId === `sched-${occ.scheduled_tx_id}-${occ.date}-${idx}` &&
              menuCoords &&
              createPortal(
                <div
                  className="fixed z-50 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 py-1.5 animate-fade-in action-menu-portal"
                  style={{
                    top:
                      menuCoords.x !== undefined
                        ? `${menuCoords.y}px`
                        : `${(menuCoords.top ?? 0) + (menuCoords.height ?? 0) + 8}px`,
                    left:
                      menuCoords.x !== undefined
                        ? `${Math.min(menuCoords.x, window.innerWidth - 224 - 8)}px`
                        : `${Math.min(
                            Math.max((menuCoords.right ?? 0) - 224, 8),
                            window.innerWidth - 224 - 8,
                          )}px`,
                  }}
                >
                  <button
                    onClick={() => {
                      handleApplyOccurrence(occ, true);
                      setMenuOpenId(null);
                      setMenuCoords(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 font-medium transition-colors"
                  >
                    <CalendarCheck className="w-4 h-4 text-emerald-500" />
                    {t("scheduled.action.apply_today")}
                  </button>
                  <button
                    onClick={() => {
                      handleApplyOccurrence(occ, false);
                      setMenuOpenId(null);
                      setMenuCoords(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 font-medium transition-colors"
                  >
                    <CalendarClock className="w-4 h-4 text-amber-500" />
                    {t("scheduled.action.apply_scheduled")}
                  </button>
                  <button
                    onClick={() => {
                      handleSkipOccurrence(occ);
                      setMenuOpenId(null);
                      setMenuCoords(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-3 font-medium transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                    {t("scheduled.action.skip")}
                  </button>
                </div>,
                document.body,
              )}
          </td>
        </tr>
      ))}
      {filteredTransactions.length > 0 && (
        <tr className="scheduled-ghost-separator">
          <td
            colSpan={colSpan}
            className="h-0 p-0 border-t-2 border-slate-200 dark:border-slate-600 border-dashed"
          ></td>
        </tr>
      )}
    </>
  );
}
