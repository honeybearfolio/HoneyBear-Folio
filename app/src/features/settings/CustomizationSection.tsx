import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import CustomSelect from "../../components/ui/CustomSelect";
import Switch from "../../components/ui/Switch";
import { useTheme } from "../../stores/theme";
import { rust } from "../../api/tauri-client";
import useTagColors from "../../hooks/useTagColors";
import {
  TAG_COLOR_KEYS,
  getColorClasses,
  getColorDot,
} from "../../config/tag-colors";
// constants used by parent for font-size persistence

export interface CustomizationSectionProps {
  sidebarVisibility: Record<string, boolean>;
  onChangeSidebarVisibility: (visibility: Record<string, boolean>) => void;
  showTooltip: (e: React.MouseEvent | React.FocusEvent) => void;
  hideTooltip: (e: React.MouseEvent | React.FocusEvent) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
}

export default function CustomizationSection({
  sidebarVisibility,
  onChangeSidebarVisibility,
  showTooltip,
  hideTooltip,
  fontSize,
  setFontSize,
}: CustomizationSectionProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { tagColors, setTagColor } = useTagColors();
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const cats = (await rust.get_categories()) as string[];
        const all = cats.includes("Transfer") ? cats : ["Transfer", ...cats];
        setCategories(all.sort((a: string, b: string) => a.localeCompare(b)));
      } catch (e) {
        console.error("Failed to fetch categories:", e);
      }
    })();
  }, []);

  return (
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
            onChange={(v) => setTheme(String(v))}
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
              {
                value: "ink-light",
                label: t("settings.theme.ink_light"),
              },
              {
                value: "ink-dark",
                label: t("settings.theme.ink_dark"),
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
            key: "chat",
            label: t("settings.sidebar.ai_assistant"),
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
              aria-label={label}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
