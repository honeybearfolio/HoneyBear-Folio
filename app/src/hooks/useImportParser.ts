import { useState, useRef, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { getMimeType } from "../components/shared/import-types";
import { parseFilePreview } from "../utils/import-parser";
import { handleAsyncError } from "../utils/errors";

const VALID_EXTENSIONS = [".csv", ".xlsx", ".xls", ".json"];

function hasValidExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return VALID_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function useImportParser(onColumnsParsed: (cols: string[]) => void) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const parseFile = useCallback(
    async (selectedFile: File) => {
      setParseError(null);
      setPreviewRows([]);

      try {
        const result = await parseFilePreview(selectedFile, {
          unsupportedJsonStructure: t(
            "import.error.unsupported_json_structure",
          ),
          failedParseJson: (error) =>
            t("import.error.failed_parse_json", { error }),
          failedParseExcel: (error) =>
            t("import.error.failed_parse_excel", { error }),
        });

        setColumns(result.columns);
        setPreviewRows(result.previewRows);
        setParseError(result.parseError);
        onColumnsParsed(result.columns);
      } catch (err: unknown) {
        handleAsyncError({
          context: "Failed to parse import file",
          error: err,
          setError: setParseError,
          detailFallback: t("import.failed"),
        });
        setColumns([]);
        setPreviewRows([]);
        onColumnsParsed([]);
      }
    },
    [onColumnsParsed, t],
  );

  const handleFileFromPath = useCallback(
    async (filePath: string) => {
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const contents = await readFile(filePath);
        const fileName = filePath.split(/[\\/]/).pop() ?? "file";
        const blob = new Blob([contents]);
        const fileObj = new File([blob], fileName, {
          type: getMimeType(fileName),
        });

        setFile(fileObj);
        await parseFile(fileObj);
      } catch (err: unknown) {
        handleAsyncError({
          context: "Failed to read dropped file",
          error: err,
          setError: (message) => {
            setParseError(
              t("import.error.failed_read_dropped", { error: message }),
            );
          },
          detailFallback: t("import.failed"),
        });
      }
    },
    [parseFile, t],
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let unlistenDrop: (() => void) | null = null;
    let unlistenHover: (() => void) | null = null;
    let unlistenLeave: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenDrop = await listen("tauri://drag-drop", (event) => {
        const payload = event.payload as { paths?: string[] };
        const paths = payload.paths;
        if (paths && paths.length > 0) {
          const filePath = paths[0];
          if (filePath && hasValidExtension(filePath)) {
            void handleFileFromPath(filePath);
          }
        }
        setIsDragging(false);
      });

      unlistenHover = await listen("tauri://drag-over", () => {
        setIsDragging(true);
      });

      unlistenLeave = await listen("tauri://drag-leave", () => {
        setIsDragging(false);
      });
    };

    void setupListeners();

    return () => {
      document.body.style.overflow = prevOverflow || "";
      if (unlistenDrop) unlistenDrop();
      if (unlistenHover) unlistenHover();
      if (unlistenLeave) unlistenLeave();
    };
  }, [handleFileFromPath]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile && hasValidExtension(droppedFile.name)) {
        setFile(droppedFile);
        void parseFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    void parseFile(selectedFile);
  };

  const clearFile = useCallback(() => {
    setFile(null);
    setColumns([]);
    setPreviewRows([]);
    setParseError(null);
  }, []);

  return {
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
  };
}
