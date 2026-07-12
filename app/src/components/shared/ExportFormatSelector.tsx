import { FileJson, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExportFormat } from "../../utils/spreadsheet-export";

interface ExportFormatSelectorProps {
  format: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
}

export default function ExportFormatSelector({
  format,
  onFormatChange,
}: ExportFormatSelectorProps) {
  const { t } = useTranslation();

  const formats: { id: ExportFormat; icon: typeof FileJson; label: string }[] =
    [
      { id: "json", icon: FileJson, label: t("export.format.json") },
      { id: "csv", icon: FileText, label: t("export.format.csv") },
      { id: "xlsx", icon: FileSpreadsheet, label: t("export.format.xlsx") },
      { id: "pdf", icon: FileDown, label: t("export.format.pdf") },
    ];

  return (
    <>
      <label className="modal-label">{t("export.select_format")}</label>
      <div className="format-grid">
        {formats.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => {
              onFormatChange(id);
            }}
            className={`format-button ${
              format === id ? "format-button-active" : "format-button-inactive"
            }`}
          >
            <Icon className="w-6 h-6 mb-2" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
