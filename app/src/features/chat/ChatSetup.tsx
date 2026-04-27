import { useState, useEffect } from "react";
import { rust } from "../../api/tauri-client";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Loader2,
  AlertCircle,
  Check,
  Wifi,
  Cpu,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface OllamaModel {
  name: string;
  size?: number;
}

interface LlmSettings {
  ollama_url?: string;
  ollama_model?: string;
}

interface StepIndicatorProps {
  steps: string[];
  current: string;
}

const STEPS = ["connect", "model", "ready"];

function StepIndicator({ steps, current }: StepIndicatorProps) {
  const { t } = useTranslation();
  const currentIdx = steps.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-0.5 rounded-full transition-colors duration-300 ${
                  done ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  done
                    ? "bg-brand-500 text-white"
                    : active
                      ? "bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 ring-2 ring-brand-500/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors duration-300 ${
                  done || active
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {t(`chat.setup.step_${step}`)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ChatSetupProps {
  onComplete: () => void;
}

export default function ChatSetup({ onComplete }: ChatSetupProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"connect" | "model" | "ready">("connect");
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkConnection() {
    setLoading(true);
    setError(null);
    try {
      const settings = (await rust.get_llm_settings()) as LlmSettings;
      if (settings.ollama_url) setOllamaUrl(settings.ollama_url);

      const ok = await rust.check_ollama_connection();
      if (ok) {
        const list = (await rust.list_ollama_models()) as OllamaModel[];
        setModels(list);
        if (list.length > 0) setSelectedModel(list[0].name);
        setStep("model");
      }
    } catch {
      // Connection check failed; leave models and step as-is.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkConnection();
  }, []);

  async function handleTestConnection() {
    setLoading(true);
    setError(null);
    try {
      await rust.set_llm_settings({
        ollamaUrl: ollamaUrl,
        ollamaModel: selectedModel || "",
      });
      const ok = await rust.check_ollama_connection();
      if (ok) {
        const list = (await rust.list_ollama_models()) as OllamaModel[];
        setModels(list);
        if (list.length > 0 && !selectedModel) setSelectedModel(list[0].name);
        setStep("model");
      } else {
        setError(t("chat.connection_error"));
      }
    } catch {
      setError(t("chat.connection_error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectModel() {
    if (!selectedModel) return;
    setStep("ready");
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await rust.set_llm_settings({
        ollamaUrl: ollamaUrl,
        ollamaModel: selectedModel,
      });
      onComplete();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  function formatModelSize(bytes: number | undefined) {
    if (!bytes) return "";
    const gb = bytes / 1e9;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
  }

  return (
    <div className="chat-setup-backdrop">
      <div className="chat-setup-card animate-fade-in">
        {/* Header */}
        <div className="flex flex-col items-center mb-2">
          <div className="chat-setup-icon-ring">
            <Bot className="w-8 h-8 text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-4">
            {t("chat.setup.title")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1.5 max-w-xs">
            {t("chat.setup.description")}
          </p>
        </div>

        <StepIndicator steps={STEPS} current={step} />

        {/* Step: Connect */}
        {step === "connect" && (
          <div className="chat-setup-step animate-fade-in">
            <div className="chat-setup-field">
              <label className="chat-setup-label">
                <Wifi className="w-3.5 h-3.5" />
                {t("chat.ollama_url")}
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="chat-setup-input"
                placeholder="http://localhost:11434"
              />
            </div>

            {error && (
              <div className="chat-setup-error animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={handleTestConnection}
              disabled={loading || !ollamaUrl.trim()}
              className="chat-setup-btn-primary"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t("chat.test_connection")}
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-3">
              {t("chat.setup.install_hint").split("ollama.com")[0]}
              <a
                href="https://ollama.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
              >
                ollama.com
                <ExternalLink className="w-3 h-3" />
              </a>
              {t("chat.setup.install_hint").split("ollama.com")[1]}
            </p>
          </div>
        )}

        {/* Step: Choose Model */}
        {step === "model" && (
          <div className="chat-setup-step animate-fade-in">
            <div className="chat-setup-field">
              <label className="chat-setup-label">
                <Cpu className="w-3.5 h-3.5" />
                {t("chat.model")}
              </label>
              {models.length > 0 ? (
                <div className="chat-setup-model-list">
                  {models.map((m) => (
                    <button
                      key={m.name}
                      onClick={() => setSelectedModel(m.name)}
                      className={`chat-setup-model-item ${
                        selectedModel === m.name
                          ? "chat-setup-model-selected"
                          : ""
                      }`}
                    >
                      <Cpu className="w-4 h-4 shrink-0" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{m.name}</div>
                        {m.size && (
                          <div className="text-xs opacity-60">
                            {formatModelSize(m.size)}
                          </div>
                        )}
                      </div>
                      {selectedModel === m.name && (
                        <Check className="w-4 h-4 text-brand-500" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="chat-setup-error">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{t("chat.setup.no_models")}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleSelectModel}
              disabled={!selectedModel}
              className="chat-setup-btn-primary"
            >
              {t("chat.setup.select_model")}
            </button>

            <button
              onClick={() => {
                setStep("connect");
              }}
              className="chat-setup-btn-ghost"
            >
              ← {t("chat.test_connection")}
            </button>
          </div>
        )}

        {/* Step: Ready */}
        {step === "ready" && (
          <div className="chat-setup-step animate-fade-in">
            <div className="chat-setup-ready-summary">
              <div className="chat-setup-ready-row">
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {ollamaUrl}
                </span>
                <Check className="w-4 h-4 text-emerald-500 ml-auto" />
              </div>
              <div className="chat-setup-ready-row">
                <Cpu className="w-4 h-4 text-brand-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {selectedModel}
                </span>
                <Check className="w-4 h-4 text-emerald-500 ml-auto" />
              </div>
            </div>

            {error && (
              <div className="chat-setup-error animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={saving}
              className="chat-setup-btn-primary"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t("chat.setup.get_started")}
                </>
              )}
            </button>

            <button
              onClick={() => setStep("model")}
              className="chat-setup-btn-ghost"
            >
              ← {t("chat.model")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
