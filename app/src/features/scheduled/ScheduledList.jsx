import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  CalendarClock,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useConfirm } from "../../contexts/confirm";
import { useToast } from "../../contexts/toast";
import { t } from "../../i18n/i18n";
import { useNumberFormat } from "../../contexts/number-format";
import { useFormatNumber, getDatePickerFormat } from "../../utils/format";
import { CURRENCIES } from "../../utils/currencies";
import CustomSelect from "../../components/ui/CustomSelect";
import NumberInput from "../../components/ui/NumberInput";
import "../../styles/Dashboard.css";

const WEEKDAY_KEYS = [
  "weekday.sunday",
  "weekday.monday",
  "weekday.tuesday",
  "weekday.wednesday",
  "weekday.thursday",
  "weekday.friday",
  "weekday.saturday",
];

const DEFAULT_FORM = {
  id: null,
  accountId: null,
  transactionType: "regular",
  payee: "",
  amount: "",
  category: "",
  notes: "",
  currency: "",
  recurrenceType: "every_n",
  intervalValue: 1,
  intervalUnit: "month",
  daysOfWeek: [],
  ordinal: 1,
  weekday: 1,
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  maxOccurrences: "",
  enabled: true,
  ticker: "",
  shares: "",
  pricePerShare: "",
  fee: "",
  isBuy: true,
};

const currencyOptions = [
  { value: "", label: "—" },
  ...CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.code} (${c.symbol})`,
  })),
];

export default function ScheduledList() {
  const [schedules, setSchedules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState({ ...DEFAULT_FORM });
  const [showForm, setShowForm] = useState(false);

  const confirm = useConfirm();
  const { showToast } = useToast();
  const formatNumber = useFormatNumber();
  const { dateFormat, firstDayOfWeek } = useNumberFormat();
  const formRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [scheds, accs] = await Promise.all([
          invoke("get_scheduled_transactions"),
          invoke("get_accounts"),
        ]);
        if (mounted) {
          setSchedules(scheds);
          setAccounts(accs);
        }
      } catch (e) {
        console.error("Failed to fetch scheduled transactions:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function fetchSchedules() {
    try {
      const r = await invoke("get_scheduled_transactions");
      setSchedules(r);
    } catch (e) {
      console.error("Failed to fetch scheduled transactions:", e);
    }
  }

  function resetForm() {
    setFormState({ ...DEFAULT_FORM });
    setIsEditing(false);
    setShowForm(false);
  }

  function handleEdit(sched) {
    setFormState({
      id: sched.id,
      accountId: sched.account_id,
      transactionType: sched.transaction_type || "regular",
      payee: sched.payee,
      amount: sched.amount,
      category: sched.category || "",
      notes: sched.notes || "",
      currency: sched.currency || "",
      recurrenceType: sched.recurrence_type,
      intervalValue: sched.interval_value || 1,
      intervalUnit: sched.interval_unit || "month",
      daysOfWeek: sched.days_of_week || [],
      ordinal: sched.ordinal || 1,
      weekday: sched.weekday ?? 1,
      startDate: sched.start_date,
      endDate: sched.end_date || "",
      maxOccurrences: sched.max_occurrences ?? "",
      enabled: sched.enabled,
      ticker: sched.ticker || "",
      shares: sched.shares ?? "",
      pricePerShare: sched.price_per_share ?? "",
      fee: sched.fee ?? "",
      isBuy: sched.is_buy ?? true,
    });
    setIsEditing(true);
    setShowForm(true);
    setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }

  async function handleDelete(id) {
    if (await confirm(t("scheduled.delete_confirm"), { kind: "warning" })) {
      try {
        await invoke("delete_scheduled_transaction", { id });
        setSchedules((cur) => cur.filter((s) => s.id !== id));
        if (formState.id === id) resetForm();
        showToast(t("scheduled.deleted_success"), "success");
      } catch (e) {
        console.error("Failed to delete scheduled transaction:", e);
        showToast(t("scheduled.error_generic"), "error");
        fetchSchedules();
      }
    }
  }

  async function handleToggleEnabled(sched) {
    try {
      await invoke("update_scheduled_transaction", {
        args: {
          id: sched.id,
          accountId: sched.account_id,
          payee: sched.payee,
          amount: sched.amount,
          category: sched.category,
          notes: sched.notes,
          currency: sched.currency,
          recurrenceType: sched.recurrence_type,
          intervalValue: sched.interval_value,
          intervalUnit: sched.interval_unit,
          daysOfWeek: sched.days_of_week,
          ordinal: sched.ordinal,
          weekday: sched.weekday,
          startDate: sched.start_date,
          endDate: sched.end_date,
          maxOccurrences: sched.max_occurrences,
          enabled: !sched.enabled,
          transactionType: sched.transaction_type,
          ticker: sched.ticker,
          shares: sched.shares,
          pricePerShare: sched.price_per_share,
          fee: sched.fee,
          isBuy: sched.is_buy,
        },
      });
      fetchSchedules();
    } catch (e) {
      console.error("Failed to toggle scheduled transaction:", e);
      showToast(t("scheduled.error_generic"), "error");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formState.accountId) {
      showToast(t("scheduled.validation.account_required"), "error");
      return;
    }
    if (
      formState.transactionType === "regular" &&
      !formState.payee.trim()
    ) {
      showToast(t("scheduled.validation.payee_required"), "error");
      return;
    }
    if (
      formState.transactionType === "investment" &&
      !formState.ticker.trim()
    ) {
      showToast(t("scheduled.validation.ticker_required"), "error");
      return;
    }
    if (
      formState.recurrenceType === "day_of_week" &&
      formState.daysOfWeek.length === 0
    ) {
      showToast(t("scheduled.validation.days_required"), "error");
      return;
    }

    try {
      const isInvestment = formState.transactionType === "investment";

      // Compute amount for investment transactions
      let amount = Number(formState.amount) || 0;
      if (isInvestment) {
        const sharesNum = Number(formState.shares) || 0;
        const priceNum = Number(formState.pricePerShare) || 0;
        const feeNum = Number(formState.fee) || 0;
        amount = formState.isBuy
          ? -(sharesNum * priceNum + feeNum)
          : sharesNum * priceNum - feeNum;
      }

      const payload = {
        accountId: formState.accountId,
        payee: isInvestment
          ? (formState.payee.trim() || (formState.isBuy ? t("scheduled.field.buy") : t("scheduled.field.sell")))
          : formState.payee.trim(),
        amount,
        category: isInvestment
          ? (formState.category.trim() || t("scheduled.field.investment_category"))
          : (formState.category.trim() || null),
        notes: formState.notes.trim() || null,
        currency: formState.currency || null,
        recurrenceType: formState.recurrenceType,
        intervalValue:
          formState.recurrenceType === "every_n"
            ? Number(formState.intervalValue) || 1
            : null,
        intervalUnit:
          formState.recurrenceType === "every_n"
            ? formState.intervalUnit
            : null,
        daysOfWeek:
          formState.recurrenceType === "day_of_week"
            ? formState.daysOfWeek
            : null,
        ordinal:
          formState.recurrenceType === "ordinal_weekday"
            ? Number(formState.ordinal)
            : null,
        weekday:
          formState.recurrenceType === "ordinal_weekday"
            ? Number(formState.weekday)
            : null,
        startDate: formState.startDate,
        endDate: formState.endDate || null,
        maxOccurrences: formState.maxOccurrences
          ? Number(formState.maxOccurrences)
          : null,
        transactionType: formState.transactionType,
        ticker: isInvestment ? formState.ticker.trim() : null,
        shares: isInvestment ? (Number(formState.shares) || null) : null,
        pricePerShare: isInvestment
          ? (Number(formState.pricePerShare) || null)
          : null,
        fee: isInvestment ? (Number(formState.fee) || 0) : null,
        isBuy: isInvestment ? formState.isBuy : null,
      };

      if (formState.id) {
        await invoke("update_scheduled_transaction", {
          args: {
            ...payload,
            id: formState.id,
            enabled: formState.enabled,
          },
        });
        showToast(t("scheduled.updated_success"), "success");
      } else {
        await invoke("create_scheduled_transaction", { args: payload });
        showToast(t("scheduled.created_success"), "success");
      }
      resetForm();
      fetchSchedules();
    } catch (e) {
      console.error("Failed to save scheduled transaction:", e);
      showToast(t("scheduled.error_generic"), "error");
    }
  }

  function toggleDayOfWeek(day) {
    setFormState((prev) => {
      const days = prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort((a, b) => a - b);
      return { ...prev, daysOfWeek: days };
    });
  }

  function getRecurrenceSummary(sched) {
    if (sched.recurrence_type === "every_n") {
      const n = sched.interval_value || 1;
      const unit = t(`scheduled.unit.${sched.interval_unit || "month"}`);
      return t("scheduled.summary.every_n", { n, unit });
    }
    if (sched.recurrence_type === "day_of_week") {
      const days = (sched.days_of_week || [])
        .map((d) => t(WEEKDAY_KEYS[d]))
        .join(", ");
      return t("scheduled.summary.days_of_week", { days });
    }
    if (sched.recurrence_type === "ordinal_weekday") {
      const ordinal = t(`scheduled.ordinal.${sched.ordinal}`);
      const weekday = t(WEEKDAY_KEYS[sched.weekday ?? 0]);
      return t("scheduled.summary.ordinal_weekday", { ordinal, weekday });
    }
    return "";
  }

  function getAccountName(accountId) {
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? acc.name : String(accountId);
  }

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
  }));

  const recurrenceTypeOptions = [
    { value: "every_n", label: t("scheduled.recurrence.every_n") },
    { value: "day_of_week", label: t("scheduled.recurrence.day_of_week") },
    {
      value: "ordinal_weekday",
      label: t("scheduled.recurrence.ordinal_weekday"),
    },
  ];

  const intervalUnitOptions = [
    { value: "day", label: t("scheduled.unit.day") },
    { value: "week", label: t("scheduled.unit.week") },
    { value: "month", label: t("scheduled.unit.month") },
    { value: "year", label: t("scheduled.unit.year") },
  ];

  const ordinalOptions = [
    { value: 1, label: t("scheduled.ordinal.1") },
    { value: 2, label: t("scheduled.ordinal.2") },
    { value: 3, label: t("scheduled.ordinal.3") },
    { value: 4, label: t("scheduled.ordinal.4") },
    { value: 5, label: t("scheduled.ordinal.5") },
    { value: -1, label: t("scheduled.ordinal.-1") },
  ];

  const weekdayOptions = WEEKDAY_KEYS.map((key, i) => ({
    value: i,
    label: t(key),
  }));

  return (
    <div className="page-container rules-container animate-in fade-in duration-500">
      <div className="hb-header-container mb-large">
        <div>
          <h1 className="hb-header-title">{t("scheduled.title")}</h1>
          <p className="hb-header-subtitle">{t("scheduled.subtitle")}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setIsEditing(false);
              setFormState({ ...DEFAULT_FORM });
            }}
            className="btn-primary"
          >
            <Plus size={16} />
            {t("scheduled.create")}
          </button>
        )}
      </div>

      {/* Form Card */}
      {showForm && (
        <div
          ref={formRef}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit size={15} />
                  {t("scheduled.update")}
                </>
              ) : (
                <>
                  <Plus size={15} />
                  {t("scheduled.create")}
                </>
              )}
            </h2>
            <button
              onClick={resetForm}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Transaction Type Toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg w-fit">
              <button
                type="button"
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    transactionType: "regular",
                  }))
                }
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  formState.transactionType === "regular"
                    ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {t("scheduled.type.regular")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    transactionType: "investment",
                  }))
                }
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  formState.transactionType === "investment"
                    ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <TrendingUp size={13} />
                {t("scheduled.type.investment")}
              </button>
            </div>

            {formState.transactionType === "regular" ? (
              <>
                {/* Row 1: Account, Payee, Amount, Currency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.account")} *
                    </label>
                    <CustomSelect
                      value={formState.accountId}
                      onChange={(val) =>
                        setFormState((prev) => ({ ...prev, accountId: val }))
                      }
                      options={accountOptions}
                      placeholder={t("scheduled.field.account")}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.payee")} *
                    </label>
                    <input
                      type="text"
                      value={formState.payee}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          payee: e.target.value,
                        }))
                      }
                      className="form-input"
                      placeholder={t("scheduled.field.payee")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.amount")}
                    </label>
                    <NumberInput
                      value={formState.amount}
                      onChange={(val) =>
                        setFormState((prev) => ({ ...prev, amount: val }))
                      }
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.currency")}
                    </label>
                    <CustomSelect
                      value={formState.currency}
                      onChange={(val) =>
                        setFormState((prev) => ({ ...prev, currency: val }))
                      }
                      options={currencyOptions}
                      placeholder={t("scheduled.field.currency")}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Row 2: Category, Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.category")}
                    </label>
                    <input
                      type="text"
                      value={formState.category}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      className="form-input"
                      placeholder={t("scheduled.field.category")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.notes")}
                    </label>
                    <input
                      type="text"
                      value={formState.notes}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="form-input"
                      placeholder={t("scheduled.field.notes")}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Investment Row 1: Account, Buy/Sell, Ticker, Shares */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.account")} *
                    </label>
                    <CustomSelect
                      value={formState.accountId}
                      onChange={(val) =>
                        setFormState((prev) => ({ ...prev, accountId: val }))
                      }
                      options={accountOptions}
                      placeholder={t("scheduled.field.account")}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.operation")}
                    </label>
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                      <button
                        type="button"
                        onClick={() =>
                          setFormState((prev) => ({ ...prev, isBuy: true }))
                        }
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          formState.isBuy
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <ArrowDownLeft size={13} />
                        {t("scheduled.field.buy")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormState((prev) => ({ ...prev, isBuy: false }))
                        }
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          !formState.isBuy
                            ? "bg-rose-500 text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <ArrowUpRight size={13} />
                        {t("scheduled.field.sell")}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.ticker")} *
                    </label>
                    <input
                      type="text"
                      value={formState.ticker}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          ticker: e.target.value.toUpperCase(),
                        }))
                      }
                      className="form-input"
                      placeholder="AAPL"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.shares")}
                    </label>
                    <NumberInput
                      value={formState.shares}
                      onChange={(val) =>
                        setFormState((prev) => ({ ...prev, shares: val }))
                      }
                      className="form-input"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Investment Row 2: Price, Fee, Currency, Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.price_per_share")}
                    </label>
                    <NumberInput
                      value={formState.pricePerShare}
                      onChange={(val) =>
                        setFormState((prev) => ({
                          ...prev,
                          pricePerShare: val,
                        }))
                      }
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.fee")}
                    </label>
                    <NumberInput
                      value={formState.fee}
                      onChange={(val) =>
                        setFormState((prev) => ({ ...prev, fee: val }))
                      }
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.currency")}
                    </label>
                    <CustomSelect
                      value={formState.currency}
                      onChange={(val) =>
                        setFormState((prev) => ({ ...prev, currency: val }))
                      }
                      options={currencyOptions}
                      placeholder={t("scheduled.field.currency")}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      {t("scheduled.field.notes")}
                    </label>
                    <input
                      type="text"
                      value={formState.notes}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="form-input"
                      placeholder={t("scheduled.field.notes")}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Row 3: Recurrence configuration */}
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t("scheduled.field.recurrence")}
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                <CustomSelect
                  value={formState.recurrenceType}
                  onChange={(val) =>
                    setFormState((prev) => ({ ...prev, recurrenceType: val }))
                  }
                  options={recurrenceTypeOptions}
                  className="w-52"
                />

                {formState.recurrenceType === "every_n" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {t("scheduled.recurrence.every")}
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={formState.intervalValue}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          intervalValue: e.target.value,
                        }))
                      }
                      className="form-input !w-16 text-center"
                    />
                    <CustomSelect
                      value={formState.intervalUnit}
                      onChange={(val) =>
                        setFormState((prev) => ({ ...prev, intervalUnit: val }))
                      }
                      options={intervalUnitOptions}
                      className="w-32"
                    />
                  </div>
                )}

                {formState.recurrenceType === "day_of_week" && (
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_KEYS.map((key, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDayOfWeek(i)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                          formState.daysOfWeek.includes(i)
                            ? "bg-brand-500 text-white shadow-sm"
                            : "bg-white dark:bg-slate-600 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-500"
                        }`}
                      >
                        {t(key).slice(0, 3)}
                      </button>
                    ))}
                  </div>
                )}

                {formState.recurrenceType === "ordinal_weekday" && (
                  <div className="flex items-center gap-2">
                    <CustomSelect
                      value={formState.ordinal}
                      onChange={(val) =>
                        setFormState((prev) => ({
                          ...prev,
                          ordinal: Number(val),
                        }))
                      }
                      options={ordinalOptions}
                      className="w-24"
                    />
                    <CustomSelect
                      value={formState.weekday}
                      onChange={(val) =>
                        setFormState((prev) => ({
                          ...prev,
                          weekday: Number(val),
                        }))
                      }
                      options={weekdayOptions}
                      className="w-36"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Row 4: Start date, End date, Max occurrences + Submit */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  {t("scheduled.field.start_date")}
                </label>
                <DatePicker
                  selected={
                    formState.startDate
                      ? new Date(formState.startDate + "T00:00:00")
                      : null
                  }
                  onChange={(date) =>
                    setFormState((prev) => {
                      if (!date) return { ...prev, startDate: prev.startDate };
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(
                        2,
                        "0",
                      );
                      const day = String(date.getDate()).padStart(2, "0");
                      return { ...prev, startDate: `${year}-${month}-${day}` };
                    })
                  }
                  dateFormat={getDatePickerFormat(dateFormat)}
                  calendarStartDay={firstDayOfWeek}
                  portalId="datepicker-portal"
                  className="form-input"
                />
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  {t("scheduled.field.end_date")}
                </label>
                <DatePicker
                  selected={
                    formState.endDate
                      ? new Date(formState.endDate + "T00:00:00")
                      : null
                  }
                  onChange={(date) =>
                    setFormState((prev) => {
                      if (!date) return { ...prev, endDate: "" };
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(
                        2,
                        "0",
                      );
                      const day = String(date.getDate()).padStart(2, "0");
                      return { ...prev, endDate: `${year}-${month}-${day}` };
                    })
                  }
                  dateFormat={getDatePickerFormat(dateFormat)}
                  calendarStartDay={firstDayOfWeek}
                  isClearable
                  portalId="datepicker-portal"
                  className="form-input"
                />
              </div>
              <div className="w-28">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  {t("scheduled.field.max_occurrences")}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formState.maxOccurrences}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      maxOccurrences: e.target.value,
                    }))
                  }
                  className="form-input text-center"
                  placeholder="∞"
                />
              </div>
              <div className="flex-1" />
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary"
                >
                  {t("scheduled.cancel")}
                </button>
              )}
              <button type="submit" className="btn-primary">
                <Save size={15} />
                {isEditing ? t("scheduled.update") : t("scheduled.create")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {schedules.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
          <CalendarClock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">
            {t("scheduled.empty")}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            {t("scheduled.empty_hint")}
          </p>
        </div>
      ) : (
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
                >
                  <td className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300">
                    {getAccountName(sched.account_id)}
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
                      {getRecurrenceSummary(sched)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                    {sched.occurrences_count}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => handleToggleEnabled(sched)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title={
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
                        onClick={() => handleEdit(sched)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-brand-500 cursor-pointer"
                        title={t("scheduled.update")}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(sched.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors text-slate-400 hover:text-rose-500 cursor-pointer"
                        title={t("scheduled.delete_confirm")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
