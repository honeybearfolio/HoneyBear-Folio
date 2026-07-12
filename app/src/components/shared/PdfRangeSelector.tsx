import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/datepicker.css";
import type { Day } from "date-fns";
import { useTranslation } from "react-i18next";
import CustomSelect from "../ui/CustomSelect";
import { getDatePickerFormat } from "../../utils/format";
import { useNumberFormat } from "../../stores/number-format";
import type { PdfDateRange, PdfRangeType } from "../../hooks/usePdfExportRange";

interface PdfRangeSelectorProps {
  rangeType: PdfRangeType;
  setRangeType: (type: PdfRangeType) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonthYear: number;
  setSelectedMonthYear: (year: number) => void;
  selectedMonthIndex: number;
  setSelectedMonthIndex: (index: number) => void;
  customStartDate: Date;
  setCustomStartDate: (date: Date) => void;
  customEndDate: Date;
  setCustomEndDate: (date: Date) => void;
  pdfDateRange: PdfDateRange;
  availableYears: number[];
  availableMonths: { index: number; label: string }[];
}

export default function PdfRangeSelector({
  rangeType,
  setRangeType,
  selectedYear,
  setSelectedYear,
  selectedMonthYear,
  setSelectedMonthYear,
  selectedMonthIndex,
  setSelectedMonthIndex,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  pdfDateRange,
  availableYears,
  availableMonths,
}: PdfRangeSelectorProps) {
  const { t } = useTranslation();
  const { dateFormat, firstDayOfWeek } = useNumberFormat();

  return (
    <div className="pdf-range-section">
      <label className="modal-label">{t("export.pdf.time_range")}</label>

      <CustomSelect
        value={rangeType}
        onChange={(v) => {
          setRangeType(String(v) as PdfRangeType);
        }}
        options={[
          { value: "ytd", label: t("export.pdf.ytd") },
          { value: "annual", label: t("export.pdf.annual") },
          { value: "month", label: t("export.pdf.month") },
          { value: "custom", label: t("export.pdf.custom") },
        ]}
      />

      {rangeType === "annual" && (
        <div className="pdf-sub-select">
          <label className="pdf-sub-label">{t("export.pdf.select_year")}</label>
          <CustomSelect
            value={selectedYear}
            onChange={(v) => {
              setSelectedYear(Number(v));
            }}
            options={availableYears.map((yr) => ({
              value: yr,
              label: String(yr),
            }))}
          />
        </div>
      )}

      {rangeType === "month" && (
        <div className="pdf-sub-select">
          <label className="pdf-sub-label">{t("export.pdf.select_year")}</label>
          <CustomSelect
            value={selectedMonthYear}
            onChange={(v) => {
              const yr = Number(v);
              setSelectedMonthYear(yr);
              const now = new Date();
              if (
                yr === now.getFullYear() &&
                selectedMonthIndex > now.getMonth()
              ) {
                setSelectedMonthIndex(now.getMonth());
              }
            }}
            options={availableYears.map((yr) => ({
              value: yr,
              label: String(yr),
            }))}
          />
          <label className="pdf-sub-label mt-2">
            {t("export.pdf.select_month")}
          </label>
          <CustomSelect
            value={selectedMonthIndex}
            onChange={(v) => {
              setSelectedMonthIndex(Number(v));
            }}
            options={availableMonths.map((m) => ({
              value: m.index,
              label: m.label,
            }))}
          />
        </div>
      )}

      {rangeType === "custom" && (
        <div className="pdf-sub-select">
          <label className="pdf-sub-label">{t("export.pdf.start_date")}</label>
          <DatePicker
            selected={customStartDate}
            onChange={(date: Date | null) => {
              if (date) {
                setCustomStartDate(date);
                if (date > customEndDate) setCustomEndDate(date);
              }
            }}
            selectsStart
            startDate={customStartDate}
            endDate={customEndDate}
            maxDate={new Date()}
            showPopperArrow={false}
            portalId="datepicker-portal"
            popperPlacement="bottom-start"
            dateFormat={getDatePickerFormat(dateFormat)}
            calendarStartDay={firstDayOfWeek as Day}
            className="pdf-date-input"
          />
          <label className="pdf-sub-label mt-2">
            {t("export.pdf.end_date")}
          </label>
          <DatePicker
            selected={customEndDate}
            onChange={(date: Date | null) => {
              if (date) setCustomEndDate(date);
            }}
            selectsEnd
            startDate={customStartDate}
            endDate={customEndDate}
            minDate={customStartDate}
            maxDate={new Date()}
            showPopperArrow={false}
            portalId="datepicker-portal"
            popperPlacement="bottom-start"
            dateFormat={getDatePickerFormat(dateFormat)}
            calendarStartDay={firstDayOfWeek as Day}
            className="pdf-date-input"
          />
        </div>
      )}

      <div className="pdf-range-preview">
        {pdfDateRange.start} — {pdfDateRange.end}
      </div>
    </div>
  );
}
