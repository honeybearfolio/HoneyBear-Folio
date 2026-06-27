import type { RefObject } from "react";
import { Download, FileSpreadsheet, FileJson } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FileDropZoneProps {
  file: File | null;
  isDragging: boolean;
  dropZoneRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function FileDropZone({
  file,
  isDragging,
  dropZoneRef,
  fileInputRef,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileChange,
}: FileDropZoneProps) {
  const { t } = useTranslation();

  return (
    <div
      ref={dropZoneRef}
      onClick={() => fileInputRef.current?.click()}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all group ${
        isDragging
          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
          : "border-slate-300 dark:border-slate-700 hover:border-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
      }`}
    >
      {isDragging ? (
        <>
          <Download className="w-12 h-12 text-brand-500 mb-4 animate-pulse" />
          <p className="text-brand-600 dark:text-brand-400 font-medium">
            {t("import.drop_file_here") || "Drop file here"}
          </p>
        </>
      ) : (
        <>
          {file?.name?.endsWith(".json") ? (
            <FileJson className="w-12 h-12 text-slate-400 dark:text-slate-600 group-hover:text-brand-500 mb-4 transition-colors" />
          ) : (
            <FileSpreadsheet className="w-12 h-12 text-slate-400 dark:text-slate-600 group-hover:text-brand-500 mb-4 transition-colors" />
          )}
          <p className="text-slate-600 dark:text-slate-300 font-medium">
            {t("import.drag_or_click") || t("import.click_to_Download")}
          </p>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">
            {t("import.supports")}
          </p>
        </>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.xlsx,.xls,.json"
        className="hidden"
      />
    </div>
  );
}
