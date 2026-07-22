import { useState, useEffect, useCallback } from "react";
import { rust } from "../../api/tauri-client";
import type {
  LiabilityWithLatestValue,
  LiabilityValuation,
} from "../../api/types";
import { Plus, Trash2, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { useConfirm } from "../../stores/confirm";
import { useToast } from "../../stores/toast";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "../../stores/number-format";
import { useFormatNumber } from "../../utils/format";
import { ListSkeleton, ErrorState } from "../../components/ui/Skeleton";
import { handleAsyncError, logError } from "../../utils/errors";
import LiabilityModal from "./LiabilityModal";
import LiabilityValuationModal from "./LiabilityValuationModal";
import "../../styles/Dashboard.css";

const CATEGORY_ICONS: Record<string, string> = {
  mortgage: "🏦",
  auto_loan: "🚗",
  credit_card: "💳",
  student_loan: "🎓",
  personal_loan: "💰",
  other: "📋",
};

interface LiabilityTrackerProps {
  onUpdate?: () => void;
}

export default function LiabilityTracker({
  onUpdate,
}: LiabilityTrackerProps = {}) {
  const { t } = useTranslation();
  const { currency: appCurrency } = useNumberFormat();
  const formatNumber = useFormatNumber();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [liabilities, setLiabilities] = useState<LiabilityWithLatestValue[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [editingLiability, setEditingLiability] =
    useState<LiabilityWithLatestValue | null>(null);
  const [expandedLiabilityIds, setExpandedLiabilityIds] = useState<Set<number>>(
    new Set(),
  );
  const [valuationsMap, setValuationsMap] = useState<
    Record<number, LiabilityValuation[]>
  >({});
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [editingValuation, setEditingValuation] =
    useState<LiabilityValuation | null>(null);
  const [valuationLiabilityId, setValuationLiabilityId] = useState<
    number | null
  >(null);

  const fetchValuations = useCallback(async (liabilityId: number) => {
    try {
      const data = await rust.get_liability_valuations({ liabilityId });
      setValuationsMap((prev) => ({ ...prev, [liabilityId]: data }));
    } catch (e) {
      logError("Failed to fetch liability valuations", e);
    }
  }, []);

  const fetchLiabilities = useCallback(
    async (mode: "page" | "refresh" = "refresh") => {
      try {
        const data = await rust.get_liabilities({
          targetCurrency: appCurrency || "USD",
        });
        setLiabilities(data);
        setFetchError(null);
        setExpandedLiabilityIds(new Set(data.map((l) => l.id)));
        await Promise.all(data.map((l) => fetchValuations(l.id)));
      } catch (e) {
        if (mode === "page") {
          handleAsyncError({
            context: "Failed to fetch liabilities",
            error: e,
            setError: setFetchError,
            detailFallback: t("error.failed_to_load"),
          });
        } else {
          handleAsyncError({
            context: "Failed to fetch liabilities",
            error: e,
            userMessage: t("error.failed_to_load"),
            toast: (message) => {
              showToast(message, { type: "error" });
            },
          });
        }
      }
    },
    [appCurrency, fetchValuations, showToast, t],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await fetchLiabilities("page");
      setLoading(false);
    })();
  }, [fetchLiabilities]);

  const handleExpand = useCallback(
    (liabilityId: number) => {
      setExpandedLiabilityIds((prev) => {
        const next = new Set(prev);
        if (next.has(liabilityId)) {
          next.delete(liabilityId);
        } else {
          next.add(liabilityId);
          void fetchValuations(liabilityId);
        }
        return next;
      });
    },
    [fetchValuations],
  );

  const handleDeleteLiability = useCallback(
    async (liability: LiabilityWithLatestValue) => {
      const confirmed = await confirm(
        t("liabilities.confirm_delete", { name: liability.name }),
        { kind: "warning", okLabel: t("confirm.delete") },
      );
      if (!confirmed) return;
      try {
        await rust.delete_liability({ id: liability.id });
        showToast(t("liabilities.deleted"), { type: "success" });
        setExpandedLiabilityIds((prev) => {
          const next = new Set(prev);
          next.delete(liability.id);
          return next;
        });
        await fetchLiabilities();
        onUpdate?.();
      } catch (e) {
        handleAsyncError({
          context: "Failed to delete liability",
          error: e,
          userMessage: t("error.failed_to_delete"),
          toast: (message) => {
            showToast(message, { type: "error" });
          },
        });
      }
    },
    [confirm, t, showToast, fetchLiabilities, onUpdate],
  );

  const handleDeleteValuation = useCallback(
    async (valuation: LiabilityValuation) => {
      const confirmed = await confirm(
        t("liabilities.confirm_delete_valuation"),
        {
          kind: "warning",
          okLabel: t("confirm.delete"),
        },
      );
      if (!confirmed) return;
      try {
        await rust.delete_liability_valuation({ id: valuation.id });
        showToast(t("liabilities.valuation_deleted"), { type: "success" });
        await fetchValuations(valuation.liability_id);
        await fetchLiabilities();
        onUpdate?.();
      } catch (e) {
        handleAsyncError({
          context: "Failed to delete liability valuation",
          error: e,
          userMessage: t("error.failed_to_delete"),
          toast: (message) => {
            showToast(message, { type: "error" });
          },
        });
      }
    },
    [confirm, t, showToast, fetchValuations, fetchLiabilities, onUpdate],
  );

  const handleLiabilitySaved = useCallback(async () => {
    setShowLiabilityModal(false);
    setEditingLiability(null);
    await fetchLiabilities();
    onUpdate?.();
  }, [fetchLiabilities, onUpdate]);

  const handleValuationSaved = useCallback(async () => {
    setShowValuationModal(false);
    setEditingValuation(null);
    if (valuationLiabilityId != null) {
      await fetchValuations(valuationLiabilityId);
    }
    await fetchLiabilities();
    onUpdate?.();
  }, [fetchLiabilities, fetchValuations, onUpdate, valuationLiabilityId]);

  const totalValue = liabilities.reduce(
    (sum, l) =>
      sum +
      (l.latest_value !== undefined ? l.latest_value : 0) * l.exchange_rate,
    0,
  );

  if (loading) return <ListSkeleton />;
  if (fetchError)
    return (
      <ErrorState
        title={t("error.operation_failed")}
        message={fetchError}
        onRetry={() => {
          setFetchError(null);
          setLoading(true);
          void fetchLiabilities("page").finally(() => {
            setLoading(false);
          });
        }}
      />
    );

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {t("liabilities.title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("liabilities.total_value")}:{" "}
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {formatNumber(totalValue, {
                style: "currency",
                currency: appCurrency,
              })}
            </span>
          </p>
        </div>
        <button
          onClick={() => {
            setEditingLiability(null);
            setShowLiabilityModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm transition-colors font-medium text-sm cursor-pointer"
        >
          <Plus size={16} />
          {t("liabilities.add_liability")}
        </button>
      </div>

      {liabilities.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-lg">{t("liabilities.empty")}</p>
          <p className="text-sm mt-1">{t("liabilities.empty_hint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {liabilities.map((liability) => (
            <div
              key={liability.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <span
                  className="text-2xl"
                  role="img"
                  aria-label={liability.category}
                >
                  {CATEGORY_ICONS[liability.category] || CATEGORY_ICONS.other}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {liability.name}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t(`liabilities.category.${liability.category}`)}
                    {liability.currency && ` · ${liability.currency}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {liability.latest_value !== undefined
                      ? formatNumber(
                          liability.latest_value * liability.exchange_rate,
                          {
                            style: "currency",
                            currency: appCurrency,
                          },
                        )
                      : "—"}
                  </p>
                  {liability.latest_date && (
                    <p className="text-xs text-slate-400">
                      {liability.latest_date}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingLiability(liability);
                      setShowLiabilityModal(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-brand-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={t("liabilities.edit")}
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => {
                      void handleDeleteLiability(liability);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={t("liabilities.delete")}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => {
                      handleExpand(liability.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={t("liabilities.show_valuations")}
                  >
                    {expandedLiabilityIds.has(liability.id) ? (
                      <ChevronUp size={15} />
                    ) : (
                      <ChevronDown size={15} />
                    )}
                  </button>
                </div>
              </div>

              {expandedLiabilityIds.has(liability.id) && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {t("liabilities.valuations")}
                    </h4>
                    <button
                      onClick={() => {
                        setValuationLiabilityId(liability.id);
                        setEditingValuation(null);
                        setShowValuationModal(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-md transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      {t("liabilities.add_valuation")}
                    </button>
                  </div>
                  {(valuationsMap[liability.id] ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">
                      {t("liabilities.no_valuations")}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(valuationsMap[liability.id] ?? []).map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50"
                        >
                          <span className="text-slate-500 dark:text-slate-400 w-28 shrink-0">
                            {v.date}
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-200 flex-1">
                            {formatNumber(v.value, {
                              style: "currency",
                              currency: liability.currency || appCurrency,
                            })}
                          </span>
                          <button
                            onClick={() => {
                              setValuationLiabilityId(liability.id);
                              setEditingValuation(v);
                              setShowValuationModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded cursor-pointer"
                            title={t("liabilities.edit")}
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => {
                              void handleDeleteValuation(v);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title={t("liabilities.delete")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showLiabilityModal && (
        <LiabilityModal
          liability={editingLiability}
          onClose={() => {
            setShowLiabilityModal(false);
            setEditingLiability(null);
          }}
          onSaved={() => {
            void handleLiabilitySaved();
          }}
        />
      )}

      {showValuationModal && valuationLiabilityId != null && (
        <LiabilityValuationModal
          liabilityId={valuationLiabilityId}
          valuation={editingValuation}
          onClose={() => {
            setShowValuationModal(false);
            setEditingValuation(null);
          }}
          onSaved={() => {
            void handleValuationSaved();
          }}
        />
      )}
    </div>
  );
}
