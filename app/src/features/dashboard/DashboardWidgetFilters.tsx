import DatePicker from "react-datepicker";
import type { Day } from "date-fns";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Account } from "../../api/types";
import CustomSelect from "../../components/ui/CustomSelect";
import { useNumberFormat } from "../../stores/number-format";
import {
  formatCalendarDate,
  getDatePickerFormat,
  parseCalendarDate,
} from "../../utils/format";
import { isValuelessOperator } from "../rules/rules-helpers";
import type { DashboardTimeRange } from "./dashboard-constants";
import {
  createWidgetFilter,
  operatorsForField,
  WIDGET_FILTER_FIELDS,
  WIDGET_TITLE_KEYS,
  type DashboardWidgetInstance,
  type WidgetFilter,
  type WidgetFilterField,
} from "./dashboard-layout";

const RANGES: DashboardTimeRange[] = [
  "1M",
  "3M",
  "6M",
  "1Y",
  "YTD",
  "ALL",
  "CUSTOM",
];

interface DashboardWidgetFiltersProps {
  widget: DashboardWidgetInstance;
  accounts: Account[];
  onChangeFilters: (filters: WidgetFilter[]) => void;
  onChangeRange: (
    timeRange: DashboardTimeRange | null,
    customStartDate: string | null,
    customEndDate: string | null,
  ) => void;
}

function fieldLabel(field: WidgetFilterField, t: (key: string) => string) {
  if (field === "account") return t("dashboard.field.account");
  if (field === "currency") return t("dashboard.field.currency");
  if (field === "tags") return t("dashboard.field.tags");
  return t(`rules.field.${field}`);
}

export default function DashboardWidgetFilters({
  widget,
  accounts,
  onChangeFilters,
  onChangeRange,
}: DashboardWidgetFiltersProps) {
  const { t } = useTranslation();
  const { dateFormat, firstDayOfWeek } = useNumberFormat();

  const updateFilter = (id: string, patch: Partial<WidgetFilter>) => {
    onChangeFilters(
      widget.filters.map((filter) =>
        filter.id === id ? { ...filter, ...patch } : filter,
      ),
    );
  };

  const rangeValue = widget.timeRange ?? "dashboard";

  return (
    <div className="dashboard-filter-panel">
      <div className="dashboard-filter-field">
        <span className="form-label">{t("dashboard.card_range")}</span>
        <CustomSelect
          aria-label={`${t("dashboard.card_range")} ${t(WIDGET_TITLE_KEYS[widget.type])}`}
          value={rangeValue}
          onChange={(value) => {
            const next = String(value);
            if (next === "dashboard") {
              onChangeRange(null, null, null);
              return;
            }
            onChangeRange(
              next as DashboardTimeRange,
              widget.customStartDate,
              widget.customEndDate,
            );
          }}
          options={[
            { value: "dashboard", label: t("dashboard.follow_dashboard") },
            ...RANGES.map((range) => ({
              value: range,
              label: range === "CUSTOM" ? t("dashboard.custom") : range,
            })),
          ]}
        />
      </div>
      {widget.timeRange === "CUSTOM" && (
        <div className="dashboard-filter-dates">
          <DatePicker
            selected={
              widget.customStartDate
                ? parseCalendarDate(widget.customStartDate)
                : null
            }
            onChange={(date: Date | null) => {
              onChangeRange(
                "CUSTOM",
                date ? formatCalendarDate(date) : null,
                widget.customEndDate,
              );
            }}
            aria-label={t("dashboard.custom_start")}
            isClearable
            showPopperArrow={false}
            portalId="datepicker-portal"
            popperPlacement="bottom-start"
            dateFormat={getDatePickerFormat(dateFormat)}
            calendarStartDay={firstDayOfWeek as Day}
            className="form-input"
            wrapperClassName="w-full"
          />
          <DatePicker
            selected={
              widget.customEndDate
                ? parseCalendarDate(widget.customEndDate)
                : null
            }
            onChange={(date: Date | null) => {
              onChangeRange(
                "CUSTOM",
                widget.customStartDate,
                date ? formatCalendarDate(date) : null,
              );
            }}
            aria-label={t("dashboard.custom_end")}
            isClearable
            showPopperArrow={false}
            portalId="datepicker-portal"
            popperPlacement="bottom-start"
            dateFormat={getDatePickerFormat(dateFormat)}
            calendarStartDay={firstDayOfWeek as Day}
            className="form-input"
            wrapperClassName="w-full"
          />
        </div>
      )}
      {widget.filters.map((filter) => {
        const operators = operatorsForField(filter.field);
        return (
          <div key={filter.id} className="dashboard-filter-rule">
            <CustomSelect
              aria-label={t("dashboard.filter_field")}
              value={filter.field}
              className="min-w-36 flex-1"
              onChange={(value) => {
                const field = String(value) as WidgetFilterField;
                const nextOperators = operatorsForField(field);
                updateFilter(filter.id, {
                  field,
                  operator: nextOperators.includes(filter.operator)
                    ? filter.operator
                    : (nextOperators[0] ?? "equals"),
                  value: "",
                });
              }}
              options={WIDGET_FILTER_FIELDS.map((field) => ({
                value: field,
                label: fieldLabel(field, t),
              }))}
            />
            <CustomSelect
              aria-label={t("dashboard.filter_operator")}
              value={filter.operator}
              className="min-w-40 flex-1"
              onChange={(value) => {
                updateFilter(filter.id, { operator: String(value) });
              }}
              options={operators.map((operator) => ({
                value: operator,
                label: t(`rules.operator.${operator}`),
              }))}
            />
            {!isValuelessOperator(filter.operator) &&
              (filter.field === "account" &&
              (filter.operator === "equals" ||
                filter.operator === "not_equals") ? (
                <CustomSelect
                  aria-label={t("dashboard.filter_value")}
                  value={filter.value}
                  placeholder={t("dashboard.filter_choose")}
                  className="min-w-36 flex-1"
                  onChange={(value) => {
                    updateFilter(filter.id, { value: String(value) });
                  }}
                  options={accounts.map((account) => ({
                    value: String(account.id),
                    label: account.name,
                  }))}
                />
              ) : (
                <input
                  className="form-input dashboard-filter-value"
                  aria-label={t("dashboard.filter_value")}
                  value={filter.value}
                  onChange={(event) => {
                    updateFilter(filter.id, { value: event.target.value });
                  }}
                />
              ))}
            <button
              type="button"
              className="dashboard-widget-icon-button"
              aria-label={t("dashboard.remove_filter")}
              onClick={() => {
                onChangeFilters(
                  widget.filters.filter((item) => item.id !== filter.id),
                );
              }}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="dashboard-add-filter"
        onClick={() => {
          onChangeFilters([...widget.filters, createWidgetFilter()]);
        }}
      >
        {t("dashboard.add_filter")}
      </button>
    </div>
  );
}
