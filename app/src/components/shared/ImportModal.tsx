import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import "../../styles/Modal.css";
import "../../styles/Settings.css";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import type { ImportModalProps } from "./import-types";
import FileDropZone from "./FileDropZone";
import ColumnMappingStep from "./ColumnMappingStep";
import { useColumnMapping } from "../../hooks/useColumnMapping";
import { useImportParser } from "../../hooks/useImportParser";
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
  } = useImportParser(applyAutoMap);
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
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-green-500" />
                <span className="text-slate-900 dark:text-white font-medium">
                  {file.name}
                </span>
              </div>
              <button
                onClick={handleClearFile}
                className="text-slate-500 dark:text-slate-400 hover:text-red-400 text-sm"
              >
                {t("import.change_file")}
              </button>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
              {t("import.file_loaded_review") ||
                "File loaded — click Next to review mappings and preview"}
            </div>
          </div>
        )}
      </ModalBody>

      <div className="px-6 pb-6 pt-0">
        <ModalFooter className="mt-0 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={importing}
          >
            {t("account.cancel")}
          </button>

          {step === 0 ? (
            <button
              onClick={() => {
                setStep(1);
              }}
              disabled={!file}
              className="btn-primary"
            >
              <span className="text-white">{t("import.next") || "Next"}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep(0);
                }}
                disabled={importing}
                className="btn-secondary"
              >
                {t("import.back") || "Back"}
              </button>

              <button
                onClick={() => {
                  if (file) void runImport(file, mapping);
                }}
                disabled={!canStartImport}
                className="btn-primary"
              >
                <span className="text-white">
                  {importing ? t("import.importing") : t("import.start_import")}
                </span>
              </button>
            </>
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
}
