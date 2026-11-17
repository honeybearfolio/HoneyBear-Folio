import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { TransactionListArgs } from "../../api/tauri-client";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import { rust } from "../../api/tauri-client";
import { formatCalendarDate, useParseNumber } from "../../utils/format";
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

const TRANSACTION_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 200;

const NUMERIC_SORT_KEYS = new Set<SortableTransactionKey>([
  "amount",
  "shares",
  "price_per_share",
  "fee",
]);

interface PageCursor {
  cursorDate: string;
  cursorId: number;
  cursorSort: string | null;
}

function transactionCursor(
  tx: Transaction,
  sortKey: SortableTransactionKey | null,
): PageCursor | null {
  const cursorId = typeof tx.id === "number" ? tx.id : Number(tx.id);
  if (!Number.isFinite(cursorId)) return null;
  if (!sortKey || sortKey === "date") {
    return { cursorDate: tx.date, cursorId, cursorSort: null };
  }
  return {
    cursorDate: tx.date,
    cursorId,
    cursorSort: sortCursorValue(tx, sortKey),
  };
}

function sortCursorValue(tx: Transaction, key: SortableTransactionKey): string {
  if (NUMERIC_SORT_KEYS.has(key)) {
    const raw = tx[key];
    const value = typeof raw === "number" ? raw : Number(raw ?? 0);
    return Number.isFinite(value) ? String(value) : "0";
  }
  if (key === "account_name") return tx.account_name ?? "";
  const raw = tx[key];
  return raw == null ? "" : String(raw);
}

function withAccountNames(
  rows: Transaction[],
  names: Map<string, string>,
): Transaction[] {
  return rows.map((tx) => ({
    ...tx,
    account_name: names.get(String(tx.account_id)) ?? String(tx.account_id),
  }));
}

function pageArgs(
  search: string,
  sortKey: SortableTransactionKey | null,
  sortDir: string | null,
  cursor: PageCursor | null,
): TransactionListArgs {
  return {
    limit: TRANSACTION_PAGE_SIZE,
    ...(cursor
      ? {
          cursorDate: cursor.cursorDate,
          cursorId: cursor.cursorId,
          ...(cursor.cursorSort != null
            ? { cursorSort: cursor.cursorSort }
            : {}),
        }
      : {}),
    ...(search ? { search } : {}),
    ...(sortKey ? { sortKey, sortDir } : {}),
  };
}

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
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
  const [date, setDate] = useState(() => formatCalendarDate(new Date()));
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

  // Sorting State. Null keeps the register order: date descending, id descending.
  const [sortConfig, setSortConfig] = useState<{
    key: SortableTransactionKey | null;
    direction: string | null;
  }>({ key: null, direction: null });

  const listGeneration = useRef(0);
  const pagingRef = useRef(false);
  const transactionsRef = useRef<Transaction[]>([]);
  const hasMoreRef = useRef(false);
  const accountNamesRef = useRef<Map<string, string>>(new Map());
  const queryRef = useRef({
    accountId: account.id,
    search: "",
    sortKey: null as SortableTransactionKey | null,
    sortDir: null as string | null,
  });
  const loadedAccountId = useRef(account.id);

  useLayoutEffect(() => {
    transactionsRef.current = transactions;
    hasMoreRef.current = hasMore;
    queryRef.current = {
      accountId: account.id,
      search: debouncedSearch,
      sortKey: sortConfig.key,
      sortDir: sortConfig.direction,
    };
  }, [
    transactions,
    hasMore,
    account.id,
    debouncedSearch,
    sortConfig.key,
    sortConfig.direction,
  ]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [searchQuery]);

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

  async function fetchPage(
    cursor: PageCursor | null,
    mode: "replace" | "append",
    generation = listGeneration.current,
  ) {
    if (mode === "replace") pagingRef.current = false;
    const query = queryRef.current;
    const args = pageArgs(query.search, query.sortKey, query.sortDir, cursor);
    try {
      let rows: Transaction[];
      if (query.accountId === "all") {
        const names = accountNamesRef.current;
        if (mode === "replace" || names.size === 0) {
          const [transactionsList, accounts] = await Promise.all([
            rust.get_all_transactions(args),
            rust.get_accounts(),
          ]);
          accountNamesRef.current = new Map(
            accounts.map((item) => [String(item.id), item.name || ""]),
          );
          rows = withAccountNames(transactionsList, accountNamesRef.current);
        } else {
          rows = withAccountNames(await rust.get_all_transactions(args), names);
        }
      } else {
        rows = await rust.get_transactions({
          ...args,
          accountId: query.accountId,
        });
      }
      if (generation !== listGeneration.current) return;
      const more = rows.length === TRANSACTION_PAGE_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);
      setTransactions((prev) =>
        mode === "append" ? [...prev, ...rows] : rows,
      );
    } catch (e) {
      if (generation !== listGeneration.current) return;
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

  function fetchTransactions() {
    const generation = ++listGeneration.current;
    return fetchPage(null, "replace", generation);
  }

  function loadMoreTransactions() {
    if (pagingRef.current || !hasMoreRef.current) return;
    const last = transactionsRef.current[transactionsRef.current.length - 1];
    if (!last) return;
    const cursor = transactionCursor(last, queryRef.current.sortKey);
    if (!cursor) return;
    pagingRef.current = true;
    void fetchPage(cursor, "append").finally(() => {
      pagingRef.current = false;
    });
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
      const applyDate = useToday ? formatCalendarDate(new Date()) : occ.date;
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
      void fetchSuggestions();
      void fetchPendingOccurrences();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  useEffect(() => {
    if (loadedAccountId.current !== account.id) {
      loadedAccountId.current = account.id;
      transactionsRef.current = [];
      hasMoreRef.current = false;
      setTransactions([]);
      setHasMore(false);
    }
    // Invalidate an in-flight page before the next fetch starts.
    const generation = ++listGeneration.current;
    queueMicrotask(() => {
      void fetchPage(null, "replace", generation);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, debouncedSearch, sortConfig.key, sortConfig.direction]);

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

  async function handleToggleArchiveAccount() {
    if (account.id === "all") return;
    const archived = !account.archived;
    try {
      await rust.set_account_archived({ id: account.id, archived });
      showToast(t(archived ? "account.archived" : "account.unarchived"), {
        type: "success",
      });
      setAccountMenuOpen(false);
      onUpdate();
    } catch (e) {
      handleAsyncError({
        context: "Failed to update account archive status",
        error: e,
        userMessage: t("error.failed_to_archive"),
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

  const listKey = `${String(account.id)}|${debouncedSearch}|${sortConfig.key ?? ""}|${sortConfig.direction ?? ""}`;

  const [accountHasTicker, setAccountHasTicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const args = {
      limit: 1,
      sortKey: "ticker",
      sortDir: "descending",
    };
    const request =
      account.id === "all"
        ? rust.get_all_transactions(args)
        : rust.get_transactions({ ...args, accountId: account.id });
    void request
      .then((rows) => {
        if (!cancelled) {
          setAccountHasTicker(rows.some((tx) => Boolean(tx.ticker)));
        }
      })
      .catch(() => {
        if (!cancelled) setAccountHasTicker(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const hasInvestment = useMemo(() => {
    return (
      accountHasTicker ||
      transactions.some(
        (tx: Transaction) => tx.ticker || (tx.shares && tx.shares !== 0),
      )
    );
  }, [accountHasTicker, transactions]);

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
        handleToggleArchiveAccount={() => {
          void handleToggleArchiveAccount();
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
        filteredTransactions={transactions}
        listKey={listKey}
        hasMore={hasMore}
        onLoadMore={loadMoreTransactions}
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
