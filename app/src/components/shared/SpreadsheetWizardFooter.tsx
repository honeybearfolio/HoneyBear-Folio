import { ModalFooter } from "../ui/Modal";

interface SpreadsheetWizardFooterProps {
  step: number;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onPrimary: () => void;
  importing: boolean;
  canGoNext: boolean;
  canStartPrimary: boolean;
  cancelLabel: string;
  nextLabel: string;
  backLabel: string;
  primaryLabel: string;
  importingLabel: string;
}

export default function SpreadsheetWizardFooter({
  step,
  onClose,
  onBack,
  onNext,
  onPrimary,
  importing,
  canGoNext,
  canStartPrimary,
  cancelLabel,
  nextLabel,
  backLabel,
  primaryLabel,
  importingLabel,
}: SpreadsheetWizardFooterProps) {
  return (
    <div className="px-6 pb-6 pt-0">
      <ModalFooter className="mt-0 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onClose}
          className="btn-secondary"
          disabled={importing}
        >
          {cancelLabel}
        </button>

        {step === 0 ? (
          <button
            onClick={onNext}
            disabled={!canGoNext}
            className="btn-primary"
          >
            <span className="text-white">{nextLabel}</span>
          </button>
        ) : (
          <>
            <button
              onClick={onBack}
              disabled={importing}
              className="btn-secondary"
            >
              {backLabel}
            </button>

            <button
              onClick={onPrimary}
              disabled={!canStartPrimary}
              className="btn-primary"
            >
              <span className="text-white">
                {importing ? importingLabel : primaryLabel}
              </span>
            </button>
          </>
        )}
      </ModalFooter>
    </div>
  );
}
