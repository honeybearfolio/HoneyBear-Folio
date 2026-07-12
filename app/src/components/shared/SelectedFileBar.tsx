import { FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SelectedFileBarProps {
  fileName: string;
  onChangeFile: () => void;
}

export default function SelectedFileBar({
  fileName,
  onChangeFile,
}: SelectedFileBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="w-5 h-5 text-green-500" />
        <span className="text-slate-900 dark:text-white font-medium">
          {fileName}
        </span>
      </div>
      <button
        onClick={onChangeFile}
        className="text-slate-500 dark:text-slate-400 hover:text-red-400 text-sm"
      >
        {t("import.change_file")}
      </button>
    </div>
  );
}
