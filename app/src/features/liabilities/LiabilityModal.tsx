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
import { LIABILITY_CATEGORIES } from "../../utils/liabilities-io";
import type { LiabilityWithLatestValue } from "../../api/types";
import "../../styles/Modal.css";

interface LiabilityModalProps {
  liability?: LiabilityWithLatestValue | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function LiabilityModal({
  liability = null,
  onClose,
  onSaved,
}: LiabilityModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = !!liability;

  const [name, setName] = useState(liability?.name || "");
  const [category, setCategory] = useState(liability?.category || "other");
  const [currency, setCurrency] = useState(liability?.currency || "");
  const [notes, setNotes] = useState(liability?.notes || "");

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      showToast(t("liabilities.error.empty_name"), { type: "warning" });
      return;
    }

    try {
      if (liability) {
        await rust.update_liability({
          id: liability.id,
          name: nameTrimmed,
          category,
          ...(currency ? { currency } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        showToast(t("liabilities.updated"), { type: "success" });
      } else {
        await rust.create_liability({
          name: nameTrimmed,
          category,
          ...(currency ? { currency } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        showToast(t("liabilities.created"), { type: "success" });
      }
      onSaved();
    } catch (err) {
      handleAsyncError({
        context: "Failed to save liability",
        error: err,
        userMessage: t("error.failed_to_save"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  const categoryOptions = LIABILITY_CATEGORIES.map((c) => ({
    value: c,
    label: t(`liabilities.category.${c}`),
  }));

  const currencyOptions = CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.code} (${c.symbol}) – ${c.name}`,
  }));

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <ModalHeader onClose={onClose}>
          {isEditing
            ? t("liabilities.edit_liability")
            : t("liabilities.add_liability")}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("liabilities.field.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder={t("liabilities.placeholder.name")}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("liabilities.field.category")}
              </label>
              <CustomSelect
                options={categoryOptions}
                value={category}
                onChange={(v) => {
                  setCategory(String(v));
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("liabilities.field.currency")}
              </label>
              <CustomSelect
                options={[
                  { value: "", label: t("liabilities.default_currency") },
                  ...currencyOptions,
                ]}
                value={currency}
                onChange={(v) => {
                  setCurrency(String(v));
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("liabilities.field.notes")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                }}
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                placeholder={t("liabilities.placeholder.notes")}
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
            {t("liabilities.cancel")}
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors cursor-pointer"
          >
            {isEditing ? t("liabilities.save") : t("liabilities.add_liability")}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
