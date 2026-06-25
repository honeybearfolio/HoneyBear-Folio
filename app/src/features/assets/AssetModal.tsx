import { useState } from "react";
import { rust } from "../../api/tauri-client";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "../../components/ui/Modal";
import { useTranslation } from "react-i18next";
import { CURRENCIES } from "../../utils/currencies";
import CustomSelect from "../../components/ui/CustomSelect";
import { useToast } from "../../stores/toast";
import { handleAsyncError } from "../../utils/errors";
import type { AssetWithLatestValue } from "../../api/types";
import "../../styles/Modal.css";

const ASSET_CATEGORIES = [
  "real_estate",
  "vehicle",
  "jewelry",
  "art",
  "collectible",
  "other",
] as const;

interface AssetModalProps {
  asset?: AssetWithLatestValue | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AssetModal({
  asset = null,
  onClose,
  onSaved,
}: AssetModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = !!asset;

  const [name, setName] = useState(asset?.name || "");
  const [category, setCategory] = useState(asset?.category || "other");
  const [currency, setCurrency] = useState(asset?.currency || "");
  const [notes, setNotes] = useState(asset?.notes || "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      showToast(t("assets.error.empty_name"), { type: "warning" });
      return;
    }

    try {
      if (isEditing && asset) {
        await rust.update_asset({
          id: asset.id,
          name: nameTrimmed,
          category,
          currency: currency || undefined,
          notes: notes.trim() || undefined,
        });
        showToast(t("assets.updated"), { type: "success" });
      } else {
        await rust.create_asset({
          name: nameTrimmed,
          category,
          currency: currency || undefined,
          notes: notes.trim() || undefined,
        });
        showToast(t("assets.created"), { type: "success" });
      }
      onSaved();
    } catch (err) {
      handleAsyncError({
        context: "Failed to save asset",
        error: err,
        userMessage: t("error.failed_to_save"),
        toast: (message) => showToast(message, { type: "error" }),
      });
    }
  }

  const categoryOptions = ASSET_CATEGORIES.map((c) => ({
    value: c,
    label: t(`assets.category.${c}`),
  }));

  const currencyOptions = CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.code} (${c.symbol}) – ${c.name}`,
  }));

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <ModalHeader onClose={onClose}>
          {isEditing ? t("assets.edit_asset") : t("assets.add_asset")}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("assets.field.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder={t("assets.placeholder.name")}
                autoFocus
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("assets.field.category")}
              </label>
              <CustomSelect
                options={categoryOptions}
                value={category}
                onChange={(v) => setCategory(String(v))}
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("assets.field.currency")}
              </label>
              <CustomSelect
                options={[
                  { value: "", label: t("assets.default_currency") },
                  ...currencyOptions,
                ]}
                value={currency}
                onChange={(v) => setCurrency(String(v))}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("assets.field.notes")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                placeholder={t("assets.placeholder.notes")}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {t("assets.cancel")}
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors cursor-pointer"
          >
            {isEditing ? t("assets.save") : t("assets.add_asset")}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
