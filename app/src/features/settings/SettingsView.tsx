import { Settings } from "lucide-react";
import "../../styles/Settings.css";
import { useNumberFormat } from "../../stores/number-format";
import { useTheme } from "../../stores/theme";
import ErrorBoundary from "../../components/layout/ErrorBoundary";
import { useState, useEffect } from "react";
import { rust } from "../../api/tauri-client";
import { save } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-shell";
import { useTranslation } from "react-i18next";

import { useCustomRate } from "../../hooks/useCustomRate";
import { useConfirm } from "../../stores/confirm";
import { useToast } from "../../contexts/toast";
import useTagColors from "../../hooks/useTagColors";
import {
  APP_DEFAULTS,
  DEFAULT_SIDEBAR_VISIBILITY,
  RESETTABLE_STORAGE_KEYS,
  STORAGE_KEYS,
} from "../../constants/app";

import GeneralSection from "./GeneralSection";
import CustomizationSection from "./CustomizationSection";
import FormatsSection from "./FormatsSection";
import AboutSection from "./AboutSection";

interface SettingsViewProps {
  activeSection?: "general" | "customization" | "formats" | "about";
  sidebarVisibility?: Record<string, boolean>;
  onChangeSidebarVisibility?: (visibility: Record<string, boolean>) => void;
}

export default function SettingsView({
  activeSection,
  sidebarVisibility,
  onChangeSidebarVisibility,
}: SettingsViewProps) {
  const { t } = useTranslation();
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
  const { setTheme } = useTheme();
  const [dbPath, setDbPath] = useState("");
  const { checkAndPrompt, dialog } = useCustomRate();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { resetAll: resetTagColors } = useTagColors();
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = (await rust.get_db_path_command()) as string;
        if (mounted) setDbPath(p);
      } catch (e) {
        console.error("Failed to fetch DB path:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function showTooltip(e: React.MouseEvent | React.FocusEvent) {
    const el = e.currentTarget as HTMLElement;
    try {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--tooltip-top", `${rect.top - 8}px`);
      el.style.setProperty("--tooltip-left", `${rect.left + rect.width / 2}px`);
      el.setAttribute("data-tooltip-visible", "true");
    } catch {
      // ignore measurement errors
    }
  }

  function hideTooltip(e: React.MouseEvent | React.FocusEvent) {
    const el = e.currentTarget as HTMLElement;
    el.removeAttribute("data-tooltip-visible");
  }

  async function openExternal(url: string) {
    try {
      await open(url);
    } catch (e) {
      console.error("Failed to open external URL:", e);
      showToast(t("error.operation_failed"), { type: "error" });
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
        const p = (await rust.get_db_path_command()) as string;
        setDbPath(p);
      }
    } catch (e) {
      console.error("Failed to select DB file:", e);
      showToast(t("error.operation_failed"), { type: "error" });
    }
  }

  async function handleResetDefaults() {
    try {
      const confirmed = await (
        confirm as (
          message: string,
          options?: Record<string, unknown>,
        ) => Promise<boolean>
      )(t("settings.reset_confirm"), {
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
      onChangeSidebarVisibility?.({ ...DEFAULT_SIDEBAR_VISIBILITY });

      try {
        await rust.reset_db_path();
        const p = (await rust.get_db_path_command()) as string;
        setDbPath(p);
      } catch (e) {
        console.error("Failed to reset DB path:", e);
      }
    } catch (e) {
      console.error("Failed to reset defaults:", e);
      showToast(t("error.operation_failed"), { type: "error" });
    }
  }

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
            <GeneralSection
              uiLanguage={uiLanguage}
              setUiLanguage={setUiLanguage}
              dbPath={dbPath}
              handleSelectDb={handleSelectDb}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
            />
          )}

          {activeSection === "customization" &&
            sidebarVisibility &&
            onChangeSidebarVisibility && (
              <CustomizationSection
                sidebarVisibility={sidebarVisibility}
                onChangeSidebarVisibility={onChangeSidebarVisibility}
                showTooltip={showTooltip}
                hideTooltip={hideTooltip}
                fontSize={fontSize}
                setFontSize={setFontSize}
              />
            )}

          {activeSection === "formats" && (
            <FormatsSection
              locale={locale}
              setLocale={setLocale}
              currency={currency}
              setCurrency={setCurrency}
              dateFormat={dateFormat}
              setDateFormat={setDateFormat}
              firstDayOfWeek={firstDayOfWeek}
              setFirstDayOfWeek={setFirstDayOfWeek}
              checkAndPrompt={checkAndPrompt}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
            />
          )}

          {activeSection === "about" && (
            <AboutSection openExternal={openExternal} />
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
