import { useState, useEffect, useMemo, useRef } from "react";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import { rust } from "../../api/tauri-client";
import { useParseNumber } from "../../utils/format";
import { useNumberFormat } from "../../stores/number-format";
import { useConfirm } from "../../stores/confirm";
import { useTranslation } from "react-i18next";
import { useToast } from "../../stores/toast";
import { useCustomRate } from "../../hooks/useCustomRate";
import { useTickerSearch } from "../../hooks/useTickerSearch";
import useTagColors from "../../hooks/useTagColors";
import "../../styles/Scheduled.css";
import type {
  AccountDetailsProps,
  AutocompleteSuggestion,
  Transaction,
  TransactionEditForm,
  PendingOccurrence,
  Rule,
  AvailableAccount,
  MenuCoords,
  SortableTransactionKey,
} from "./account-details-types";
import AccountHeader from "./AccountHeader";
import TransactionForm from "./TransactionForm";
import TransactionList from "./TransactionList";
import { useFormRules } from "./useFormRules";
import { handleAsyncError, logError } from "../../utils/errors";

export default function AccountDetails({
  account,
  onUpdate,
}: AccountDetailsProps) {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingOccurrences, setPendingOccurrences] = useState<
    PendingOccurrence[]
  >([]);
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { checkAndPrompt, dialog } = useCustomRate();
  const { getTagClasses } = useTagColors();

  const parseNumber = useParseNumber();
  const {
    dateFormat,
    firstDayOfWeek,
    currency: appCurrency,
  } = useNumberFormat();
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [payeeSuggestions, setPayeeSuggestions] = useState<
    AutocompleteSuggestion[]
  >([]);
  const [categorySuggestions, setCategorySuggestions] = useState<
    AutocompleteSuggestion[]
  >([]);
  const [availableAccounts, setAvailableAccounts] = useState<
    AvailableAccount[]
  >([]);
  const [addTargetAccount, setAddTargetAccount] =
    useState<AvailableAccount | null>(null);
  const {
    suggestions: tickerSuggestions,
    showSuggestions: showTickerSuggestions,
    setShowSuggestions: setShowTickerSuggestions,
    searchTicker,
    clearSuggestions: clearTickerSuggestions,
  } = useTickerSearch();
  const [rules, setRules] = useState<Rule[]>([]);

  // Editing state
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<Partial<TransactionEditForm>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | number | null>(null);
  // Coordinates/state for portal menu (so it can render above scrollable containers)
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  // Keep track of original notes value when editing (used to warn about modifying auto-generated brokerage notes)
  const [originalNotes, setOriginalNotes] = useState("");

  // Account actions state
  const [isRenamingAccount, setIsRenamingAccount] = useState(false);
  const [renameValue, setRenameValue] = useState(account.name);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Close account menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountMenuOpen &&
        !(event.target as HTMLElement).closest(".account-action-menu")
      ) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [accountMenuOpen]);

  // Form state
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0] ?? "",
  );
  const [payee, setPayee] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState("cash");
  const [selectedCurrency, setSelectedCurrency] = useState(appCurrency);

  const getAddFormCurrency = () => {
    const target = account.id === "all" ? addTargetAccount : account;
    return target?.currency || appCurrency || "USD";
  };

  const handleSetIsAdding = (v: boolean) => {
    setIsAdding(v);
    if (v) {
      setSelectedCurrency(getAddFormCurrency());
    }
  };

  const handleAddTargetAccountChange = (v: AvailableAccount | null) => {
    setAddTargetAccount(v);
    if (isAdding && account.id === "all" && v) {
      setSelectedCurrency(v.currency || appCurrency || "USD");
    }
  };

  // Brokerage Form State
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [fee, setFee] = useState("");
  // Removed cashAccountId/Name/Suggestions as we are unified now
  const [isBuy, setIsBuy] = useState(true);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{
    key: SortableTransactionKey | null;
    direction: string | null;
  }>({ key: null, direction: null });

  useFormRules(rules, {
    payee: { value: payee, set: setPayee },
    category: { value: category, set: setCategory },
    notes: { value: notes, set: setNotes },
    amount: { value: amount, set: setAmount },
    date: { value: date, set: setDate },
    ticker: { value: ticker, set: setTicker },
    shares: { value: shares, set: setShares },
    price: { value: pricePerShare, set: setPricePerShare },
    fee: { value: fee, set: setFee },
  });

  // Ref for the account rename input (avoid string-based querySelector + escaping)
  const renameInputRef = useRef<HTMLInputElement>(null);

  async function fetchSuggestions() {
    try {
      const [payees, accountsList, categories, fetchedRules] =
        await Promise.all([
          rust.get_payees(),
          rust.get_accounts(),
          rust.get_categories(),
          rust.get_rules() as Promise<Rule[]>,
        ]);
      setRules(fetchedRules);

      // Filter out current account from accounts list
      const otherAccounts: AvailableAccount[] = accountsList
        .filter((a) => a.id !== account.id)
        .map((a) => ({
          name: a.name || "",
          id: a.id,
          ...(a.kind !== undefined ? { kind: a.kind } : {}),
          ...(a.currency !== undefined ? { currency: a.currency } : {}),
        }));

      setAvailableAccounts(otherAccounts);

      // If viewing the consolidated "All" view, default the add-target to the first account
      if (
        account.id === "all" &&
        otherAccounts.length > 0 &&
        !addTargetAccount
      ) {
        const firstAccount = otherAccounts[0];
        if (firstAccount) {
          setAddTargetAccount(firstAccount);
          if (isAdding) {
            setSelectedCurrency(firstAccount.currency || appCurrency || "USD");
          }
        }
      }

      const accountOptions = otherAccounts.map((acc) => ({
        value: acc.name,
        label: t("import.field.account"),
        type: "account",
      }));
      const payeeOptions = payees.map((name: string) => ({
        value: name,
        label: t("import.field.payee"),
        type: "payee",
      }));

      const combined = [...accountOptions, ...payeeOptions].sort((a, b) =>
        a.value.localeCompare(b.value),
      );

      const unique: AutocompleteSuggestion[] = [];
      const seen = new Set();
      for (const item of combined) {
        if (!seen.has(item.value)) {
          seen.add(item.value);
          unique.push(item);
        } else if (item.type === "account") {
          const index = unique.findIndex((u) => u.value === item.value);
          if (index !== -1) unique[index] = item;
        }
      }

      setPayeeSuggestions(unique);
      setCategorySuggestions(
        categories.map((c: string) => ({
          value: c,
          label: t("import.field.category"),
          type: "category",
        })),
      );
    } catch (e) {
      logError("Failed to fetch suggestions", e);
    }
  }

  async function fetchTransactions() {
    try {
      let txs: Transaction[];
      if (account.id === "all") {
        const [transactionsList, accounts] = await Promise.all([
          rust.get_all_transactions(),
          rust.get_accounts(),
        ]);
        // Attach account_name for display in the consolidated view
        txs = transactionsList.map((tx: Transaction) => {
          const acc = accounts.find((a) => a.id === tx.account_id);
          return {
            ...tx,
            account_name: acc ? acc.name : String(tx.account_id),
          };
        });
      } else {
        txs = await rust.get_transactions({
          accountId: account.id,
        });
      }
      setTransactions(txs);
    } catch (e) {
      handleAsyncError({
        context: "Failed to fetch transactions",
        error: e,
        userMessage: t("error.failed_to_load"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  async function fetchPendingOccurrences() {
    try {
      const accountId = account.id === "all" ? null : account.id;
      const occs = await rust.get_pending_occurrences({
        accountId,
      });
      setPendingOccurrences(occs);
    } catch (e) {
      logError("Failed to fetch pending occurrences", e);
      setPendingOccurrences([]);
    }
  }

  async function handleApplyOccurrence(
    occ: PendingOccurrence,
    useToday: boolean,
  ) {
    try {
      const applyDate =
        (useToday ? new Date().toISOString().split("T")[0] : occ.date) ?? "";
      await rust.apply_scheduled_occurrence({
        scheduledTxId: occ.scheduled_tx_id,
        applyDate,
      });
      await Promise.all([fetchTransactions(), fetchPendingOccurrences()]);
      onUpdate();
    } catch (e) {
      handleAsyncError({
        context: "Failed to apply scheduled occurrence",
        error: e,
        userMessage: t("error.operation_failed"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  async function handleSkipOccurrence(occ: PendingOccurrence) {
    try {
      await rust.skip_scheduled_occurrence({
        scheduledTxId: occ.scheduled_tx_id,
        skipDate: occ.date,
      });
      await fetchPendingOccurrences();
    } catch (e) {
      handleAsyncError({
        context: "Failed to skip scheduled occurrence",
        error: e,
        userMessage: t("error.operation_failed"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchTransactions();
      void fetchSuggestions();
      void fetchPendingOccurrences();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  // Close menu when clicking outside, and close on scroll/resize so portal positioning doesn't get stale
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuOpenId &&
        !(event.target as HTMLElement).closest(".action-menu-container") &&
        !(event.target as HTMLElement).closest(".action-menu-portal")
      ) {
        setMenuOpenId(null);
        setMenuCoords(null);
      }
    }

    function handleScrollOrResize() {
      if (menuOpenId) {
        setMenuOpenId(null);
        setMenuCoords(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    // capture true ensures we catch scrolls from inner containers too
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [menuOpenId]);

  const handleTickerChange = (query: string) => {
    searchTicker(query);
  };

  // Handle input changes
  const handleSharesChange = (num: number) => {
    setShares(String(num));
  };

  const handlePricePerShareChange = (num: number) => {
    setPricePerShare(String(num));
  };

  async function handleRenameAccount(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!renameValue.trim()) return;
    try {
      await rust.rename_account({ id: account.id, newName: renameValue });
      setIsRenamingAccount(false);
      setAccountMenuOpen(false);
      onUpdate();
    } catch (e) {
      handleAsyncError({
        context: "Failed to rename account",
        error: e,
        userMessage: t("error.failed_to_rename"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  async function handleDeleteAccount() {
    const confirmed = await confirm(
      t("confirm.delete_account", { name: account.name }),
      {
        title: t("confirm.delete_title"),
        kind: "warning",
        okLabel: t("confirm.delete"),
        cancelLabel: t("account.cancel"),
      },
    );

    if (!confirmed) return;

    try {
      await rust.delete_account({ id: account.id });
      onUpdate();
    } catch (e) {
      handleAsyncError({
        context: "Failed to delete account",
        error: e,
        userMessage: t("error.failed_to_delete"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  async function handleAddTransaction(e: React.SyntheticEvent) {
    e.preventDefault();
    try {
      const target = account.id === "all" ? addTargetAccount : account;
      if (!target) {
        await confirm(t("confirm.select_account"), {
          title: t("confirm.invalid_input_title"),
          kind: "error",
          showCancel: false,
        });
        return;
      }

      if (transactionType === "investment") {
        const sharesNum = parseNumber(shares);
        await rust.create_investment_transaction({
          args: {
            accountId: target.id,
            date,
            ticker,
            shares: sharesNum,
            pricePerShare: parseNumber(pricePerShare),
            fee: parseNumber(fee) || 0.0,
            isBuy,
            currency: selectedCurrency,
            payee: isBuy ? t("transaction.buy") : t("transaction.sell"),
            notes: isBuy
              ? t("transaction.notes.bought_shares", {
                  shares: sharesNum,
                  ticker,
                })
              : t("transaction.notes.sold_shares", {
                  shares: sharesNum,
                  ticker,
                }),
            category: t("transaction.category.investment"),
          },
        });

        setTicker("");
        setShares("");
        setPricePerShare("");
        setFee("");
        setSelectedCurrency(appCurrency);
      } else {
        await rust.create_transaction({
          args: {
            accountId: target.id,
            date,
            payee,
            category: category || null,
            notes: notes || null,
            amount: parseNumber(amount) || 0.0,
            ticker: null,
            shares: null,
            pricePerShare: null,
            fee: null,
            currency: selectedCurrency,
          },
        });

        setPayee("");
        setCategory("");
        setNotes("");
        setAmount("");
        setSelectedCurrency(appCurrency);
      }

      setIsAdding(false);

      void fetchTransactions();
      void fetchSuggestions();
      onUpdate();
    } catch (e) {
      handleAsyncError({
        context: "Failed to create transaction",
        error: e,
        userMessage: t("error.failed_to_save"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  function startEditing(tx: Transaction) {
    setEditingId(tx.id);
    setEditForm({ ...tx });
    setOriginalNotes(tx.notes || "");
    setMenuOpenId(null);
  }

  async function saveEdit() {
    try {
      // If this is a brokerage transaction (has ticker), call the investment-specific update
      if (editForm.ticker) {
        const shares = Math.abs(parseNumber(editForm.shares) || 0);
        const pricePerShare = parseNumber(editForm.price_per_share) || 0.0;
        const feeVal = parseNumber(editForm.fee) || 0.0;
        const isBuy =
          editForm.payee === "Buy" ||
          (editForm.payee !== "Sell" &&
            (parseNumber(editForm.shares) || 0) > 0);

        // If user modified notes on a brokerage transaction, show a warning before proceeding
        const prev = originalNotes || "";
        const current = editForm.notes || "";
        if (prev !== current) {
          const confirmed = await confirm(t("confirm.edit_automated_notes"), {
            title: t("confirm.edit_automated_notes_title"),
            kind: "warning",
            okLabel: t("confirm.ok"),
            cancelLabel: t("account.cancel"),
          });

          if (!confirmed) return;
        }

        await rust.update_investment_transaction({
          args: {
            id: editForm.id,
            accountId: editForm.account_id,
            date: editForm.date,
            ticker: editForm.ticker,
            shares: shares,
            pricePerShare: pricePerShare,
            fee: feeVal,
            isBuy: isBuy,
            notes: editForm.notes || null,
            currency: editForm.currency || null,
          },
        });
      } else {
        await rust.update_transaction({
          args: {
            id: editForm.id,
            accountId: editForm.account_id,
            date: editForm.date,
            payee: editForm.payee,
            category: editForm.category || null,
            notes: editForm.notes || null,
            amount: parseNumber(editForm.amount) || 0.0,
            currency: editForm.currency || null,
          },
        });
      }

      setEditingId(null);
      void fetchTransactions();
      onUpdate();
    } catch (e) {
      handleAsyncError({
        context: "Failed to update transaction",
        error: e,
        userMessage: t("error.failed_to_save"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  async function deleteTransaction(id: string | number) {
    const confirmed = await confirm(t("confirm.delete_transaction"), {
      title: t("confirm.transaction_title"),
      kind: "warning",
      okLabel: t("confirm.delete"),
      cancelLabel: t("account.cancel"),
    });
    if (!confirmed) return;
    try {
      await rust.delete_transaction({ id });
      setMenuOpenId(null);
      void fetchTransactions();
      onUpdate();
    } catch (e) {
      handleAsyncError({
        context: "Failed to delete transaction",
        error: e,
        userMessage: t("error.failed_to_delete"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  async function duplicateTransaction(tx: Transaction) {
    try {
      await rust.create_transaction({
        args: {
          accountId: tx.account_id,
          date: tx.date,
          payee: tx.payee,
          category: tx.category,
          notes: tx.notes,
          amount: tx.amount,
          ticker: tx.ticker || null,
          shares: tx.shares || null,
          pricePerShare: tx.price_per_share || null,
          fee: tx.fee || null,
          currency: tx.currency || null,
        },
      });
      setMenuOpenId(null);
      void fetchTransactions();
      onUpdate();
    } catch (e) {
      handleAsyncError({
        context: "Failed to duplicate transaction",
        error: e,
        userMessage: t("error.operation_failed"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  const handleSort = (key: SortableTransactionKey) => {
    let direction: string | null = "ascending";
    if (sortConfig.key === key) {
      if (sortConfig.direction === "ascending") {
        direction = "descending";
      } else if (sortConfig.direction === "descending") {
        direction = null;
      }
    }
    setSortConfig({
      key: direction ? key : null,
      direction: direction ? direction : null,
    });
  };

  const filteredTransactions = useMemo(() => {
    const data = transactions.filter((tx: Transaction) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        tx.date.toLowerCase().includes(query) ||
        tx.payee.toLowerCase().includes(query) ||
        (tx.category && tx.category.toLowerCase().includes(query)) ||
        (tx.notes && tx.notes.toLowerCase().includes(query)) ||
        tx.amount.toString().includes(query)
      );
    });

    if (sortConfig.key !== null) {
      const sortKey = sortConfig.key;
      data.sort((a: Transaction, b: Transaction) => {
        let aValue: string | number = a[sortKey] as string | number;
        let bValue: string | number = b[sortKey] as string | number;

        // Handle numeric values
        if (["amount", "shares", "price_per_share", "fee"].includes(sortKey)) {
          aValue = parseFloat(String(aValue) || "0");
          bValue = parseFloat(String(bValue) || "0");
        } else if (sortConfig.key === "date") {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        } else {
          aValue = (aValue || "").toString().toLowerCase();
          bValue = (bValue || "").toString().toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return data;
  }, [transactions, searchQuery, sortConfig]);

  const hasInvestment = useMemo(() => {
    return transactions.some(
      (tx: Transaction) => tx.ticker || (tx.shares && tx.shares !== 0),
    );
  }, [transactions]);

  return (
    <div className="page-container account-details-scaled-container">
      <AccountHeader
        account={account}
        isRenamingAccount={isRenamingAccount}
        setIsRenamingAccount={setIsRenamingAccount}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        handleRenameAccount={handleRenameAccount}
        renameInputRef={renameInputRef}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isAdding={isAdding}
        setIsAdding={handleSetIsAdding}
        accountMenuOpen={accountMenuOpen}
        setAccountMenuOpen={setAccountMenuOpen}
        handleDeleteAccount={() => {
          void handleDeleteAccount();
        }}
        availableAccounts={availableAccounts}
      />

      {isAdding && (
        <TransactionForm
          account={account}
          availableAccounts={availableAccounts}
          addTargetAccount={addTargetAccount}
          setAddTargetAccount={handleAddTargetAccountChange}
          transactionType={transactionType}
          setTransactionType={setTransactionType}
          date={date}
          setDate={setDate}
          payee={payee}
          setPayee={setPayee}
          category={category}
          setCategory={setCategory}
          notes={notes}
          setNotes={setNotes}
          amount={amount}
          setAmount={setAmount}
          ticker={ticker}
          setTicker={setTicker}
          shares={shares}
          setShares={setShares}
          pricePerShare={pricePerShare}
          setPricePerShare={setPricePerShare}
          fee={fee}
          setFee={setFee}
          isBuy={isBuy}
          setIsBuy={setIsBuy}
          selectedCurrency={selectedCurrency}
          setSelectedCurrency={setSelectedCurrency}
          tickerSuggestions={tickerSuggestions}
          showTickerSuggestions={showTickerSuggestions}
          setShowTickerSuggestions={setShowTickerSuggestions}
          handleTickerChange={handleTickerChange}
          handleSharesChange={handleSharesChange}
          handlePricePerShareChange={handlePricePerShareChange}
          payeeSuggestions={payeeSuggestions}
          categorySuggestions={categorySuggestions}
          handleAddTransaction={handleAddTransaction}
          dateFormat={dateFormat}
          firstDayOfWeek={firstDayOfWeek}
          appCurrency={appCurrency}
          checkAndPrompt={checkAndPrompt}
        />
      )}

      <TransactionList
        account={account}
        hasInvestment={hasInvestment}
        sortConfig={sortConfig}
        onSort={handleSort}
        pendingOccurrences={pendingOccurrences}
        filteredTransactions={filteredTransactions}
        searchQuery={searchQuery}
        menuOpenId={menuOpenId}
        setMenuOpenId={setMenuOpenId}
        menuCoords={menuCoords}
        setMenuCoords={setMenuCoords}
        handleApplyOccurrence={handleApplyOccurrence}
        handleSkipOccurrence={handleSkipOccurrence}
        editingId={editingId}
        editForm={editForm}
        setEditForm={setEditForm}
        startEditing={startEditing}
        saveEdit={saveEdit}
        setEditingId={setEditingId}
        duplicateTransaction={duplicateTransaction}
        deleteTransaction={deleteTransaction}
        payeeSuggestions={payeeSuggestions}
        categorySuggestions={categorySuggestions}
        availableAccounts={availableAccounts}
        tickerSuggestions={tickerSuggestions}
        handleTickerChange={handleTickerChange}
        setTickerSuggestions={clearTickerSuggestions}
        appCurrency={appCurrency}
        dateFormat={dateFormat}
        firstDayOfWeek={firstDayOfWeek}
        getTagClasses={getTagClasses}
      />
      {dialog}
    </div>
  );
}
