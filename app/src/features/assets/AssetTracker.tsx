import { useState, useEffect, useCallback } from "react";
import { rust } from "../../api/tauri-client";
import type { AssetWithLatestValue, AssetValuation } from "../../api/types";
import { Plus, Trash2, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { useConfirm } from "../../stores/confirm";
import { useToast } from "../../stores/toast";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "../../stores/number-format";
import { useFormatNumber } from "../../utils/format";
import { ListSkeleton, ErrorState } from "../../components/ui/Skeleton";
import { handleAsyncError } from "../../utils/errors";
import AssetModal from "./AssetModal";
import ValuationModal from "./ValuationModal";
import "../../styles/Dashboard.css";

const CATEGORY_ICONS: Record<string, string> = {
  real_estate: "🏠",
  vehicle: "🚗",
  jewelry: "💎",
  art: "🎨",
  collectible: "🏺",
  other: "📦",
};

interface AssetTrackerProps {
  onUpdate?: () => void;
}

export default function AssetTracker({ onUpdate }: AssetTrackerProps = {}) {
  const { t } = useTranslation();
  const { currency: appCurrency } = useNumberFormat();
  const formatNumber = useFormatNumber();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [assets, setAssets] = useState<AssetWithLatestValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetWithLatestValue | null>(
    null,
  );
  const [expandedAssetIds, setExpandedAssetIds] = useState<Set<number>>(
    new Set(),
  );
  const [valuationsMap, setValuationsMap] = useState<
    Record<number, AssetValuation[]>
  >({});
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [editingValuation, setEditingValuation] =
    useState<AssetValuation | null>(null);
  const [valuationAssetId, setValuationAssetId] = useState<number | null>(null);

  const fetchValuations = useCallback(async (assetId: number) => {
    try {
      const data = await rust.get_valuations({ assetId });
      setValuationsMap((prev) => ({ ...prev, [assetId]: data }));
    } catch (e) {
      console.error("Failed to fetch valuations:", e);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const data = await rust.get_assets({
        targetCurrency: appCurrency || "USD",
      });
      setAssets(data);
      setFetchError(null);
      // Auto-expand all assets and fetch their valuations
      setExpandedAssetIds(new Set(data.map((a) => a.id)));
      await Promise.all(data.map((a) => fetchValuations(a.id)));
    } catch (e) {
      console.error("Failed to fetch assets:", e);
      setFetchError(String(e));
    }
  }, [appCurrency, fetchValuations]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await rust.get_assets({
          targetCurrency: appCurrency || "USD",
        });
        setAssets(data);
        setFetchError(null);
        setExpandedAssetIds(new Set(data.map((a) => a.id)));
        await Promise.all(
          data.map(async (a) => {
            const vals = await rust.get_valuations({ assetId: a.id });
            setValuationsMap((prev) => ({ ...prev, [a.id]: vals }));
          }),
        );
      } catch (e) {
        setFetchError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [appCurrency]);

  const handleExpand = useCallback(
    (assetId: number) => {
      setExpandedAssetIds((prev) => {
        const next = new Set(prev);
        if (next.has(assetId)) {
          next.delete(assetId);
        } else {
          next.add(assetId);
          void fetchValuations(assetId);
        }
        return next;
      });
    },
    [fetchValuations],
  );

  const handleDeleteAsset = useCallback(
    async (asset: AssetWithLatestValue) => {
      const confirmed = await confirm(
        t("assets.confirm_delete", { name: asset.name }),
        { kind: "warning", okLabel: t("confirm.delete") },
      );
      if (!confirmed) return;
      try {
        await rust.delete_asset({ id: asset.id });
        showToast(t("assets.deleted"), { type: "success" });
        setExpandedAssetIds((prev) => {
          const next = new Set(prev);
          next.delete(asset.id);
          return next;
        });
        await fetchAssets();
        onUpdate?.();
      } catch (e) {
        handleAsyncError({
          context: "Failed to delete asset",
          error: e,
          userMessage: t("error.failed_to_delete"),
          toast: (message) => {
            showToast(message, { type: "error" });
          },
        });
      }
    },
    [confirm, t, showToast, fetchAssets, onUpdate],
  );

  const handleDeleteValuation = useCallback(
    async (valuation: AssetValuation) => {
      const confirmed = await confirm(t("assets.confirm_delete_valuation"), {
        kind: "warning",
        okLabel: t("confirm.delete"),
      });
      if (!confirmed) return;
      try {
        await rust.delete_valuation({ id: valuation.id });
        showToast(t("assets.valuation_deleted"), { type: "success" });
        await fetchValuations(valuation.asset_id);
        await fetchAssets();
        onUpdate?.();
      } catch (e) {
        handleAsyncError({
          context: "Failed to delete valuation",
          error: e,
          userMessage: t("error.failed_to_delete"),
          toast: (message) => {
            showToast(message, { type: "error" });
          },
        });
      }
    },
    [confirm, t, showToast, fetchValuations, fetchAssets, onUpdate],
  );

  const handleAssetSaved = useCallback(async () => {
    setShowAssetModal(false);
    setEditingAsset(null);
    await fetchAssets();
    onUpdate?.();
  }, [fetchAssets, onUpdate]);

  const handleValuationSaved = useCallback(async () => {
    setShowValuationModal(false);
    setEditingValuation(null);
    if (valuationAssetId != null) {
      await fetchValuations(valuationAssetId);
    }
    await fetchAssets();
    onUpdate?.();
  }, [fetchAssets, fetchValuations, onUpdate, valuationAssetId]);

  const totalValue = assets.reduce(
    (sum, a) =>
      sum +
      (a.latest_value !== undefined ? a.latest_value : 0) * a.exchange_rate,
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
          void fetchAssets().finally(() => {
            setLoading(false);
          });
        }}
      />
    );

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {t("assets.title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("assets.total_value")}:{" "}
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              {formatNumber(totalValue, {
                style: "currency",
                currency: appCurrency,
              })}
            </span>
          </p>
        </div>
        <button
          onClick={() => {
            setEditingAsset(null);
            setShowAssetModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm transition-colors font-medium text-sm cursor-pointer"
        >
          <Plus size={16} />
          {t("assets.add_asset")}
        </button>
      </div>

      {/* Asset List */}
      {assets.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-lg">{t("assets.empty")}</p>
          <p className="text-sm mt-1">{t("assets.empty_hint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
            >
              {/* Asset row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <span
                  className="text-2xl"
                  role="img"
                  aria-label={asset.category}
                >
                  {CATEGORY_ICONS[asset.category] || CATEGORY_ICONS.other}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {asset.name}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t(`assets.category.${asset.category}`)}
                    {asset.currency && ` · ${asset.currency}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {asset.latest_value !== undefined
                      ? formatNumber(asset.latest_value * asset.exchange_rate, {
                          style: "currency",
                          currency: appCurrency,
                        })
                      : "—"}
                  </p>
                  {asset.latest_date && (
                    <p className="text-xs text-slate-400">
                      {asset.latest_date}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingAsset(asset);
                      setShowAssetModal(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-brand-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={t("assets.edit")}
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => {
                      void handleDeleteAsset(asset);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={t("assets.delete")}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => {
                      handleExpand(asset.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={t("assets.show_valuations")}
                  >
                    {expandedAssetIds.has(asset.id) ? (
                      <ChevronUp size={15} />
                    ) : (
                      <ChevronDown size={15} />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded valuations */}
              {expandedAssetIds.has(asset.id) && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {t("assets.valuations")}
                    </h4>
                    <button
                      onClick={() => {
                        setValuationAssetId(asset.id);
                        setEditingValuation(null);
                        setShowValuationModal(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-md transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      {t("assets.add_valuation")}
                    </button>
                  </div>
                  {(valuationsMap[asset.id] ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">
                      {t("assets.no_valuations")}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(valuationsMap[asset.id] ?? []).map((v) => (
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
                              currency: asset.currency || appCurrency,
                            })}
                          </span>
                          <button
                            onClick={() => {
                              setValuationAssetId(asset.id);
                              setEditingValuation(v);
                              setShowValuationModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded cursor-pointer"
                            title={t("assets.edit")}
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => {
                              void handleDeleteValuation(v);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title={t("assets.delete")}
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

      {/* Modals */}
      {showAssetModal && (
        <AssetModal
          asset={editingAsset}
          onClose={() => {
            setShowAssetModal(false);
            setEditingAsset(null);
          }}
          onSaved={() => {
            void handleAssetSaved();
          }}
        />
      )}

      {showValuationModal && valuationAssetId != null && (
        <ValuationModal
          assetId={valuationAssetId}
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
