import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle, Loader2, Check, AlertCircle } from "lucide-react";
import CustomSelect from "../../components/ui/CustomSelect";
import { rust } from "../../api/tauri-client";
import { useConfirm } from "../../stores/confirm";
import { useToast } from "../../stores/toast";

interface OllamaModel {
  name: string;
  size?: number;
}

export interface LlmSettingsSectionProps {
  showTooltip: (e: React.MouseEvent | React.FocusEvent) => void;
  hideTooltip: (e: React.MouseEvent | React.FocusEvent) => void;
}

export default function LlmSettingsSection({
  showTooltip,
  hideTooltip,
}: LlmSettingsSectionProps) {
  const { t } = useTranslation();
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    rust.get_llm_settings().then((_s) => {
      const s = _s;
      if (s.ollama_url) setOllamaUrl(s.ollama_url);
      if (s.ollama_model) setOllamaModel(s.ollama_model);
    });
  }, []);

  async function handleTestConnection() {
    setLoading(true);
    try {
      await rust.set_llm_settings({ ollamaUrl, ollamaModel });
      const ok = await rust.check_ollama_connection();
      setConnected(ok);
      if (ok) {
        const list = (await rust.list_ollama_models()) as OllamaModel[];
        setModels(list);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveModel(val: string | number) {
    setOllamaModel(String(val));
    try {
      await rust.set_llm_settings({ ollamaUrl, ollamaModel: String(val) });
    } catch {
      // ignore
    }
  }

  async function handleSaveUrl() {
    try {
      await rust.set_llm_settings({ ollamaUrl, ollamaModel });
    } catch {
      // ignore
    }
  }

  async function handleClearHistory() {
    const ok = await (
      confirm as (
        message: string,
        options?: Record<string, unknown>,
      ) => Promise<boolean>
    )(t("chat.clear_history_confirm"), {
      title: t("chat.clear_history"),
      kind: "warning",
    });
    if (!ok) return;
    try {
      await rust.delete_all_conversations();
      showToast(t("chat.clear_history"), { type: "success" });
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mt-6 mb-2">
        <div className="label-with-help">
          <span
            className="help-wrapper"
            data-tooltip={t("settings.tooltip.llm")}
            role="button"
            tabIndex={0}
            aria-label={t("settings.tooltip.llm")}
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
          <label className="settings-label">{t("nav.ai_assistant")}</label>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            {t("chat.ollama_url")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => {
                setOllamaUrl(e.target.value);
              }}
              onBlur={handleSaveUrl}
              className="flex-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-white text-sm py-1 px-2 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleTestConnection}
              disabled={loading}
              className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                t("chat.test_connection")
              )}
            </button>
          </div>
          {connected !== null && (
            <div className="mt-1 flex items-center gap-1.5">
              {connected ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    {t("chat.connected")}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {t("chat.not_connected")}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {models.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t("chat.model")}
            </label>
            <div className="relative settings-select">
              <CustomSelect
                value={ollamaModel}
                onChange={(v) => handleSaveModel(v)}
                options={models.map((m) => ({
                  value: m.name,
                  label: m.name,
                }))}
                placeholder={t("chat.setup.select_model")}
                fullWidth={false}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleClearHistory}
          className="text-xs text-red-600 dark:text-red-400 hover:underline"
        >
          {t("chat.clear_history")}
        </button>
      </div>
    </>
  );
}
