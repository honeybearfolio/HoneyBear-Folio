import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import CustomSelect from "../../components/ui/CustomSelect";
import { AVAILABLE_LANGUAGES } from "../../i18n/i18n";
import ExchangeRatesList from "../../components/shared/ExchangeRatesList";
import LlmSettingsSection from "./LlmSettingsSection";

export interface GeneralSectionProps {
  uiLanguage: string;
  setUiLanguage: (lang: string) => void;
  dbPath: string;
  handleSelectDb: () => void;
  showTooltip: (e: React.MouseEvent | React.FocusEvent) => void;
  hideTooltip: (e: React.MouseEvent | React.FocusEvent) => void;
}

export default function GeneralSection({
  uiLanguage,
  setUiLanguage,
  dbPath,
  handleSelectDb,
  showTooltip,
  hideTooltip,
}: GeneralSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center justify-between mt-4">
        <div className="label-with-help">
          <span
            className="help-wrapper"
            data-tooltip={t("settings.tooltip.language")}
            role="button"
            tabIndex={0}
            aria-label={t("settings.tooltip.language")}
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
          <label className="settings-label">{t("settings.language")}</label>
        </div>
      </div>
      <div className="relative settings-select">
        <CustomSelect
          value={uiLanguage}
          onChange={(v) => setUiLanguage(String(v))}
          options={AVAILABLE_LANGUAGES.map(({ code, label }) => ({
            value: code,
            label,
          }))}
          placeholder={t("settings.select_language_placeholder")}
          fullWidth={false}
          data-testid="language-select"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="label-with-help">
          <span
            className="help-wrapper"
            data-tooltip={t("settings.tooltip.database_file")}
            role="button"
            tabIndex={0}
            aria-label={t("settings.tooltip.database_file")}
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
            {t("settings.database_file")}
          </label>
        </div>
      </div>
      <div className="relative">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-white dark:bg-slate-700 text-slate-700 dark:text-white text-sm py-1 px-2 rounded w-full max-w-full text-left overflow-hidden truncate border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            onClick={handleSelectDb}
            data-tooltip={dbPath || t("settings.select_db_file")}
            aria-label={dbPath || t("settings.select_db_file")}
            onMouseEnter={showTooltip}
            onFocus={showTooltip}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
          >
            {dbPath && dbPath.length > 0
              ? dbPath
              : t("settings.select_db_file")}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <div className="label-with-help">
          <span
            className="help-wrapper"
            data-tooltip={t("settings.tooltip.exchange_rates")}
            role="button"
            tabIndex={0}
            aria-label={t("settings.tooltip.exchange_rates")}
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
            {t("settings.exchange_rates")}
          </label>
        </div>
      </div>
      <ExchangeRatesList />

      <LlmSettingsSection showTooltip={showTooltip} hideTooltip={hideTooltip} />
    </>
  );
}
