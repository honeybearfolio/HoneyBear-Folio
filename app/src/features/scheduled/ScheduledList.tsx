import { useState, useEffect, useRef } from "react";
import { rust } from "../../api/tauri-client";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import { Plus } from "lucide-react";
import { useConfirm } from "../../stores/confirm";
import { useToast } from "../../stores/toast";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "../../stores/number-format";
import "../../styles/Dashboard.css";
import { ListSkeleton, ErrorState } from "../../components/ui/Skeleton";
import {
  createDefaultScheduledForm,
  toScheduledPayload,
} from "./scheduled-helpers";
import type {
  ScheduleRecord,
  AccountRecord,
  TickerSuggestion,
} from "./scheduled-types";
import ScheduledForm from "./ScheduledForm";
import ScheduledTable from "./ScheduledTable";

export default function ScheduledList() {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState(() =>
    createDefaultScheduledForm(),
  );
  const [showForm, setShowForm] = useState(false);
  const [tickerSuggestions, setTickerSuggestions] = useState<
    TickerSuggestion[]
  >([]);
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(
    null,
  );

  const confirm = useConfirm();
  const { showToast } = useToast();
  const { dateFormat, firstDayOfWeek } = useNumberFormat();
  const formRef = useRef<HTMLDivElement>(null);
  const tickerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [scheds, accs] = await Promise.all([
          rust.get_scheduled_transactions(),
          rust.get_accounts(),
        ]);
        if (mounted) {
          setSchedules(scheds as ScheduleRecord[]);
          setAccounts(accs);
          setFetchError(null);
        }
      } catch (e) {
        console.error("Failed to fetch scheduled transactions:", e);
        if (mounted) setFetchError(String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuOpenId &&
        !(event.target as HTMLElement).closest(
          ".sched-action-menu-container",
        ) &&
        !(event.target as HTMLElement).closest(".sched-action-menu-portal")
      ) {
        setMenuOpenId(null);
        setMenuCoords(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  useEffect(() => {
    function handleScrollOrResize() {
      if (menuOpenId) {
        setMenuOpenId(null);
        setMenuCoords(null);
      }
    }
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [menuOpenId]);

  async function fetchSchedules() {
    try {
      const r = (await rust.get_scheduled_transactions()) as ScheduleRecord[];
      setSchedules(r);
    } catch (e) {
      console.error("Failed to fetch scheduled transactions:", e);
      showToast(t("error.failed_to_load"), { type: "error" });
    }
  }

  function resetForm() {
    setFormState(createDefaultScheduledForm());
    setTickerSuggestions([]);
    setShowTickerSuggestions(false);
    setIsEditing(false);
    setShowForm(false);
  }

  function handleTickerChange(query: string) {
    if (tickerTimeoutRef.current) clearTimeout(tickerTimeoutRef.current);

    if (!query || query.length < 2) {
      setTickerSuggestions([]);
      return;
    }

    tickerTimeoutRef.current = setTimeout(async () => {
      try {
        const suggestions = (await rust.search_ticker({
          query,
        })) as TickerSuggestion[];
        setTickerSuggestions(suggestions);
        setShowTickerSuggestions(true);
      } catch (error) {
        console.error("Error fetching ticker suggestions:", error);
      }
    }, 300);
  }

  function handleEdit(sched: ScheduleRecord) {
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

  async function handleDelete(id: number) {
    if (await confirm(t("scheduled.delete_confirm"), { kind: "warning" })) {
      try {
        await rust.delete_scheduled_transaction({ id });
        setSchedules((cur) => cur.filter((s) => s.id !== id));
        if (formState.id === id) resetForm();
        showToast(t("scheduled.deleted_success"), { type: "success" });
      } catch (e) {
        console.error("Failed to delete scheduled transaction:", e);
        showToast(t("scheduled.error_generic"), { type: "error" });
        fetchSchedules();
      }
    }
  }

  async function handleToggleEnabled(sched: ScheduleRecord) {
    try {
      await rust.update_scheduled_transaction({
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
      showToast(t("scheduled.error_generic"), { type: "error" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formState.accountId) {
      showToast(t("scheduled.validation.account_required"), { type: "error" });
      return;
    }
    if (formState.transactionType === "regular" && !formState.payee.trim()) {
      showToast(t("scheduled.validation.payee_required"), { type: "error" });
      return;
    }
    if (
      formState.transactionType === "investment" &&
      !formState.ticker.trim()
    ) {
      showToast(t("scheduled.validation.ticker_required"), { type: "error" });
      return;
    }
    if (
      formState.recurrenceType === "day_of_week" &&
      formState.daysOfWeek.length === 0
    ) {
      showToast(t("scheduled.validation.days_required"), { type: "error" });
      return;
    }

    try {
      const payload = toScheduledPayload(formState, t);

      if (formState.id) {
        await rust.update_scheduled_transaction({
          args: {
            ...payload,
            id: formState.id,
            enabled: formState.enabled,
          },
        });
        showToast(t("scheduled.updated_success"), { type: "success" });
      } else {
        await rust.create_scheduled_transaction({ args: { ...payload } });
        showToast(t("scheduled.created_success"), { type: "success" });
      }
      resetForm();
      fetchSchedules();
    } catch (e) {
      console.error("Failed to save scheduled transaction:", e);
      showToast(t("scheduled.error_generic"), { type: "error" });
    }
  }

  function toggleDayOfWeek(day: number) {
    setFormState((prev) => {
      const days = prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort((a, b) => a - b);
      return { ...prev, daysOfWeek: days };
    });
  }

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
  }));

  if (loading) {
    return <ListSkeleton title={t("scheduled.title")} />;
  }

  if (fetchError && schedules.length === 0) {
    return (
      <div className="page-container rules-container">
        <div className="hb-header-container mb-large">
          <div>
            <h1 className="hb-header-title">{t("scheduled.title")}</h1>
            <p className="hb-header-subtitle">{t("scheduled.subtitle")}</p>
          </div>
        </div>
        <ErrorState
          title={t("error.failed_to_load")}
          message={fetchError}
          onRetry={() => {
            setFetchError(null);
            setLoading(true);
            fetchSchedules().finally(() => setLoading(false));
          }}
          retryLabel={t("error.retry")}
        />
      </div>
    );
  }

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
              setFormState(createDefaultScheduledForm());
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
        <ScheduledForm
          formRef={formRef}
          isEditing={isEditing}
          formState={formState}
          setFormState={setFormState}
          showTickerSuggestions={showTickerSuggestions}
          setShowTickerSuggestions={setShowTickerSuggestions}
          tickerSuggestions={tickerSuggestions}
          accountOptions={accountOptions}
          dateFormat={dateFormat}
          firstDayOfWeek={firstDayOfWeek}
          handleTickerChange={handleTickerChange}
          handleSubmit={handleSubmit}
          resetForm={resetForm}
          toggleDayOfWeek={toggleDayOfWeek}
        />
      )}

      {/* List */}
      <ScheduledTable
        schedules={schedules}
        accounts={accounts}
        menuOpenId={menuOpenId}
        menuCoords={menuCoords}
        setMenuOpenId={setMenuOpenId}
        setMenuCoords={setMenuCoords}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        handleToggleEnabled={handleToggleEnabled}
      />
    </div>
  );
}
