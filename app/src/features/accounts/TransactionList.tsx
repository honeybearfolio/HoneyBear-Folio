import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  AccountDetailsAccount,
  AutocompleteSuggestion,
  AvailableAccount,
  MenuCoords,
  PendingOccurrence,
  TickerSuggestion,
  Transaction,
  TransactionEditForm,
} from "./account-details-types";
import PendingOccurrences from "./PendingOccurrences";
import TransactionRow from "./TransactionRow";
import TransactionToolbar from "./TransactionToolbar";
import type { SortableTransactionKey } from "./account-details-types";

interface TransactionListProps {
  account: AccountDetailsAccount;
  hasInvestment: boolean;
  sortConfig: {
    key: SortableTransactionKey | null;
    direction: string | null;
  };
  onSort: (key: SortableTransactionKey) => void;
  pendingOccurrences: PendingOccurrence[];
  filteredTransactions: Transaction[];
  listKey: string;
  hasMore: boolean;
  onLoadMore: () => void;
  searchQuery: string;
  menuOpenId: string | number | null;
  setMenuOpenId: (v: string | number | null) => void;
  menuCoords: MenuCoords | null;
  setMenuCoords: (v: MenuCoords | null) => void;
  handleApplyOccurrence: (
    occ: PendingOccurrence,
    useToday: boolean,
  ) => Promise<void>;
  handleSkipOccurrence: (occ: PendingOccurrence) => Promise<void>;
  editingId: string | number | null;
  editForm: Partial<TransactionEditForm>;
  setEditForm: Dispatch<SetStateAction<Partial<TransactionEditForm>>>;
  startEditing: (tx: Transaction) => void;
  saveEdit: () => Promise<void>;
  setEditingId: (v: string | number | null) => void;
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

const OVERSCAN = 8;
const INITIAL_ROWS = 40;
const MIN_ROW_HEIGHT = 24;
const DEFAULT_ROW_HEIGHT = 56;

function emptyStateColSpan(
  account: AccountDetailsAccount,
  hasInvestment: boolean,
): number {
  if (account.id === "all") {
    return hasInvestment ? 11 : 7;
  }
  return hasInvestment ? 10 : 6;
}

export default function TransactionList({
  account,
  hasInvestment,
  sortConfig,
  onSort,
  pendingOccurrences,
  filteredTransactions,
  listKey,
  hasMore,
  onLoadMore,
  searchQuery,
  menuOpenId,
  setMenuOpenId,
  menuCoords,
  setMenuCoords,
  handleApplyOccurrence,
  handleSkipOccurrence,
  editingId,
  editForm,
  setEditForm,
  startEditing,
  saveEdit,
  setEditingId,
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
}: TransactionListProps) {
  const { t } = useTranslation();
  const rowCount = filteredTransactions.length;
  const { containerRef, anchorRef, start, end, rowHeight } =
    useTransactionWindow(rowCount, listKey, hasMore, onLoadMore);
  const visibleTransactions = filteredTransactions.slice(start, end);
  const colSpan = emptyStateColSpan(account, hasInvestment);

  return (
    <div
      ref={containerRef}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 overflow-visible hover:shadow-lg transition-shadow duration-300 px-4 lg:px-6"
    >
      <div className="overflow-x-auto">
        <table className="account-transactions-table min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <TransactionToolbar
            account={account}
            hasInvestment={hasInvestment}
            sortConfig={sortConfig}
            onSort={onSort}
          />
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
            <PendingOccurrences
              pendingOccurrences={pendingOccurrences}
              account={account}
              hasInvestment={hasInvestment}
              menuOpenId={menuOpenId}
              setMenuOpenId={setMenuOpenId}
              menuCoords={menuCoords}
              setMenuCoords={setMenuCoords}
              handleApplyOccurrence={handleApplyOccurrence}
              handleSkipOccurrence={handleSkipOccurrence}
              filteredTransactions={filteredTransactions}
            />
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-full">
                      <Search className="w-8 h-8 text-slate-300 dark:text-slate-500" />
                    </div>
                    <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t("account.no_transactions_found")}
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      {searchQuery
                        ? t("account.search_try_adjust")
                        : t("account.add_transaction_get_started")}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                <tr
                  ref={anchorRef}
                  aria-hidden="true"
                  style={{ height: start * rowHeight }}
                >
                  <td
                    colSpan={colSpan}
                    style={{
                      height: start * rowHeight,
                      padding: 0,
                      border: 0,
                    }}
                  />
                </tr>
                {visibleTransactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    account={account}
                    hasInvestment={hasInvestment}
                    editingId={editingId}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    startEditing={startEditing}
                    saveEdit={saveEdit}
                    setEditingId={setEditingId}
                    menuOpenId={menuOpenId}
                    setMenuOpenId={setMenuOpenId}
                    menuCoords={menuCoords}
                    setMenuCoords={setMenuCoords}
                    duplicateTransaction={duplicateTransaction}
                    deleteTransaction={deleteTransaction}
                    payeeSuggestions={payeeSuggestions}
                    categorySuggestions={categorySuggestions}
                    availableAccounts={availableAccounts}
                    tickerSuggestions={tickerSuggestions}
                    handleTickerChange={handleTickerChange}
                    setTickerSuggestions={setTickerSuggestions}
                    appCurrency={appCurrency}
                    dateFormat={dateFormat}
                    firstDayOfWeek={firstDayOfWeek}
                    getTagClasses={getTagClasses}
                  />
                ))}
                <tr
                  aria-hidden="true"
                  style={{ height: (rowCount - end) * rowHeight }}
                >
                  <td
                    colSpan={colSpan}
                    style={{
                      height: (rowCount - end) * rowHeight,
                      padding: 0,
                      border: 0,
                    }}
                  />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useTransactionWindow(
  count: number,
  listKey: string,
  hasMore: boolean,
  onLoadMore: () => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLTableRowElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const hasMoreRef = useRef(hasMore);
  const rowHeightRef = useRef(DEFAULT_ROW_HEIGHT);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const [range, setRange] = useState({ start: 0, end: INITIAL_ROWS });
  const listKeyRef = useRef(listKey);

  useLayoutEffect(() => {
    onLoadMoreRef.current = onLoadMore;
    hasMoreRef.current = hasMore;
  }, [onLoadMore, hasMore]);

  useLayoutEffect(() => {
    if (listKeyRef.current === listKey) return;
    listKeyRef.current = listKey;
    setRange({ start: 0, end: INITIAL_ROWS });
    containerRef.current?.closest("main")?.scrollTo({ top: 0 });
  }, [listKey]);

  useLayoutEffect(() => {
    if (count === 0) return;
    const root = containerRef.current?.closest("main");
    // No scroll parent (or no layout yet): render every loaded row.
    if (!root || root.clientHeight === 0) {
      setRange((prev) =>
        prev.start === 0 && prev.end === count
          ? prev
          : { start: 0, end: count },
      );
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const sample = containerRef.current?.querySelector("tbody tr.group");
      const measured = sample?.getBoundingClientRect().height ?? 0;
      if (measured >= MIN_ROW_HEIGHT && measured !== rowHeightRef.current) {
        rowHeightRef.current = measured;
        setRowHeight(measured);
      }
      const height = rowHeightRef.current;
      const rootRect = root.getBoundingClientRect();
      const anchorTop =
        anchor.getBoundingClientRect().top - rootRect.top + root.scrollTop;
      const visibleTop = Math.max(0, root.scrollTop - anchorTop);
      const start = Math.max(0, Math.floor(visibleTop / height) - OVERSCAN);
      const end = Math.min(
        count,
        start + Math.ceil(root.clientHeight / height) + OVERSCAN * 2,
      );
      setRange((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
      if (hasMoreRef.current && end >= count) onLoadMoreRef.current();
    };

    update();
    root.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      root.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [count, listKey]);

  const start = Math.min(range.start, count);
  const end = Math.max(start, Math.min(Math.max(range.end, start), count));
  return { containerRef, anchorRef, start, end, rowHeight };
}
