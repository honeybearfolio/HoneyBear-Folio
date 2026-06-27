import { createPortal } from "react-dom";
import {
  Trash2,
  Edit,
  CalendarClock,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormatNumber } from "../../utils/format";
import { getAccountName, getRecurrenceSummary } from "./scheduled-helpers";
import type { ScheduleRecord, AccountRecord } from "./scheduled-types";

interface ScheduledTableProps {
  schedules: ScheduleRecord[];
  accounts: AccountRecord[];
  menuOpenId: number | null;
  menuCoords: { x: number; y: number } | null;
  setMenuOpenId: React.Dispatch<React.SetStateAction<number | null>>;
  setMenuCoords: React.Dispatch<
    React.SetStateAction<{ x: number; y: number } | null>
  >;
  handleEdit: (sched: ScheduleRecord) => void;
  handleDelete: (id: number) => Promise<void>;
  handleToggleEnabled: (sched: ScheduleRecord) => Promise<void>;
}

export default function ScheduledTable({
  schedules,
  accounts,
  menuOpenId,
  menuCoords,
  setMenuOpenId,
  setMenuCoords,
  handleEdit,
  handleDelete,
  handleToggleEnabled,
}: ScheduledTableProps) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();

  if (schedules.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
        <CalendarClock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">
          {t("scheduled.empty")}
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          {t("scheduled.empty_hint")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-800/80">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {t("scheduled.field.account")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {t("scheduled.field.payee")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {t("scheduled.field.amount")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {t("scheduled.field.category")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {t("scheduled.field.recurrence")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {t("scheduled.col.applied")}
            </th>
            <th className="w-28"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {schedules.map((sched) => (
            <tr
              key={sched.id}
              className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                !sched.enabled ? "opacity-50" : ""
              }`}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuCoords({ x: e.clientX, y: e.clientY });
                setMenuOpenId(sched.id);
              }}
            >
              <td className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300">
                {getAccountName(accounts, sched.account_id)}
              </td>
              <td className="px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-1.5">
                  {sched.transaction_type === "investment" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                      <TrendingUp size={10} className="mr-0.5" />
                      {sched.ticker}
                    </span>
                  )}
                  {sched.payee}
                </div>
              </td>
              <td
                className={`px-4 py-2.5 text-sm font-semibold text-right tabular-nums ${
                  sched.amount >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatNumber(sched.amount, { style: "currency" })}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400">
                {sched.category && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {sched.category}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                  {getRecurrenceSummary(sched, t)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                {sched.occurrences_count}
              </td>
              <td className="px-4 py-2.5 text-right sched-action-menu-container">
                <div className="flex items-center justify-end gap-0.5">
                  <button
                    onClick={() => {
                      void handleToggleEnabled(sched);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={
                      sched.enabled
                        ? t("scheduled.enabled")
                        : t("scheduled.disabled")
                    }
                    aria-label={
                      sched.enabled
                        ? t("scheduled.enabled")
                        : t("scheduled.disabled")
                    }
                  >
                    {sched.enabled ? (
                      <ToggleRight size={18} className="text-brand-500" />
                    ) : (
                      <ToggleLeft size={18} className="text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      handleEdit(sched);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-brand-500 cursor-pointer"
                    title={t("scheduled.update")}
                    aria-label={t("scheduled.update")}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => {
                      void handleDelete(sched.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors text-slate-400 hover:text-rose-500 cursor-pointer"
                    title={t("scheduled.delete")}
                    aria-label={t("scheduled.delete")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {menuOpenId === sched.id &&
                  menuCoords &&
                  createPortal(
                    <div
                      className="fixed z-50 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 py-1.5 animate-fade-in sched-action-menu-portal"
                      style={{
                        top: `${String(menuCoords.y)}px`,
                        left: `${String(Math.min(menuCoords.x, window.innerWidth - 192 - 8))}px`,
                      }}
                    >
                      <button
                        onClick={() => {
                          void handleToggleEnabled(sched);
                          setMenuOpenId(null);
                          setMenuCoords(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 font-medium transition-colors"
                      >
                        {sched.enabled ? (
                          <ToggleRight size={16} className="text-brand-500" />
                        ) : (
                          <ToggleLeft size={16} className="text-slate-400" />
                        )}
                        {sched.enabled
                          ? t("scheduled.enabled")
                          : t("scheduled.disabled")}
                      </button>
                      <button
                        onClick={() => {
                          handleEdit(sched);
                          setMenuOpenId(null);
                          setMenuCoords(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 font-medium transition-colors"
                      >
                        <Edit
                          size={16}
                          className="text-slate-400 dark:text-slate-500"
                        />
                        {t("scheduled.update")}
                      </button>
                      <button
                        onClick={() => {
                          void handleDelete(sched.id);
                          setMenuOpenId(null);
                          setMenuCoords(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-3 font-medium transition-colors"
                      >
                        <Trash2 size={16} />
                        {t("scheduled.delete")}
                      </button>
                    </div>,
                    document.body,
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
