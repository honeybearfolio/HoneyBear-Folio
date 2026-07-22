import { useState } from "react";
import DatePicker from "react-datepicker";
import type { Day } from "date-fns";
import { rust } from "../../api/tauri-client";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "../../components/ui/Modal";
import { useTranslation } from "react-i18next";
import { useToast } from "../../stores/toast";
import { handleAsyncError } from "../../utils/errors";
import { useParseNumber, getDatePickerFormat } from "../../utils/format";
import { useNumberFormat } from "../../stores/number-format";
import type { LiabilityValuation } from "../../api/types";
import "../../styles/Modal.css";
import "../../styles/datepicker.css";

interface LiabilityValuationModalProps {
  liabilityId: number;
  valuation?: LiabilityValuation | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function LiabilityValuationModal({
  liabilityId,
  valuation = null,
  onClose,
  onSaved,
}: LiabilityValuationModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const parseNumber = useParseNumber();
  const { dateFormat, firstDayOfWeek } = useNumberFormat();
  const isEditing = !!valuation;

  const [date, setDate] = useState(
    valuation?.date || new Date().toISOString().split("T")[0],
  );
  const [valueStr, setValueStr] = useState(
    valuation ? String(valuation.value) : "",
  );

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = parseNumber(valueStr);
    if (Number.isNaN(value)) {
      showToast(t("liabilities.error.invalid_value"), { type: "warning" });
      return;
    }
    if (!date) {
      showToast(t("liabilities.error.empty_date"), { type: "warning" });
      return;
    }

    try {
      if (valuation) {
        await rust.update_liability_valuation({
          id: valuation.id,
          date,
          value,
        });
        showToast(t("liabilities.valuation_updated"), { type: "success" });
      } else {
        await rust.create_liability_valuation({ liabilityId, date, value });
        showToast(t("liabilities.valuation_created"), { type: "success" });
      }
      onSaved();
    } catch (err) {
      handleAsyncError({
        context: "Failed to save liability valuation",
        error: err,
        userMessage: t("error.failed_to_save"),
        toast: (message) => {
          showToast(message, { type: "error" });
        },
      });
    }
  }

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <ModalHeader onClose={onClose}>
          {isEditing
            ? t("liabilities.edit_valuation")
            : t("liabilities.add_valuation")}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("liabilities.field.date")}
              </label>
              <DatePicker
                selected={date ? new Date(date) : null}
                onChange={(d: Date | null) => {
                  setDate(d ? d.toISOString().split("T")[0] : "");
                }}
                dateFormat={getDatePickerFormat(dateFormat)}
                calendarStartDay={firstDayOfWeek as Day}
                shouldCloseOnSelect={false}
                required
                portalId="datepicker-portal"
                className="form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("liabilities.field.value")}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={valueStr}
                onChange={(e) => {
                  setValueStr(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="0.00"
                autoFocus
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
            {isEditing ? t("liabilities.save") : t("liabilities.add_valuation")}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
