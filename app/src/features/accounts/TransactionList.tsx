import type { Dispatch, SetStateAction } from "react";
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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 overflow-visible hover:shadow-lg transition-shadow duration-300 px-4 lg:px-6">
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
                <td
                  colSpan={emptyStateColSpan(account, hasInvestment)}
                  className="px-3 py-4 text-center"
                >
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
              filteredTransactions.map((tx) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
