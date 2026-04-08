import { useState, useEffect, useMemo, useRef } from "react";
import DatePicker from "react-datepicker";
import type { Day } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import { createPortal } from "react-dom";
import { rust } from "../../api/tauri-client";
import {
  Search,
  Plus,
  MoreVertical,
  Copy,
  Trash2,
  Check,
  X,
  ArrowRightLeft,
  Edit,
  ArrowUp,
  ArrowDown,
  CalendarClock,
  CalendarCheck,
  SkipForward,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import {
  useFormatNumber,
  useParseNumber,
  useFormatDate,
  getDatePickerFormat,
} from "../../utils/format";
import { useNumberFormat } from "../../contexts/number-format";
import { useConfirm } from "../../contexts/confirm";
import NumberInput from "../../components/ui/NumberInput";
import CustomSelect from "../../components/ui/CustomSelect";
import MaskedNumber from "../../components/ui/MaskedNumber";
import { t } from "../../i18n/i18n";
import { CURRENCIES } from "../../utils/currencies";
import { useCustomRate } from "../../hooks/useCustomRate";
import useTagColors from "../../hooks/useTagColors";
import "../../styles/Scheduled.css";

interface Account {
  id: string | number;
  name?: string;
  balance?: number;
  totalValue?: number;
  currency?: string;
  kind?: string;
}

interface AccountDetailsProps {
  account: Account;
  onUpdate: () => void;
}

interface AutocompleteSuggestion {
  value: string;
  label?: string;
  type?: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: AutocompleteSuggestion[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

interface Transaction {
  id: string | number;
  date: string;
  payee: string;
  category?: string;
  notes?: string;
  amount: number;
  account_id: string | number;
  account_name?: string;
  ticker?: string;
  shares?: number;
  price_per_share?: number;
  fee?: number;
  currency?: string;
  [key: string]: unknown;
}

interface PendingOccurrence {
  scheduled_tx_id: string | number;
  date: string;
  payee?: string;
  category?: string;
  notes?: string;
  amount: number;
  account_id?: string | number;
  account_name?: string;
  status?: string;
}

interface TickerSuggestion {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  typeDisp?: string;
  currency?: string;
}

interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

interface RuleAction {
  field: string;
  value: string;
}

interface Rule {
  priority: number;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  logic?: string;
  match_field?: string;
  match_pattern?: string;
  action_field?: string;
  action_value?: string;
}

interface AvailableAccount {
  id: string | number;
  name: string;
  kind?: string;
  currency?: string;
}

interface MenuCoords {
  x?: number;
  y?: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
}

type FormFieldKey = "payee" | "category" | "notes" | "amount" | "date" | "ticker" | "shares" | "price" | "fee";

export default function AccountDetails({ account, onUpdate }: AccountDetailsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingOccurrences, setPendingOccurrences] = useState<PendingOccurrence[]>([]);
  const confirm = useConfirm();
  const { checkAndPrompt, dialog } = useCustomRate();
  const { getTagClasses } = useTagColors();

  const formatNumber = useFormatNumber();
  const parseNumber = useParseNumber();
  const formatDate = useFormatDate();
  const {
    dateFormat,
    firstDayOfWeek,
    currency: appCurrency,
  } = useNumberFormat();
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [payeeSuggestions, setPayeeSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<AvailableAccount[]>([]);
  const [addTargetAccount, setAddTargetAccount] = useState<AvailableAccount | null>(null);
  const [tickerSuggestions, setTickerSuggestions] = useState<TickerSuggestion[]>([]);
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);

  // Editing state
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | number | null>(null);
  // Coordinates/state for portal menu (so it can render above scrollable containers)
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  // Keep track of original notes value when editing (used to warn about modifying auto-generated brokerage notes)
  const [originalNotes, setOriginalNotes] = useState("");

  // Account actions state
  const [isRenamingAccount, setIsRenamingAccount] = useState(false);
  const [renameValue, setRenameValue] = useState(account.name);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    setRenameValue(account.name);
  }, [account.name]);

  // Close account menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountMenuOpen && !(event.target as HTMLElement).closest(".account-action-menu")) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (isAdding) {
      const target = account.id === "all" ? addTargetAccount : account;
      setSelectedCurrency(target?.currency || appCurrency || "USD");
    }
  }, [isAdding, account, addTargetAccount, appCurrency]);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [payee, setPayee] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState("cash");
  const [selectedCurrency, setSelectedCurrency] = useState(
    () => localStorage.getItem("hb_currency") || "USD",
  );

  // Brokerage Form State
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [fee, setFee] = useState("");
  // Removed cashAccountId/Name/Suggestions as we are unified now
  const [isBuy, setIsBuy] = useState(true);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: string | null }>({ key: null, direction: null });

  // Rules Engine Logic
  const prevValues = useRef({
    payee,
    category,
    notes,
    amount,
    date,
    ticker,
    shares,
    price: pricePerShare,
    fee,
  });

  // Ref for the account rename input (avoid string-based querySelector + escaping)
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rules.length) return;

    // Map rule field names to state values and setters
    const fieldMap = {
      payee: { value: payee, set: setPayee },
      category: { value: category, set: setCategory },
      notes: { value: notes, set: setNotes },
      amount: { value: amount, set: setAmount },
      date: { value: date, set: setDate },
      ticker: { value: ticker, set: setTicker },
      shares: { value: shares, set: setShares },
      price: { value: pricePerShare, set: setPricePerShare },
      fee: { value: fee, set: setFee },
    };

    const currentValues = {
      payee,
      category,
      notes,
      amount,
      date,
      ticker,
      shares,
      price: pricePerShare,
      fee,
    };

    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    // Evaluate a single condition against current form values
    const evaluateCondition = (condition: RuleCondition, values: Record<string, string>) => {
      const fieldValue = values[condition.field];
      const conditionValue = condition.value;
      const strFieldValue = String(fieldValue ?? "");
      const strCondValue = String(conditionValue ?? "");
      const numFieldValue = parseFloat(fieldValue);
      const numCondValue = parseFloat(conditionValue);

      switch (condition.operator) {
        case "equals":
          return strFieldValue === strCondValue;
        case "not_equals":
          return strFieldValue !== strCondValue;
        case "contains":
          return strFieldValue
            .toLowerCase()
            .includes(strCondValue.toLowerCase());
        case "not_contains":
          return !strFieldValue
            .toLowerCase()
            .includes(strCondValue.toLowerCase());
        case "starts_with":
          return strFieldValue
            .toLowerCase()
            .startsWith(strCondValue.toLowerCase());
        case "ends_with":
          return strFieldValue
            .toLowerCase()
            .endsWith(strCondValue.toLowerCase());
        case "greater_than":
          return (
            !isNaN(numFieldValue) &&
            !isNaN(numCondValue) &&
            numFieldValue > numCondValue
          );
        case "less_than":
          return (
            !isNaN(numFieldValue) &&
            !isNaN(numCondValue) &&
            numFieldValue < numCondValue
          );
        case "is_empty":
          return (
            strFieldValue === "" ||
            fieldValue === null ||
            fieldValue === undefined
          );
        case "is_not_empty":
          return (
            strFieldValue !== "" &&
            fieldValue !== null &&
            fieldValue !== undefined
          );
        default:
          return strFieldValue === strCondValue;
      }
    };

    // Evaluate all conditions for a rule using the logic operator (and/or)
    const evaluateRule = (rule: Rule, values: Record<string, string>) => {
      // Handle new format with conditions array
      if (rule.conditions && rule.conditions.length > 0) {
        const logic = rule.logic || "and";
        if (logic === "and") {
          return rule.conditions.every((cond: RuleCondition) =>
            evaluateCondition(cond, values),
          );
        } else {
          return rule.conditions.some((cond: RuleCondition) =>
            evaluateCondition(cond, values),
          );
        }
      }
      // Legacy format: single match_field/match_pattern (exact match)
      return rule.match_field ? values[rule.match_field] === rule.match_pattern : false;
    };

    // Apply all actions for a rule
    const applyRuleActions = (rule: Rule) => {
      // Handle new format with actions array
      if (rule.actions && rule.actions.length > 0) {
        rule.actions.forEach((action: RuleAction) => {
          const target = fieldMap[action.field as FormFieldKey];
          if (target && target.value !== action.value) {
            target.set(action.value);
          }
        });
      } else {
        // Legacy format: single action_field/action_value
        const target = fieldMap[rule.action_field as FormFieldKey];
        if (target && target.value !== rule.action_value) {
          target.set(rule.action_value ?? "");
        }
      }
    };

    // Identify changed fields
    const changedFields = Object.keys(currentValues).filter(
      (k) => currentValues[k as FormFieldKey] !== prevValues.current[k as FormFieldKey],
    );

    // Only apply rules if something changed
    if (changedFields.length > 0) {
      sortedRules.forEach((rule) => {
        if (evaluateRule(rule, currentValues)) {
          applyRuleActions(rule);
        }
      });
    }

    prevValues.current = currentValues;
  }, [
    payee,
    category,
    notes,
    rules,
    amount,
    date,
    ticker,
    shares,
    pricePerShare,
    fee,
  ]);

  async function fetchSuggestions() {
    try {
      const [payees, accountsList, categories, fetchedRules] =
        await Promise.all([
          rust.get_payees({}) as Promise<string[]>,
          rust.get_accounts({}) as Promise<Account[]>,
          rust.get_categories({}) as Promise<string[]>,
          rust.get_rules({}) as Promise<Rule[]>,
        ]);
      setRules(fetchedRules);

      // Filter out current account from accounts list
      const otherAccounts = (accountsList as Account[])
        .filter((a: Account) => a.id !== account.id)
        .map((a: Account) => ({ name: a.name || "", id: a.id, kind: a.kind }));

      setAvailableAccounts(otherAccounts);

      // If viewing the consolidated "All" view, default the add-target to the first account
      if (
        account.id === "all" &&
        otherAccounts.length > 0 &&
        !addTargetAccount
      ) {
        setAddTargetAccount(otherAccounts[0]);
      }

      const accountOptions = otherAccounts.map((acc: AvailableAccount) => ({
        value: acc.name,
        label: t("import.field.account"),
        type: "account",
      }));
      const payeeOptions = (payees as string[]).map((name: string) => ({
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
        (categories as string[]).map((c: string) => ({
          value: c,
          label: t("import.field.category"),
          type: "category",
        })),
      );
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    }
  }

  async function fetchTransactions() {
    try {
      let txs: Transaction[];
      if (account.id === "all") {
        const [transactionsList, accounts] = await Promise.all([
          rust.get_all_transactions() as Promise<Transaction[]>,
          rust.get_accounts({}) as Promise<Account[]>,
        ]);
        // Attach account_name for display in the consolidated view
        txs = (transactionsList as Transaction[]).map((tx: Transaction) => {
          const acc = (accounts as Account[]).find((a: Account) => a.id === tx.account_id);
          return {
            ...tx,
            account_name: acc ? acc.name : String(tx.account_id),
          };
        });
      } else {
        txs = await rust.get_transactions({ accountId: account.id }) as Transaction[];
      }
      setTransactions(txs);
    } catch (e) {
      console.error("Failed to fetch transactions:", e);
    }
  }

  async function fetchPendingOccurrences() {
    try {
      const accountId = account.id === "all" ? null : account.id;
      const occs = await rust.get_pending_occurrences({ accountId }) as PendingOccurrence[];
      setPendingOccurrences(occs);
    } catch (e) {
      console.error("Failed to fetch pending occurrences:", e);
      setPendingOccurrences([]);
    }
  }

  async function handleApplyOccurrence(occ: PendingOccurrence, useToday: boolean) {
    try {
      const applyDate = useToday
        ? new Date().toISOString().split("T")[0]
        : occ.date;
      await rust.apply_scheduled_occurrence({
        scheduledTxId: occ.scheduled_tx_id,
        applyDate,
      });
      await Promise.all([fetchTransactions(), fetchPendingOccurrences()]);
      onUpdate();
    } catch (e) {
      console.error("Failed to apply scheduled occurrence:", e);
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
      console.error("Failed to skip scheduled occurrence:", e);
    }
  }

  useEffect(() => {
    if (account) {
      fetchTransactions();
      fetchSuggestions();
      fetchPendingOccurrences();
    }
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

  // Auto-set category to Transfer if payee is an account
  useEffect(() => {
    if (availableAccounts?.some((a) => a.name === payee)) {
      setCategory("Transfer");
    }
  }, [payee, availableAccounts]);

  useEffect(() => {
    if (
      editForm.payee &&
      availableAccounts?.some((a) => a.name === editForm.payee)
    ) {
      setEditForm((prev) => ({ ...prev, category: "Transfer" }));
    }
  }, [editForm.payee, availableAccounts]);

  const tickerTimeoutRef = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), []);

  const handleTickerChange = (query: string) => {
    if (tickerTimeoutRef.current) clearTimeout(tickerTimeoutRef.current);

    if (!query || query.length < 2) {
      setTickerSuggestions([]);
      return;
    }

    tickerTimeoutRef.current = setTimeout(async () => {
      try {
        const suggestions = await rust.search_ticker({ query }) as TickerSuggestion[];
        setTickerSuggestions(suggestions);
        setShowTickerSuggestions(true);
      } catch (error) {
        console.error("Error fetching ticker suggestions:", error);
      }
    }, 300);
  };

  // Handle input changes
  const handleSharesChange = (num: number) => {
    setShares(String(num));
  };

  const handlePricePerShareChange = (num: number) => {
    setPricePerShare(String(num));
  };

  async function handleRenameAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!renameValue?.trim()) return;
    try {
      await rust.rename_account({ id: account.id, newName: renameValue });
      setIsRenamingAccount(false);
      setAccountMenuOpen(false);
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Failed to rename account:", e);
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
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Failed to delete account:", e);
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
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
        setSelectedCurrency(localStorage.getItem("hb_currency") || "USD");
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
        setSelectedCurrency(localStorage.getItem("hb_currency") || "USD");
      }

      setIsAdding(false);

      fetchTransactions();
      fetchSuggestions();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Failed to create transaction:", e);
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
      fetchTransactions();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Failed to update transaction:", e);
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
      fetchTransactions();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Failed to delete transaction:", e);
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
      fetchTransactions();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Failed to duplicate transaction:", e);
    }
  }

  const handleSort = (key: string) => {
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
    let data = transactions.filter((tx: Transaction) => {
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
      data.sort((a: Transaction, b: Transaction) => {
        let aValue: string | number = (a[sortConfig.key!] as string | number) ?? "";
        let bValue: string | number = (b[sortConfig.key!] as string | number) ?? "";

        // Handle numeric values
        if (
          ["amount", "shares", "price_per_share", "fee"].includes(
            sortConfig.key!,
          )
        ) {
          aValue = parseFloat(String(aValue) || "0");
          bValue = parseFloat(String(bValue) || "0");
        } else if (sortConfig.key === "date") {
          aValue = new Date(aValue as string).getTime();
          bValue = new Date(bValue as string).getTime();
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

  const getSortIcon = (key: string) => {
    const active = sortConfig.key === key;
    const direction = active ? sortConfig.direction : null;

    return (
      <span className={`inline-flex w-4 h-4 ${!direction ? "invisible" : ""}`}>
        {direction === "descending" ? (
          <ArrowDown className="w-4 h-4" />
        ) : (
          <ArrowUp className="w-4 h-4" />
        )}
      </span>
    );
  };

  return (
    <div className="page-container account-details-scaled-container">
      {/* Header */}
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
                  <span className="hidden sm:inline">
                    {t("account.cancel")}
                  </span>
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
                      // Slight timeout to ensure input renders before focus
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

      {/* Add Transaction Form */}
      {isAdding && (
        <div className="form-card animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold mb-0 text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-500" />
              {t("account.new_transaction")}
            </h3>
            {account.id === "all" && availableAccounts.length > 0 && (
              <div className="w-48">
                <CustomSelect
                  value={addTargetAccount ? addTargetAccount.id : ""}
                  onChange={(val) => {
                    const selected = availableAccounts.find(
                      (a) => String(a.id) === String(val),
                    );
                    setAddTargetAccount(selected || null);
                  }}
                  options={availableAccounts.map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                  placeholder={t("account.placeholder.select_account")}
                />
              </div>
            )}

            <div className="ml-4">
              <div className="toggle-group">
                <button
                  type="button"
                  onClick={() => setTransactionType("cash")}
                  className={`toggle-group-btn ${
                    transactionType === "cash" ? "toggle-group-btn-active" : ""
                  }`}
                >
                  {t("dashboard.assets.cash")}
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType("investment")}
                  className={`toggle-group-btn flex items-center gap-1.5 ${
                    transactionType === "investment"
                      ? "toggle-group-btn-active"
                      : ""
                  }`}
                >
                  {t("transaction.type.investment")}
                </button>
              </div>
            </div>
          </div>

          {transactionType === "investment" ? (
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">
                    {t("account.field.date")}
                  </label>
                  <DatePicker
                    selected={date ? new Date(date) : null}
                    onChange={(date: Date | null) =>
                      setDate(date ? date.toISOString().split("T")[0] : "")
                    }
                    dateFormat={getDatePickerFormat(dateFormat)}
                    calendarStartDay={firstDayOfWeek as Day}
                    shouldCloseOnSelect={false}
                    required
                    portalId="datepicker-portal"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    {t("scheduled.field.operation")}
                  </label>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setIsBuy(true)}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        isBuy
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <ArrowDownLeft size={13} />
                      {t("transaction.type.buy")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBuy(false)}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        !isBuy
                          ? "bg-rose-500 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <ArrowUpRight size={13} />
                      {t("transaction.type.sell")}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <label className="form-label">
                    {t("import.field.ticker")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={"AAPL"}
                    className="form-input uppercase"
                    value={ticker}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setTicker(val);
                      handleTickerChange(val);
                      setShowTickerSuggestions(true);
                    }}
                    onBlur={() =>
                      setTimeout(() => setShowTickerSuggestions(false), 200)
                    }
                    onFocus={() =>
                      ticker.length >= 2 && setShowTickerSuggestions(true)
                    }
                  />
                  {showTickerSuggestions && tickerSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 mt-1 max-h-60 overflow-y-auto">
                      {tickerSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm"
                          onClick={() => {
                            setTicker(suggestion.symbol);
                            setShowTickerSuggestions(false);
                            if (suggestion.currency) {
                              setSelectedCurrency(
                                suggestion.currency || appCurrency || "USD",
                              );
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {suggestion.symbol}
                            </span>
                            {suggestion.currency && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                {suggestion.currency}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {suggestion.shortname || suggestion.longname}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {suggestion.exchange} - {suggestion.typeDisp}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label">
                    {t("import.field.shares")}
                  </label>
                  <NumberInput
                    value={shares}
                    onChange={(num) => handleSharesChange(num)}
                    className="form-input"
                    placeholder={formatNumber(0, {
                      maximumFractionDigits: 6,
                      minimumFractionDigits: 0,
                      useGrouping: false,
                    })}
                    maximumFractionDigits={6}
                    useGrouping={false}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">
                    {t("account.field.price_per_share")}
                  </label>
                  <NumberInput
                    value={pricePerShare}
                    onChange={(num) => handlePricePerShareChange(num)}
                    className="form-input"
                    placeholder={formatNumber(0, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })}
                    maximumFractionDigits={4}
                    minimumFractionDigits={2}
                    useGrouping={false}
                  />
                </div>

                <div>
                  <label className="form-label">{t("import.field.fee")}</label>
                  <NumberInput
                    value={fee}
                    onChange={(val: number) => setFee(String(val))}
                    className="form-input"
                    placeholder={formatNumber(0, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })}
                  />
                </div>

                <div>
                  <label className="form-label">
                    {t("import.field.currency")}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <CustomSelect
                        options={CURRENCIES.map((c) => ({
                          value: c.code,
                          label: `${c.code} - ${c.name}`,
                        }))}
                        value={selectedCurrency}
                        onChange={async (val: string | number) => {
                          setSelectedCurrency(String(val));
                          if (val) await checkAndPrompt(String(val));
                        }}
                        placeholder="Select currency"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button type="submit" className="btn-primary">
                  <Check className="w-4 h-4" />
                  {t("account.save_transaction")}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">
                    {t("account.field.date")}
                  </label>
                  <DatePicker
                    selected={date ? new Date(date) : null}
                    onChange={(date: Date | null) =>
                      setDate(date ? date.toISOString().split("T")[0] : "")
                    }
                    dateFormat={getDatePickerFormat(dateFormat)}
                    calendarStartDay={firstDayOfWeek as Day}
                    shouldCloseOnSelect={false}
                    required
                    portalId="datepicker-portal"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    {t("import.field.payee")}
                  </label>
                  <AutocompleteInput
                    suggestions={payeeSuggestions}
                    placeholder={t("account.placeholder.payee")}
                    className="form-input"
                    value={payee}
                    onChange={setPayee}
                  />
                </div>

                <div>
                  <label className="form-label">
                    {t("import.field.category")}
                  </label>
                  <AutocompleteInput
                    suggestions={categorySuggestions}
                    placeholder={t("import.field.category")}
                    className={`form-input ${
                      availableAccounts?.some((a) => a.name === payee)
                        ? "!bg-slate-100 dark:!bg-slate-800 !text-slate-500 dark:!text-slate-400"
                        : ""
                    }`}
                    value={category}
                    onChange={setCategory}
                    disabled={availableAccounts?.some((a) => a.name === payee)}
                  />
                </div>

                <div>
                  <label className="form-label">
                    {t("import.field.notes")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("account.notes_placeholder")}
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">
                    {t("import.field.amount")}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    step="0.01"
                    placeholder={formatNumber(0, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })}
                    className="form-input font-semibold"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">
                    {t("import.field.currency")}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <CustomSelect
                        options={CURRENCIES.map((c) => ({
                          value: c.code,
                          label: `${c.code} - ${c.name}`,
                        }))}
                        value={selectedCurrency}
                        onChange={async (val: string | number) => {
                          setSelectedCurrency(String(val));
                          if (val) await checkAndPrompt(String(val));
                        }}
                        placeholder="Select currency"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button type="submit" className="btn-primary">
                  <Check className="w-4 h-4" />
                  {t("account.save_transaction")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 overflow-visible hover:shadow-lg transition-shadow duration-300 px-4 lg:px-6">
        <div className="overflow-x-auto">
          <table className="account-transactions-table min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-white dark:bg-slate-800 rounded-t-2xl">
              <tr>
                <th
                  onClick={() => handleSort("date")}
                  className="px-6 py-4 text-left text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider w-32 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {t("import.field.date")} {getSortIcon("date")}
                  </div>
                </th>
                {account.id === "all" && (
                  <th
                    onClick={() => handleSort("account_name")}
                    className="px-6 py-4 text-left text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider min-w-[10rem] cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {t("import.field.account")} {getSortIcon("account_name")}
                    </div>
                  </th>
                )}
                <th
                  onClick={() => handleSort("payee")}
                  className="px-6 py-4 text-left text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {t("import.field.payee")} {getSortIcon("payee")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("category")}
                  className="px-6 py-4 text-left text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider min-w-[10rem] cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {t("import.field.category")} {getSortIcon("category")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("notes")}
                  className="px-6 py-4 text-left text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {t("import.field.notes")} {getSortIcon("notes")}
                  </div>
                </th>
                {hasInvestment && (
                  <>
                    <th
                      onClick={() => handleSort("ticker")}
                      className="px-6 py-4 text-left text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider min-w-[5rem] cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        {t("import.field.ticker")} {getSortIcon("ticker")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("shares")}
                      className="px-6 py-4 text-right text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider w-36 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        {t("import.field.shares")} {getSortIcon("shares")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("price_per_share")}
                      className="px-6 py-4 text-right text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider w-36 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        {t("import.field.price")}{" "}
                        {getSortIcon("price_per_share")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("fee")}
                      className="px-6 py-4 text-right text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider w-28 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        {t("import.field.fee")} {getSortIcon("fee")}
                      </div>
                    </th>
                  </>
                )}
                <th
                  onClick={() => handleSort("amount")}
                  className="px-6 py-4 text-right text-xs font-bold !text-slate-700 dark:!text-slate-300 uppercase tracking-wider w-36 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    {t("import.field.amount")} {getSortIcon("amount")}
                  </div>
                </th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
              {/* Ghost rows for pending scheduled transactions */}
              {pendingOccurrences.length > 0 && (
                <>
                  <tr className="scheduled-ghost-separator">
                    <td
                      colSpan={
                        account.id === "all"
                          ? !hasInvestment
                            ? 7
                            : 11
                          : !hasInvestment
                            ? 6
                            : 10
                      }
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
                          <span className="text-slate-300 dark:text-slate-600">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-3 text-sm text-slate-400 dark:text-slate-500 max-w-xs truncate">
                        {occ.notes || (
                          <span className="text-slate-300 dark:text-slate-600">
                            -
                          </span>
                        )}
                      </td>

                      {hasInvestment && (
                        <>
                          <td className="px-6 py-3">
                            <span className="text-slate-300 dark:text-slate-600">
                              -
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-slate-300 dark:text-slate-600">
                              -
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-slate-300 dark:text-slate-600">
                              -
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-slate-300 dark:text-slate-600">
                              -
                            </span>
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
                              const rect =
                                e.currentTarget.getBoundingClientRect();
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
                            menuOpenId ===
                            `sched-${occ.scheduled_tx_id}-${occ.date}-${idx}`
                              ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              : ""
                          }`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpenId ===
                          `sched-${occ.scheduled_tx_id}-${occ.date}-${idx}` &&
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
                        colSpan={
                          account.id === "all"
                            ? !hasInvestment
                              ? 7
                              : 11
                            : !hasInvestment
                              ? 6
                              : 10
                        }
                        className="h-0 p-0 border-t-2 border-slate-200 dark:border-slate-600 border-dashed"
                      ></td>
                    </tr>
                  )}
                </>
              )}
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      account.id === "all"
                        ? !hasInvestment
                          ? 7
                          : 11
                        : !hasInvestment
                          ? 6
                          : 10
                    }
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
                                date: date
                                  ? date.toISOString().split("T")[0]
                                  : "",
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
                              {(editForm.account_name as string) || String(editForm.account_id ?? "")}
                            </span>
                          </td>
                        )}

                        {/* If brokerage tx, show brokerage-specific editable fields (only for non-cash views) */}
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
                                              suggestion.currency ||
                                              editForm.currency,
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
                                          {suggestion.shortname ||
                                            suggestion.longname}
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
                                  value={editForm.price_per_share as number | string | undefined}
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
                                  const p =
                                    parseNumber(editForm.price_per_share) || 0;
                                  const totalNum = Math.abs(s) * p;
                                  const sign =
                                    editForm.payee === "Sell" || s < 0
                                      ? ""
                                      : "+";
                                  return (
                                    <span className="flex items-center gap-1 justify-end">
                                      {sign}
                                      <MaskedNumber
                                        value={totalNum}
                                        options={{
                                          style: "currency",
                                          currency:
                                            editForm.currency || appCurrency,
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
                          // Non-brokerage edit row
                          <>
                            <td className="px-6 py-3">
                              <AutocompleteInput
                                suggestions={payeeSuggestions}
                                className="w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                value={editForm.payee as string}
                                onChange={(val) =>
                                  setEditForm({ ...editForm, payee: val })
                                }
                              />
                            </td>

                            <td className="px-6 py-3">
                              <AutocompleteInput
                                suggestions={categorySuggestions}
                                className={`w-full p-2 text-sm border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none ${
                                  availableAccounts?.some(
                                    (a) => a.name === editForm.payee,
                                  )
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

                            {/* If the table includes brokerage columns (non-cash views), insert placeholders so columns stay aligned */}
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
                            <span className="text-slate-400 dark:text-slate-500">
                              -
                            </span>
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
                                <span className="font-medium uppercase">
                                  {tx.ticker}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">
                                  -
                                </span>
                              )}
                            </td>

                            <td
                              className="px-6 py-4 whitespace-nowrap text-sm text-right cursor-pointer text-slate-700 dark:text-slate-300"
                              onClick={() => startEditing(tx)}
                            >
                              {typeof tx.shares !== "undefined" &&
                              tx.shares !== null ? (
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
                                <span className="text-slate-400 dark:text-slate-500">
                                  -
                                </span>
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
                                <span className="text-slate-400 dark:text-slate-500">
                                  -
                                </span>
                              )}
                            </td>

                            <td
                              className="px-6 py-4 whitespace-nowrap text-sm text-right cursor-pointer text-slate-700 dark:text-slate-300"
                              onClick={() => startEditing(tx)}
                            >
                              {typeof tx.fee !== "undefined" &&
                              tx.fee !== null ? (
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
                                <span className="text-slate-400 dark:text-slate-500">
                                  -
                                </span>
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
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {dialog}
    </div>
  );
}

function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  disabled,
  ...props
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!value) {
      return suggestions;
    } else {
      const query = value.toLowerCase();
      return suggestions.filter((s) => s.value.toLowerCase().includes(query));
    }
  }, [value, suggestions]);

  return (
    <div className="relative w-full">
      <input
        {...props}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-auto text-left py-1">
          {filtered.map((s, i) => (
            <li
              key={i}
              className="px-3 py-2 hover:bg-brand-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center text-sm text-slate-700 dark:text-slate-200"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.value);
                setIsOpen(false);
              }}
            >
              <span className="font-medium">{s.value}</span>
              {s.type === "account" && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" />
                  {t("account.tag.transfer")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

