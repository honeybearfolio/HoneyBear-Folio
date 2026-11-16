import { useState } from "react";
import { Upload } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { useTranslation } from "react-i18next";
import "../../styles/Modal.css";
import "../../styles/ExportModal.css";
import ExportFormatSelector from "./ExportFormatSelector";
import PdfRangeSelector from "./PdfRangeSelector";
import { usePdfExportRange } from "../../hooks/usePdfExportRange";
import { useSpreadsheetExport } from "../../hooks/useSpreadsheetExport";
import {
  PDF_REPORT_TYPES,
  type ExportFormat,
  type PdfReportType,
} from "../../utils/spreadsheet-export";
import CustomSelect from "../ui/CustomSelect";

const SNAPSHOT_REPORT_TYPES = [
  "net_worth",
  "accounts",
  "investments",
  "liabilities",
  "goals",
];

interface ExportModalProps {
  onClose: () => void;
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>("json");
  const [pdfReportType, setPdfReportType] = useState<PdfReportType>("overview");
  const pdfRange = usePdfExportRange();
  const { exporting, exportSpreadsheet } = useSpreadsheetExport({
    onClose,
    pdfDateRange: pdfRange.pdfDateRange,
    pdfReportType,
  });

  if (typeof document === "undefined") return null;

  return (
    <Modal onClose={onClose}>
      <ModalHeader onClose={onClose} title={t("export.title")} icon={Upload} />
      <ModalBody>
        <ExportFormatSelector format={format} onFormatChange={setFormat} />

        {format === "pdf" && (
          <>
            <label className="modal-label">{t("export.pdf.report_type")}</label>
            <CustomSelect
              value={pdfReportType}
              onChange={(value) => {
                setPdfReportType(String(value) as PdfReportType);
              }}
              options={PDF_REPORT_TYPES.map((type) => ({
                value: type,
                label: t(`export.pdf.type.${type}`),
              }))}
            />
            {!SNAPSHOT_REPORT_TYPES.includes(pdfReportType) && (
              <PdfRangeSelector {...pdfRange} />
            )}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          className="btn-secondary"
          disabled={exporting}
        >
          {t("account.cancel")}
        </button>
        <button
          onClick={() => {
            void exportSpreadsheet(format);
          }}
          disabled={exporting}
          className="btn-primary"
        >
          <span className="text-white">
            {exporting
              ? format === "pdf"
                ? t("export.pdf.generating")
                : t("export.exporting")
              : t("export.select_location_export")}
          </span>
        </button>
      </ModalFooter>
    </Modal>
  );
}
