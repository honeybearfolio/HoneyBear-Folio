import { useTranslation } from "react-i18next";
import SelectedFileBar from "./SelectedFileBar";

interface ImportFileReviewStepProps {
  fileName: string;
  onChangeFile: () => void;
}

export default function ImportFileReviewStep({
  fileName,
  onChangeFile,
}: ImportFileReviewStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <SelectedFileBar fileName={fileName} onChangeFile={onChangeFile} />
      <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
        {t("import.file_loaded_review") ||
          "File loaded — click Next to review mappings and preview"}
      </div>
    </div>
  );
}
