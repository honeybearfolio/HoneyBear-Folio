import { useState, useRef, useEffect } from "react";
import "../../styles/Modal.css";
import { useTranslation } from "react-i18next";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";

interface CustomRateDialogProps {
  isOpen: boolean;
  currency?: string;
  onConfirm: (rate: number) => void;
  onCancel: () => void;
}

export default function CustomRateDialog({
  isOpen,
  currency,
  onConfirm,
  onCancel,
}: CustomRateDialogProps) {
  const { t } = useTranslation();
  const [rate, setRate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => {
        setRate("");
        inputRef.current?.focus();
      }, 100);
      return () => {
        clearTimeout(id);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = parseFloat(rate);
    if (isNaN(val) || val <= 0) return;
    onConfirm(val);
  };

  return (
    <Modal onClose={onCancel} size="sm">
      <ModalHeader title={t("custom_rate.title")} onClose={onCancel} />
      <ModalBody>
        <p className="mb-4 text-slate-600 dark:text-slate-300">
          {t("custom_rate.message", { currency })}
        </p>
        <form
          id="custom-rate-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <input
            ref={inputRef}
            type="number"
            step="any"
            className="form-input"
            placeholder="0.0"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
            }}
            required
            autoFocus
          />
        </form>
      </ModalBody>
      <ModalFooter className="mt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t("account.cancel")}
        </button>
        <button type="submit" form="custom-rate-form" className="btn-primary">
          {t("confirm.save")}
        </button>
      </ModalFooter>
    </Modal>
  );
}
