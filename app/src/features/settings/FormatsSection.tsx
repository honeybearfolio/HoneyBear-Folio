import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import CustomSelect from "../../components/ui/CustomSelect";
import { CURRENCIES } from "../../utils/currencies";
import { formatDateForUI, formatNumberWithLocale } from "../../utils/format";
import { APP_DEFAULTS } from "../../constants/app";

export interface FormatsSectionProps {
  locale: string;
  setLocale: (locale: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  dateFormat: string;
  setDateFormat: (format: string) => void;
  firstDayOfWeek: number;
  setFirstDayOfWeek: (day: number) => void;
  checkAndPrompt: (currency: string) => Promise<boolean>;
  showTooltip: (e: React.MouseEvent | React.FocusEvent) => void;
  hideTooltip: (e: React.MouseEvent | React.FocusEvent) => void;
}

export default function FormatsSection({
  locale,
  setLocale,
  currency,
  setCurrency,
  dateFormat,
  setDateFormat,
  firstDayOfWeek,
  setFirstDayOfWeek,
  checkAndPrompt,
  showTooltip,
  hideTooltip,
}: FormatsSectionProps) {
  const { t } = useTranslation();

  const _today = new Date();
  const dateFormatOptions = [
    { value: "YYYY-MM-DD", label: formatDateForUI(_today, "YYYY-MM-DD") },
    { value: "YYYY/MM/DD", label: formatDateForUI(_today, "YYYY/MM/DD") },
    { value: "MM/DD/YYYY", label: formatDateForUI(_today, "MM/DD/YYYY") },
    { value: "DD/MM/YYYY", label: formatDateForUI(_today, "DD/MM/YYYY") },
    { value: "DD-MM-YYYY", label: formatDateForUI(_today, "DD-MM-YYYY") },
    { value: "DD.MM.YYYY", label: formatDateForUI(_today, "DD.MM.YYYY") },
    { value: "DD MMM YYYY", label: formatDateForUI(_today, "DD MMM YYYY") },
    { value: "MMM DD, YYYY", label: formatDateForUI(_today, "MMM DD, YYYY") },
    { value: "MMMM D, YYYY", label: formatDateForUI(_today, "MMMM D, YYYY") },
  ];

  const example = formatNumberWithLocale(1234.56, locale, {
    style: "currency",
    currency: currency || APP_DEFAULTS.CURRENCY,
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="label-with-help">
          <span
            className="help-wrapper"
            data-tooltip={t("settings.tooltip.currency")}
            role="button"
            tabIndex={0}
            aria-label={t("settings.tooltip.currency")}
            onMouseEnter={showTooltip}
            onFocus={showTooltip}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
          >
            <HelpCircle
              className="w-4 h-4 text-slate-400 help-icon"
              aria-hidden="true"
            />
          </span>
          <label className="settings-label">
            {t("settings.currency")}
          </label>
        </div>
      </div>
      <div className="relative settings-select">
        <CustomSelect
          value={currency}
          onChange={async (v) => {
            setCurrency(String(v));
            if (v) {
              const confirmed = await checkAndPrompt(String(v));
              if (!confirmed) {
                setCurrency(currency);
              }
            }
          }}
          options={CURRENCIES.map((c) => ({
            value: c.code,
            label: `${c.code} - ${c.name} (${c.symbol})`,
          }))}
          placeholder={t("account.placeholder.select_currency")}
          fullWidth={false}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="label-with-help">
          <span
            className="help-wrapper"
            data-tooltip={t("settings.tooltip.number_format")}
            role="button"
            tabIndex={0}
            aria-label={t("settings.tooltip.number_format")}
            onMouseEnter={showTooltip}
            onFocus={showTooltip}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
          >
            <HelpCircle
              className="w-4 h-4 text-slate-400 help-icon"
              aria-hidden="true"
            />
          </span>
          <label className="settings-label">
            {t("settings.number_format")}
          </label>
        </div>
      </div>

      <div className="relative settings-select">
        <CustomSelect
          value={locale}
          onChange={(v) => setLocale(String(v))}
          options={[
            { value: "en-US", label: "1,234.56" },
            { value: "de-DE", label: "1.234,56" },
            { value: "fr-FR", label: "1 234,56" },
            { value: "de-CH", label: "1'234.56" },
            { value: "en-IN", label: "1,23,456.78" },
          ]}
          placeholder={t("settings.select_format_placeholder")}
          fullWidth={false}
        />
      </div>
      <p className="text-slate-400 mt-3">
        {t("settings.example", { example })}
      </p>

      <div className="flex items-center justify-between mt-4">
        <div className="label-with-help">
          <span
            className="help-wrapper"
            data-tooltip={t("settings.tooltip.date_format")}
            role="button"
            tabIndex={0}
            aria-label={t("settings.tooltip.date_format")}
            onMouseEnter={showTooltip}
            onFocus={showTooltip}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
          >
            <HelpCircle
              className="w-4 h-4 text-slate-400 help-icon"
              aria-hidden="true"
            />
          </span>
          <label className="settings-label">
            {t("settings.date_format")}
          </label>
        </div>
      </div>
      <div className="relative settings-select">
        <CustomSelect
          value={dateFormat}
          onChange={(v) => setDateFormat(String(v))}
          options={dateFormatOptions}
          placeholder={t("settings.select_date_format_placeholder")}
          fullWidth={false}
        />
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="label-with-help">
          <span
            className="help-wrapper"
            data-tooltip={t("settings.tooltip.first_day_of_week")}
            role="button"
            tabIndex={0}
            aria-label={t("settings.tooltip.first_day_of_week")}
            onMouseEnter={showTooltip}
            onFocus={showTooltip}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
          >
            <HelpCircle
              className="w-4 h-4 text-slate-400 help-icon"
              aria-hidden="true"
            />
          </span>
          <label className="settings-label">
            {t("settings.first_day_of_week")}
          </label>
        </div>
      </div>
      <div className="relative settings-select">
        <CustomSelect
          value={firstDayOfWeek}
          onChange={(v) => setFirstDayOfWeek(Number(v))}
          options={[
            { value: 1, label: t("weekday.monday") },
            { value: 2, label: t("weekday.tuesday") },
            { value: 3, label: t("weekday.wednesday") },
            { value: 4, label: t("weekday.thursday") },
            { value: 5, label: t("weekday.friday") },
            { value: 6, label: t("weekday.saturday") },
            { value: 0, label: t("weekday.sunday") },
          ]}
          placeholder={t("settings.select_first_day_placeholder")}
          fullWidth={false}
        />
      </div>
    </>
  );
}
