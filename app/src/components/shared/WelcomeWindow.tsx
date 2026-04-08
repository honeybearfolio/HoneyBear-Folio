import { useState } from "react";
import { useTheme } from "../../contexts/theme-core";
import { useNumberFormat } from "../../contexts/number-format";
import { CURRENCIES } from "../../utils/currencies";
import CustomSelect from "../ui/CustomSelect";
import { t, AVAILABLE_LANGUAGES } from "../../i18n/i18n";
import { formatDateForUI } from "../../utils/format";
import { Check } from "lucide-react";
import "../../styles/Modal.css";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { getDevSetting } from "../../config/dev-settings";

export default function WelcomeWindow() {
  const [isVisible, setIsVisible] = useState(() => {
    const forced = getDevSetting("FORCE_WELCOME_SCREEN");
    if (forced === true) return true;

    try {
      return !localStorage.getItem("hb_first_run_completed");
    } catch {
      // In environments where localStorage is unavailable, default to hidden
      return false;
    }
  });
  const { theme, setTheme } = useTheme();
  const {
    locale,
    setLocale,
    currency,
    setCurrency,
    dateFormat,
    setDateFormat,
    firstDayOfWeek,
    setFirstDayOfWeek,
    uiLanguage,
    setUiLanguage,
  } = useNumberFormat();

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

  const handleComplete = () => {
    localStorage.setItem("hb_first_run_completed", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <Modal
      onClose={() => {}} // No-op closing, must complete setup
      className="!max-w-[500px] w-[90%]"
    >
      <ModalHeader title={t("welcome.title")} />

      <ModalBody>
        <p className="mb-6 text-slate-600 dark:text-slate-400">
          {t("welcome.subtitle")}
        </p>

        {/* Language selection — controls UI language only (does NOT change number/date formats) */}
        <div className="mb-6">
          <label className="modal-label">{t("settings.language")}</label>
          <CustomSelect
            value={uiLanguage}
            onChange={setUiLanguage}
            options={AVAILABLE_LANGUAGES.map(({ code, label }) => ({
              value: code,
              label,
            }))}
            placeholder={t("settings.select_language_placeholder")}
            data-testid="language-select"
          />
        </div>

        {/* Theme Selection */}
        <div className="mb-6">
          <label className="modal-label">{t("settings.theme")}</label>
          <CustomSelect
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: t("settings.theme.light") },
              { value: "dark", label: t("settings.theme.dark") },
              { value: "ink-light", label: t("settings.theme.ink_light") },
              { value: "system", label: t("settings.theme.system") },
            ]}
            placeholder={t("settings.select_theme_placeholder")}
            data-testid="theme-select"
          />
        </div>

        {/* Currency Selection */}
        <div className="mb-6">
          <label className="modal-label">{t("import.field.currency")}</label>
          <CustomSelect
            value={currency}
            onChange={setCurrency}
            options={CURRENCIES.map((c) => ({
              value: c.code,
              label: `${c.code} - ${c.name} (${c.symbol})`,
            }))}
            placeholder={t("account.placeholder.select_currency")}
            data-testid="currency-select"
          />
        </div>

        {/* Locale Selection */}
        <div className="mb-6">
          <label className="modal-label">{t("number_format")}</label>
          <CustomSelect
            value={locale}
            onChange={setLocale}
            options={[
              { value: "en-US", label: "1,234.56" },
              { value: "de-DE", label: "1.234,56" },
              { value: "fr-FR", label: "1 234,56" },
              { value: "de-CH", label: "1'234.56" },
              { value: "en-IN", label: "1,23,456.78" },
            ]}
            placeholder={t("settings.select_format_placeholder")}
            data-testid="format-select"
          />
        </div>
        {/* Date Format Selection */}
        <div className="mb-6">
          <label className="modal-label">{t("settings.date_format")}</label>
          <CustomSelect
            value={dateFormat}
            onChange={setDateFormat}
            options={dateFormatOptions}
            placeholder={t("settings.select_date_format_placeholder")}
            data-testid="date-format-select"
          />
        </div>
        {/* First Day of Week Selection */}
        <div className="mb-6">
          <label className="modal-label">
            {t("settings.first_day_of_week")}
          </label>
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
            data-testid="first-day-select"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <button onClick={handleComplete} className="btn-primary">
          <Check size={18} />
          {t("welcome.get_started")}
        </button>
      </ModalFooter>
    </Modal>
  );
}
