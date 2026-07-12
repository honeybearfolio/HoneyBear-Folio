import { useState, useEffect, useRef, useCallback } from "react";
import { rust } from "../../api/tauri-client";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import { Plus } from "lucide-react";
import { useConfirm } from "../../stores/confirm";
import { useToast } from "../../stores/toast";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "../../stores/number-format";
import { useTickerSearch } from "../../hooks/useTickerSearch";
import "../../styles/Dashboard.css";
import { ListSkeleton, ErrorState } from "../../components/ui/Skeleton";
import { createDefaultScheduledForm } from "../../constants/app";
import { toScheduledPayload } from "./scheduled-helpers";
import type { ScheduleRecord, AccountRecord } from "./scheduled-types";
import ScheduledForm from "./ScheduledForm";
import ScheduledTable from "./ScheduledTable";
import { handleAsyncError } from "../../utils/errors";

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
  const {
    suggestions: tickerSuggestions,
    showSuggestions: showTickerSuggestions,
    setShowSuggestions: setShowTickerSuggestions,
    searchTicker,
    clearSuggestions: clearTickerSuggestions,
  } = useTickerSearch();
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(
    null,
  );

  const confirm = useConfirm();
  const { showToast } = useToast();
  const { dateFormat, firstDayOfWeek } = useNumberFormat();
  const formRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(
    async (mode: "page" | "refresh" = "refresh") => {
      try {
        if (mode === "page") {
          const [scheds, accs] = await Promise.all([
            rust.get_scheduled_transactions(),
            rust.get_accounts(),
          ]);
          setSchedules(scheds);
          setAccounts(accs);
        } else {
          const scheds = await rust.get_scheduled_transactions();
          setSchedules(scheds);
        }
        setFetchError(null);
      } catch (e: unknown) {
        if (mode === "page") {
          handleAsyncError({
            context: "Failed to fetch scheduled transactions",
            error: e,
            setError: setFetchError,
            detailFallback: t("error.failed_to_load"),
          });
        } else {
          handleAsyncError({
            context: "Failed to fetch scheduled transactions",
            error: e,
            userMessage: t("error.failed_to_load"),
            toast: (message) => {
              showToast(message, { type: "error" });
            },
          });
        }
      }
    },
    [showToast, t],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadData("page");
      setLoading(false);
    })();
  }, [loadData]);

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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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

  function resetForm() {
    setFormState(createDefaultScheduledForm());
    clearTickerSuggestions();
    setIsEditing(false);
    setShowForm(false);
  }

  function handleTickerChange(query: string) {
    searchTicker(query);
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
      } catch (e: unknown) {
        handleAsyncError({
          context: "Failed to delete scheduled transaction",
          error: e,
          userMessage: t("scheduled.error_generic"),
          toast: (message) => {
            showToast(message, { type: "error" });
          },
        });
        void loadData();
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
      void loadData();
    } catch (e: unknown) {
      handleAsyncError({
        context: "Failed to toggle scheduled transaction",
        error: e,
        userMessage: t("scheduled.error_generic"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
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
      void loadData();
    } catch (e: unknown) {
      handleAsyncError({
        context: "Failed to save scheduled transaction",
        error: e,
        userMessage: t("scheduled.error_generic"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
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
            void loadData("page").finally(() => {
              setLoading(false);
            });
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
          handleSubmit={(e) => {
            void handleSubmit(e);
          }}
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
