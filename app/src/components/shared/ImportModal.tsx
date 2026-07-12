import { useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import "../../styles/Modal.css";
import "../../styles/Settings.css";
import { Modal, ModalHeader, ModalBody } from "../ui/Modal";
import type { ImportModalProps } from "./import-types";
import FileDropZone from "./FileDropZone";
import ColumnMappingStep from "./ColumnMappingStep";
import ImportFileReviewStep from "./ImportFileReviewStep";
import SpreadsheetWizardFooter from "./SpreadsheetWizardFooter";
import { useColumnMapping } from "../../hooks/useColumnMapping";
import { useSpreadsheetImport } from "../../hooks/useSpreadsheetImport";
import { useImportRunner } from "../../hooks/useImportRunner";

export default function ImportModal({
  onClose,
  onImportComplete,
}: ImportModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const { mapping, setMapping, applyAutoMap, resetMapping } =
    useColumnMapping();
  const {
    file,
    setFile,
    columns,
    previewRows,
    parseError,
    isDragging,
    fileInputRef,
    dropZoneRef,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    clearFile,
  } = useSpreadsheetImport(applyAutoMap);
  const { importing, progress, importErrors, showImportSummary, runImport } =
    useImportRunner({ onImportComplete, onClose });

  const canStartImport = Boolean(
    file && (mapping.account || file.name.endsWith(".json")) && !importing,
  );

  const handleClearFile = () => {
    clearFile();
    resetMapping();
    setStep(0);
    setFile(null);
  };

  const handleSetFile: React.Dispatch<React.SetStateAction<File | null>> = (
    value,
  ) => {
    if (value === null) {
      handleClearFile();
    }
  };

  if (typeof document === "undefined") return null;

  return (
    <Modal
      onClose={onClose}
      size="4xl"
      className="!p-0 flex flex-col overflow-hidden max-h-[90vh]"
    >
      <div className="p-6 pb-0">
        <ModalHeader
          onClose={onClose}
          title={t("import.title")}
          icon={Download}
        />
      </div>

      <ModalBody className="overflow-y-auto flex-1 px-6">
        {!file ? (
          <FileDropZone
            file={file}
            isDragging={isDragging}
            dropZoneRef={dropZoneRef}
            fileInputRef={fileInputRef}
            handleDragEnter={handleDragEnter}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handleFileChange={handleFileChange}
          />
        ) : step === 1 ? (
          <ColumnMappingStep
            file={file}
            columns={columns}
            mapping={mapping}
            setMapping={setMapping}
            setFile={handleSetFile}
            previewRows={previewRows}
            parseError={parseError}
            importing={importing}
            progress={progress}
            showImportSummary={showImportSummary}
            importErrors={importErrors}
          />
        ) : (
          <ImportFileReviewStep
            fileName={file.name}
            onChangeFile={handleClearFile}
          />
        )}
      </ModalBody>

      <SpreadsheetWizardFooter
        step={step}
        onClose={onClose}
        onBack={() => {
          setStep(0);
        }}
        onNext={() => {
          setStep(1);
        }}
        onPrimary={() => {
          if (file) void runImport(file, mapping);
        }}
        importing={importing}
        canGoNext={Boolean(file)}
        canStartPrimary={canStartImport}
        cancelLabel={t("account.cancel")}
        nextLabel={t("import.next") || "Next"}
        backLabel={t("import.back") || "Back"}
        primaryLabel={t("import.start_import")}
        importingLabel={t("import.importing")}
      />
    </Modal>
  );
}
