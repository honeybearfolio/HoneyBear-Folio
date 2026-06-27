import DatePicker from "react-datepicker";
import type { Day } from "date-fns";
import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDatePickerFormat } from "../../utils/format";

interface TimeRangeSelectorProps {
  timeRange: string;
  setTimeRange: (range: string) => void;
  customStartDate: Date;
  customEndDate: Date;
  setCustomStartDate: (date: Date) => void;
  setCustomEndDate: (date: Date) => void;
  dateFormat: string;
  firstDayOfWeek: number;
}

export default function TimeRangeSelector({
  timeRange,
  setTimeRange,
  customStartDate,
  customEndDate,
  setCustomStartDate,
  setCustomEndDate,
  dateFormat,
  firstDayOfWeek,
}: TimeRangeSelectorProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="time-range-selector min-w-0">
        {["1M", "3M", "6M", "1Y", "YTD", "ALL", "CUSTOM"].map((range) => (
          <button
            key={range}
            onClick={() => {
              setTimeRange(range);
            }}
            className={`time-range-button whitespace-nowrap ${
              timeRange === range
                ? "time-range-button-active"
                : "time-range-button-inactive"
            }`}
          >
            {range === "CUSTOM" ? t("dashboard.custom") : range}
          </button>
        ))}
      </div>

      {timeRange === "CUSTOM" && (
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <DatePicker
              selected={customStartDate}
              onChange={(date: Date | null) => {
                setCustomStartDate(date!);
                if (date && customEndDate && date > customEndDate) {
                  setCustomEndDate(date);
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
              className="w-24 bg-transparent text-xs font-medium focus:outline-none text-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2 px-2">
            <DatePicker
              selected={customEndDate}
              onChange={(date: Date | null) => {
                setCustomEndDate(date!);
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
              className="w-24 bg-transparent text-xs font-medium focus:outline-none text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>
      )}
    </>
  );
}
