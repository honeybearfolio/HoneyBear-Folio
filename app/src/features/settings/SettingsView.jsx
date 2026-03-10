import PropTypes from "prop-types";
import {
  Settings,
  Globe,
  HelpCircle,
  ExternalLink,
  BookOpen,
  Lightbulb,
  Bug,
  Github,
} from "lucide-react";
import "../../styles/Settings.css";
import { useNumberFormat } from "../../contexts/number-format";
import { useTheme } from "../../contexts/theme-core";
import { formatNumberWithLocale } from "../../utils/format";
import { CURRENCIES } from "../../utils/currencies";
import CustomSelect from "../../components/ui/CustomSelect";
import Switch from "../../components/ui/Switch";
import ErrorBoundary from "../../components/layout/ErrorBoundary";
import { useState, useEffect } from "react";
import { rust } from "../../api/tauri-client";
import { save } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-shell";
import { t, AVAILABLE_LANGUAGES } from "../../i18n/i18n";
import { formatDateForUI } from "../../utils/format";
import { IS_RELEASE, APP_VERSION, APP_COMMIT } from "../../utils/version";

import { useCustomRate } from "../../hooks/useCustomRate";
import { useConfirm } from "../../contexts/confirm";
import CONTRIBUTORS from "../../config/contributors";
import THIRD_PARTY_LICENSES from "../../config/licenses";
import { ChevronDown, ChevronUp } from "lucide-react";
import ExchangeRatesList from "../../components/shared/ExchangeRatesList";
import useTagColors from "../../hooks/useTagColors";
import {
  TAG_COLOR_KEYS,
  getColorClasses,
  getColorDot,
} from "../../config/tag-colors";
import {
  APP_DEFAULTS,
  DEFAULT_SIDEBAR_VISIBILITY,
  EXTERNAL_URLS,
  RESETTABLE_STORAGE_KEYS,
  STORAGE_KEYS,
} from "../../constants/app";

export default function SettingsView({
  activeSection,
  sidebarVisibility,
  onChangeSidebarVisibility,
}) {
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
  const { theme, setTheme } = useTheme();
  const [dbPath, setDbPath] = useState("");
  const { checkAndPrompt, dialog } = useCustomRate();
  const confirm = useConfirm();
  const [showAllLicenses, setShowAllLicenses] = useState(false);
  const { tagColors, setTagColor, resetAll: resetTagColors } = useTagColors();
  const [categories, setCategories] = useState([]);
  const [fontSize, setFontSize] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
      return v ? parseFloat(v) : APP_DEFAULTS.FONT_SIZE;
    } catch {
      return APP_DEFAULTS.FONT_SIZE;
    }
  });

  useEffect(() => {
    try {
      document.documentElement.style.setProperty(
        "--hb-font-size",
        `${fontSize}`,
      );
      localStorage.setItem(STORAGE_KEYS.FONT_SIZE, String(fontSize));
    } catch (e) {
      console.error("Failed to apply font size:", e);
    }
  }, [fontSize]);

  const example = formatNumberWithLocale(1234.56, locale, {
    style: "currency",
    currency: currency || APP_DEFAULTS.CURRENCY,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await rust.get_db_path_command();
        if (mounted) setDbPath(p);
      } catch (e) {
        console.error("Failed to fetch DB path:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function showTooltip(e) {
    const el = e.currentTarget;
    try {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--tooltip-top", `${rect.top - 8}px`);
      el.style.setProperty("--tooltip-left", `${rect.left + rect.width / 2}px`);
      el.setAttribute("data-tooltip-visible", "true");
    } catch {
      // ignore measurement errors
    }
  }

  function hideTooltip(e) {
    const el = e.currentTarget;
    el.removeAttribute("data-tooltip-visible");
  }

  async function openExternal(url) {
    try {
      await open(url);
    } catch (e) {
      console.error("Failed to open external URL:", e);
    }
  }

  async function handleSelectDb() {
    try {
      const defaultPath = dbPath && dbPath.length > 0 ? dbPath : undefined;
      const path = await save({
        defaultPath,
        filters: [{ name: "SQLite", extensions: ["db", "sqlite"] }],
      });
      if (path) {
        await rust.set_db_path({ path });
        const p = await rust.get_db_path_command();
        setDbPath(p);
      }
    } catch (e) {
      console.error("Failed to select DB file:", e);
    }
  }

  async function handleResetDefaults() {
    try {
      const confirmed = await confirm(t("settings.reset_confirm"), {
        kind: "warning",
      });
      if (!confirmed) return;

      try {
        RESETTABLE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      } catch {
        /* ignore */
      }

      setLocale(APP_DEFAULTS.LOCALE);
      setCurrency(APP_DEFAULTS.CURRENCY);
      setTheme(APP_DEFAULTS.THEME);
      setFontSize(APP_DEFAULTS.FONT_SIZE);
      setDateFormat(APP_DEFAULTS.DATE_FORMAT);
      setFirstDayOfWeek(APP_DEFAULTS.FIRST_DAY_OF_WEEK);
      setUiLanguage(APP_DEFAULTS.UI_LANGUAGE);
      resetTagColors();
      onChangeSidebarVisibility({ ...DEFAULT_SIDEBAR_VISIBILITY });

      try {
        await rust.reset_db_path();
        const p = await rust.get_db_path_command();
        setDbPath(p);
      } catch (e) {
        console.error("Failed to reset DB path:", e);
      }
    } catch (e) {
      console.error("Failed to reset defaults:", e);
    }
  }

  useEffect(() => {
    if (activeSection === "customization") {
      (async () => {
        try {
          const cats = await rust.get_categories();
          const all = cats.includes("Transfer") ? cats : ["Transfer", ...cats];
          setCategories(all.sort((a, b) => a.localeCompare(b)));
        } catch (e) {
          console.error("Failed to fetch categories:", e);
        }
      })();
    }
  }, [activeSection]);

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

  return (
    <ErrorBoundary>
      <div className="settings-view">
        <div className="settings-view-header">
          <Settings className="w-6 h-6 text-brand-400" />
          <h1 className="settings-view-title">{t("settings.title")}</h1>
        </div>

        <div className="settings-view-body">
          <div className="settings-section-title">
            <h3 className="settings-section-heading">
              {activeSection === "general"
                ? t("settings.general")
                : activeSection === "customization"
                  ? t("settings.customization")
                  : activeSection === "formats"
                    ? t("settings.formats")
                    : t("settings.about")}
            </h3>
          </div>

          {activeSection === "general" && (
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
                  <label className="settings-label">
                    {t("settings.language")}
                  </label>
                </div>
              </div>
              <div className="relative settings-select">
                <CustomSelect
                  value={uiLanguage}
                  onChange={(v) => setUiLanguage(v)}
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
            </>
          )}

          {activeSection === "customization" && sidebarVisibility && (
            <>
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <div className="label-with-help">
                    <span
                      className="help-wrapper"
                      data-tooltip={t("settings.tooltip.theme")}
                      role="button"
                      tabIndex={0}
                      aria-label={t("settings.tooltip.theme")}
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
                      {t("settings.theme")}
                    </label>
                  </div>
                </div>

                <div className="relative settings-select mt-2">
                  <CustomSelect
                    value={theme}
                    onChange={(v) => setTheme(v)}
                    options={[
                      { value: "light", label: t("settings.theme.light") },
                      {
                        value: "high-contrast-light",
                        label: t("settings.theme.high_contrast_light"),
                      },
                      { value: "dark", label: t("settings.theme.dark") },
                      {
                        value: "high-contrast-dark",
                        label: t("settings.theme.high_contrast_dark"),
                      },
                      { value: "system", label: t("settings.theme.system") },
                    ]}
                    placeholder={t("settings.select_theme_placeholder")}
                    fullWidth={false}
                  />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="label-with-help">
                    <span
                      className="help-wrapper"
                      data-tooltip={t("settings.tooltip.font_size")}
                      role="button"
                      tabIndex={0}
                      aria-label={t("settings.tooltip.font_size")}
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
                      {t("settings.font_size")}
                    </label>
                  </div>
                  <div className="text-sm text-slate-500">
                    {Math.round(fontSize * 100)}%
                  </div>
                </div>
                <div className="relative mt-1 settings-slider">
                  <input
                    type="range"
                    min={0.75}
                    max={1.25}
                    step={0.05}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-brand-500"
                    aria-label={t("settings.font_size")}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="label-with-help">
                  <span
                    className="help-wrapper"
                    data-tooltip={t("settings.tooltip.sidebar_items")}
                    role="button"
                    tabIndex={0}
                    aria-label={t("settings.tooltip.sidebar_items")}
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
                    {t("settings.sidebar_items")}
                  </label>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                {[
                  {
                    key: "dashboard",
                    label: t("settings.sidebar.dashboard"),
                  },
                  {
                    key: "investments",
                    label: t("settings.sidebar.investments"),
                  },
                  {
                    key: "fire",
                    label: t("settings.sidebar.fire_calculator"),
                  },
                  { key: "rules", label: t("settings.sidebar.rules") },
                  {
                    key: "scheduled",
                    label: t("settings.sidebar.scheduled"),
                  },
                  {
                    key: "all",
                    label: t("settings.sidebar.all_transactions"),
                  },
                ].map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {label}
                    </span>
                    <Switch
                      checked={sidebarVisibility[key]}
                      onChange={(val) =>
                        onChangeSidebarVisibility({
                          ...sidebarVisibility,
                          [key]: val,
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-6 mb-4">
                <div className="label-with-help">
                  <span
                    className="help-wrapper"
                    data-tooltip={t("settings.tooltip.tag_colors")}
                    role="button"
                    tabIndex={0}
                    aria-label={t("settings.tooltip.tag_colors")}
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
                    {t("settings.tag_colors")}
                  </label>
                </div>
              </div>

              {categories.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                  {t("settings.tag_colors.empty")}
                </p>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                  {categories.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <span
                        className={`px-2 py-1 inline-flex text-xs font-bold rounded-lg border ${
                          tagColors[cat]
                            ? getColorClasses(tagColors[cat])
                            : cat === "Transfer"
                              ? getColorClasses("purple")
                              : getColorClasses("slate")
                        }`}
                      >
                        {cat}
                      </span>
                      <div className="flex items-center gap-1">
                        {TAG_COLOR_KEYS.map((colorKey) => (
                          <button
                            key={colorKey}
                            type="button"
                            onClick={() => setTagColor(cat, colorKey)}
                            title={colorKey}
                            className={`w-5 h-5 rounded-full border-2 transition-transform ${getColorDot(colorKey)} ${
                              tagColors[cat] === colorKey ||
                              (!tagColors[cat] &&
                                ((cat === "Transfer" &&
                                  colorKey === "purple") ||
                                  (cat !== "Transfer" && colorKey === "slate")))
                                ? "border-slate-900 dark:border-white scale-110"
                                : "border-transparent hover:scale-110"
                            }`}
                            aria-label={colorKey}
                          />
                        ))}
                        {/* cross reset button removed per user request; default color can still be restored by clearing storage or via reset-all setting */}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeSection === "formats" && (
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
                    setCurrency(v);
                    if (v) {
                      const confirmed = await checkAndPrompt(v);
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
                  onChange={(v) => setLocale(v)}
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
                  onChange={(v) => setDateFormat(v)}
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
          )}

          {activeSection === "about" && (
            <>
              <div className="about-header">
                <img
                  src="/icon.png"
                  alt="HoneyBear Folio"
                  className="w-16 h-16 object-contain mb-3"
                />
                <h3 className="about-app-name">HoneyBear Folio</h3>
                <div className="about-version-badge">
                  <span>{t("about.version")}:</span>
                  {IS_RELEASE && APP_VERSION ? (
                    <>
                      <a
                        href={`${EXTERNAL_URLS.GITHUB_REPO}/releases/tag/v${APP_VERSION}`}
                        className="about-version-link"
                        onClick={(e) => {
                          e.preventDefault();
                          openExternal(
                            `${EXTERNAL_URLS.GITHUB_REPO}/releases/tag/v${APP_VERSION}`,
                          );
                        }}
                      >
                        v{APP_VERSION}
                      </a>
                      {APP_COMMIT && (
                        <>
                          <span>(</span>
                          <a
                            href={`${EXTERNAL_URLS.GITHUB_REPO}/commit/${APP_COMMIT}`}
                            className="about-version-link"
                            style={{ fontFamily: "monospace" }}
                            onClick={(e) => {
                              e.preventDefault();
                              openExternal(
                                `${EXTERNAL_URLS.GITHUB_REPO}/commit/${APP_COMMIT}`,
                              );
                            }}
                          >
                            {APP_COMMIT.substring(0, 7)}
                          </a>
                          <span>)</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span>dev</span>
                      {APP_COMMIT && (
                          <p>
                          (<a
                            href={`${EXTERNAL_URLS.GITHUB_REPO}/commit/${APP_COMMIT}`}
                            className="about-version-link"
                            style={{ fontFamily: "monospace" }}
                            onClick={(e) => {
                              e.preventDefault();
                              openExternal(
                                `${EXTERNAL_URLS.GITHUB_REPO}/commit/${APP_COMMIT}`,
                              );
                            }}
                          >
                            {APP_COMMIT.substring(0, 7)}
                          </a>)
                          </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="about-section">
                <h4 className="about-section-title">{t("about.copyright")}</h4>
                <p className="about-section-content">© 2026 HoneyBearFolio</p>
              </div>

              <div className="about-section">
                <h4 className="about-section-title">{t("about.license")}</h4>
                <p className="about-license-text">{t("about.license_text")}</p>
                <a
                  href={EXTERNAL_URLS.LICENSE}
                  className="about-link"
                  onClick={(e) => {
                    e.preventDefault();
                    openExternal(EXTERNAL_URLS.LICENSE);
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("about.view_license")}
                </a>
              </div>

              <div className="about-section">
                <h4 className="about-section-title">
                  {t("about.third_party")}
                </h4>
                {showAllLicenses && (
                  <ul className="about-license-list">
                    {THIRD_PARTY_LICENSES.map((l) => (
                      <li key={l.name}>
                        <a
                          href={l.url}
                          className="about-link"
                          onClick={(e) => {
                            e.preventDefault();
                            openExternal(l.url);
                          }}
                        >
                          {l.name}
                        </a>
                        <span className="about-license-meta">
                          ({l.license})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2">
                  <button
                    onClick={() => setShowAllLicenses(!showAllLicenses)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                  >
                    {showAllLicenses ? (
                      <>
                        <span>{t("about.third_party_hide")}</span>
                        <ChevronUp className="w-3 h-3" />
                      </>
                    ) : (
                      <>
                        <span>
                          {t("about.third_party_show", {
                            count: THIRD_PARTY_LICENSES.length,
                          })}
                        </span>
                        <ChevronDown className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="about-divider" />

              <div className="about-section">
                <h4 className="about-section-title">
                  {t("about.contributors")}
                </h4>
                {CONTRIBUTORS.map((c) => {
                  const profileUrl =
                    c.github || `https://github.com/${c.username}`;
                  const avatarUrl = `https://avatars.githubusercontent.com/${c.username}?s=120&v=4`;
                  return (
                    <a
                      key={c.username}
                      href={profileUrl}
                      className="about-contributor about-contributor-link"
                      onClick={(e) => {
                        e.preventDefault();
                        openExternal(profileUrl);
                      }}
                    >
                      <img
                        src={avatarUrl}
                        alt={`${c.username} avatar`}
                        className="about-contributor-avatar"
                      />
                      <div className="about-contributor-info">
                        <span className="about-contributor-name">
                          {c.username}
                        </span>
                        <span className="about-contributor-role">
                          {t(c.roleKey)}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>

              <div className="about-divider" />

              <div className="about-section">
                <div className="about-links">
                  <a
                    href={EXTERNAL_URLS.WEBSITE}
                    className="about-link"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternal(EXTERNAL_URLS.WEBSITE);
                    }}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {t("about.website")}
                  </a>
                  <a
                    href={EXTERNAL_URLS.GITHUB_REPO}
                    className="about-link"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternal(EXTERNAL_URLS.GITHUB_REPO);
                    }}
                  >
                    <Github className="w-3.5 h-3.5" />
                    {t("about.github")}
                  </a>
                  <a
                    href={`${EXTERNAL_URLS.GITHUB_REPO}/issues/new?template=feature_request.md`}
                    className="about-link"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternal(
                        `${EXTERNAL_URLS.GITHUB_REPO}/issues/new?template=feature_request.md`,
                      );
                    }}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    {t("about.features")}
                  </a>
                  <a
                    href={`${EXTERNAL_URLS.GITHUB_REPO}/issues/new?template=bug_report.md`}
                    className="about-link"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternal(
                        `${EXTERNAL_URLS.GITHUB_REPO}/issues/new?template=bug_report.md`,
                      );
                    }}
                  >
                    <Bug className="w-3.5 h-3.5" />
                    {t("about.issues")}
                  </a>
                  <a
                    href={`${EXTERNAL_URLS.DOCS}`}
                    className="about-link"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternal(`${EXTERNAL_URLS.DOCS}`);
                    }}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    {t("about.docs")}
                  </a>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="settings-view-footer">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="reset-button"
            aria-label={t("settings.reset_to_defaults")}
          >
            {t("settings.reset_to_defaults")}
          </button>
        </div>
      </div>
      {dialog}
    </ErrorBoundary>
  );
}

SettingsView.propTypes = {
  activeSection: PropTypes.oneOf([
    "general",
    "customization",
    "formats",
    "about",
  ]),
  sidebarVisibility: PropTypes.objectOf(PropTypes.bool),
  onChangeSidebarVisibility: PropTypes.func,
};

SettingsView.defaultProps = {
  activeSection: "general",
  sidebarVisibility: undefined,
  onChangeSidebarVisibility: undefined,
};
