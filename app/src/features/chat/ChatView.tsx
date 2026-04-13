import { useState, useEffect, useRef, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { rust } from "../../api/tauri-client";
import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "../../constants/app";
import ChatSetup from "./ChatSetup";
import CustomSelect from "../../components/ui/CustomSelect";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus,
  Send,
  Trash2,
  Pencil,
  Loader2,
  Bot,
  User,
  MessageSquare,
  Wrench,
  ChevronDown,
  ChevronRight,
  Square,
  Brain,
  Lightbulb,
} from "lucide-react";
import "../../styles/Chat.css";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_accounts: "accounts",
  get_transactions: "transactions",
  get_categories: "categories",
  get_payees: "payees",
  get_scheduled_transactions: "scheduled transactions",
  get_rules: "rules",
  get_exchange_rates: "exchange rates",
};

interface ReasoningBlockProps {
  thinking?: string;
  defaultExpanded?: boolean;
}

function ReasoningBlock({
  thinking,
  defaultExpanded = false,
}: ReasoningBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (!thinking) return null;
  return (
    <div className="chat-reasoning">
      <button
        className="chat-reasoning-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        <Lightbulb className="w-3.5 h-3.5" />
        <span>{t("chat.reasoning")}</span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>
      {expanded && <div className="chat-reasoning-content">{thinking}</div>}
    </div>
  );
}

interface ToolCallBadgeProps {
  toolName: string;
}

function ToolCallBadge({ toolName }: ToolCallBadgeProps) {
  const { t } = useTranslation();
  const displayName = TOOL_DISPLAY_NAMES[toolName] || toolName;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-full text-xs font-medium">
      <Wrench className="w-3 h-3" />
      {t("chat.tool_call").replace("{tool}", displayName)}
    </span>
  );
}

interface ChatMessage {
  id?: number;
  role: string;
  content?: string;
  tool_call_id?: string;
  thinking?: string;
  conversation_id?: string;
  created_at?: string;
  tool_calls?: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
  toolCalls?: string[];
}

function MessageBubble({ message, toolCalls }: MessageBubbleProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const [expanded, setExpanded] = useState(false);

  if (isTool) {
    return (
      <div className="chat-tool-result">
        <button
          className="chat-tool-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <Wrench className="w-3.5 h-3.5" />
          <span>
            {t("chat.tool_call").replace(
              "{tool}",
              (message.tool_call_id
                ? TOOL_DISPLAY_NAMES[message.tool_call_id]
                : undefined) ||
                message.tool_call_id ||
                "data",
            )}
          </span>
        </button>
        {expanded && (
          <pre className="chat-tool-data">
            {(() => {
              try {
                return JSON.stringify(
                  JSON.parse(message.content || ""),
                  null,
                  2,
                );
              } catch {
                return message.content;
              }
            })()}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div
      className={`chat-message ${isUser ? "chat-message-user" : "chat-message-assistant"}`}
    >
      <div
        className={`chat-avatar ${isUser ? "chat-avatar-user" : "chat-avatar-assistant"}`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div
        className={`chat-bubble ${isUser ? "chat-bubble-user" : "chat-bubble-assistant"}`}
      >
        {toolCalls && toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {toolCalls.map((tc, i) => (
              <ToolCallBadge key={i} toolName={tc} />
            ))}
          </div>
        )}
        {!isUser && message.thinking && (
          <ReasoningBlock thinking={message.thinking} />
        )}
        {message.content ? (
          <div className="chat-content prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface Conversation {
  id: string;
  title?: string;
  created_at?: string;
}

interface LlmSettings {
  ollama_url?: string;
  ollama_model?: string;
}

interface OllamaModel {
  name: string;
  size?: number;
}

interface StreamingSegment {
  thinking: string;
  content: string;
  toolCalls?: string[];
}

export default function ChatView() {
  const { t } = useTranslation();
  const [configured, setConfigured] = useState<boolean | null>(null); // null = loading
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingSegments, setStreamingSegments] = useState<
    StreamingSegment[]
  >([]);

  const [streamingStatus, setStreamingStatus] = useState("thinking");
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [currentModel, setCurrentModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [thinkEnabled, setThinkEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CHAT_THINK) === "true";
    } catch {
      return false;
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check if configured on mount and load models
  useEffect(() => {
    rust.get_llm_settings().then((_s) => {
      const s = _s as LlmSettings;
      const isConfigured = !!(s.ollama_model && s.ollama_model.length > 0);
      setConfigured(isConfigured);
      if (s.ollama_model) setCurrentModel(s.ollama_model);
      if (s.ollama_url) setOllamaUrl(s.ollama_url);
      if (isConfigured) {
        rust
          .list_ollama_models()
          .then((list) => setModels(list as OllamaModel[]))
          .catch(() => {});
      }
    });
  }, []);

  // Load conversations
  useEffect(() => {
    if (configured) loadConversations();
  }, [configured]);

  // Set up event listeners for streaming
  useEffect(() => {
    if (!configured) return;

    const unlisteners: UnlistenFn[] = [];
    // Each segment represents one model round: { thinking: string, content: string }
    let segments: StreamingSegment[] = [{ thinking: "", content: "" }];

    listen<{ conversation_id: string; token: string }>("llm-token", (event) => {
      if (activeConvo && event.payload.conversation_id === activeConvo.id) {
        const last = segments[segments.length - 1];
        segments = [
          ...segments.slice(0, -1),
          { ...last, content: last.content + event.payload.token },
        ];
        setStreamingSegments([...segments]);
      }
    }).then((u) => unlisteners.push(u));

    listen<{ conversation_id: string; token: string }>(
      "llm-thinking",
      (event) => {
        if (activeConvo && event.payload.conversation_id === activeConvo.id) {
          const last = segments[segments.length - 1];
          segments = [
            ...segments.slice(0, -1),
            { ...last, thinking: last.thinking + event.payload.token },
          ];
          setStreamingSegments([...segments]);
        }
      },
    ).then((u) => unlisteners.push(u));

    listen<{ conversation_id: string; tool_name: string }>(
      "llm-tool-call",
      (event) => {
        if (activeConvo && event.payload.conversation_id === activeConvo.id) {
          const last = segments[segments.length - 1];
          segments = [
            ...segments.slice(0, -1),
            {
              ...last,
              toolCalls: [...(last.toolCalls || []), event.payload.tool_name],
            },
          ];
          setStreamingSegments([...segments]);
        }
      },
    ).then((u) => unlisteners.push(u));

    listen<{ conversation_id: string; status: string }>(
      "llm-status",
      (event) => {
        if (activeConvo && event.payload.conversation_id === activeConvo.id) {
          const status = event.payload.status;
          // A new reasoning round starts → push a fresh segment
          if (status === "thinking_tools") {
            segments = [
              ...segments,
              { thinking: "", content: "", toolCalls: [] },
            ];
            setStreamingSegments([...segments]);
          }
          setStreamingStatus(status);
        }
      },
    ).then((u) => unlisteners.push(u));

    const resetStreaming = () => {
      segments = [{ thinking: "", content: "", toolCalls: [] }];
      setStreaming(false);
      setStreamingSegments([]);

      setStreamingStatus("thinking");
    };

    listen<{ conversation_id: string }>("llm-done", (event) => {
      if (activeConvo && event.payload.conversation_id === activeConvo.id) {
        resetStreaming();
        loadMessages(activeConvo.id);
        loadConversations();
      }
    }).then((u) => unlisteners.push(u));

    listen<{ conversation_id: string; error: string }>("llm-error", (event) => {
      if (activeConvo && event.payload.conversation_id === activeConvo.id) {
        resetStreaming();
        // Add error as a local pseudo-message
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: "assistant",
            content: `⚠️ ${event.payload.error}`,
            conversation_id: activeConvo.id,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }).then((u) => unlisteners.push(u));

    return () => {
      unlisteners.forEach((u) => u.then?.((fn: () => void) => fn()) || u());
    };
  }, [configured, activeConvo]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingSegments]);

  async function loadConversations() {
    try {
      const list = (await rust.get_conversations()) as Conversation[];
      setConversations(list);
    } catch {
      // ignore
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const msgs = (await rust.get_conversation_messages({
        conversationId: conversationId,
      })) as ChatMessage[];
      setMessages(msgs);
    } catch {
      // ignore
    }
  }

  async function handleSelectConversation(convo: Conversation) {
    setActiveConvo(convo);
    await loadMessages(convo.id);
  }

  async function handleNewConversation() {
    try {
      const convo = (await rust.create_conversation({
        title: t("chat.new_conversation"),
      })) as Conversation;
      await loadConversations();
      setActiveConvo(convo);
      setMessages([]);
      inputRef.current?.focus();
    } catch {
      // ignore
    }
  }

  async function handleDeleteConversation(
    convo: Conversation,
    e: React.MouseEvent,
  ) {
    e.stopPropagation();
    try {
      await rust.delete_conversation({ conversationId: convo.id });
      if (activeConvo?.id === convo.id) {
        setActiveConvo(null);
        setMessages([]);
      }
      await loadConversations();
    } catch {
      // ignore
    }
  }

  function handleStartRename(convo: Conversation, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingTitle(convo.id);
    setEditTitleValue(convo.title || "");
  }

  async function handleFinishRename(convoId: string) {
    if (editTitleValue.trim()) {
      try {
        await rust.rename_conversation({
          conversationId: convoId,
          title: editTitleValue.trim(),
        });
        await loadConversations();
        if (activeConvo?.id === convoId) {
          setActiveConvo((prev) =>
            prev
              ? {
                  ...prev,
                  title: editTitleValue.trim(),
                }
              : prev,
          );
        }
      } catch {
        // ignore
      }
    }
    setEditingTitle(null);
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming) return;

    const text = input.trim();
    setInput("");

    // Create conversation if none active
    let convo = activeConvo;
    if (!convo) {
      try {
        const title = text.length > 40 ? text.substring(0, 40) + "…" : text;
        convo = (await rust.create_conversation({ title })) as Conversation;
        setActiveConvo(convo);
        await loadConversations();
      } catch {
        return;
      }
    }

    // Optimistically add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: text,
        conversation_id: convo!.id,
        created_at: new Date().toISOString(),
      },
    ]);

    setStreaming(true);
    setStreamingSegments([{ thinking: "", content: "", toolCalls: [] }]);

    try {
      await rust.llm_chat({
        conversationId: convo!.id,
        userMessage: text,
        think: thinkEnabled,
      });
    } catch (e) {
      setStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: `⚠️ ${e}`,
          conversation_id: convo!.id,
          created_at: new Date().toISOString(),
        },
      ]);
    }
  }, [input, streaming, activeConvo, thinkEnabled]);

  const handleStop = useCallback(async () => {
    if (!activeConvo) return;
    setStreaming(false);
    setStreamingSegments([]);
    setStreamingStatus("thinking");
    try {
      await rust.cancel_llm_chat({ conversationId: activeConvo.id });
    } catch {
      // ignore
    }
    loadMessages(activeConvo.id);
  }, [activeConvo]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleModelChange(model: string | number) {
    setCurrentModel(String(model));
    try {
      await rust.set_llm_settings({ ollamaUrl, ollamaModel: String(model) });
    } catch {
      // ignore
    }
  }

  function handleToggleThink() {
    setThinkEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.CHAT_THINK, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  if (configured === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!configured) {
    return (
      <ChatSetup
        onComplete={() => {
          setConfigured(true);
        }}
      />
    );
  }

  // Collect tool calls per assistant message for display
  const toolCallsMap: Record<number, string[]> = {};
  messages.forEach((msg) => {
    if (msg.role === "assistant" && msg.tool_calls) {
      try {
        const tcs = JSON.parse(msg.tool_calls) as Array<{
          function?: { name: string };
          name?: string;
        }>;
        if (msg.id !== undefined) {
          toolCallsMap[msg.id] = tcs.map(
            (tc) => tc.function?.name || tc.name || "",
          );
        }
      } catch {
        // ignore
      }
    }
  });

  return (
    <div className="chat-container">
      {/* Conversation sidebar */}
      <div className="chat-sidebar">
        <button className="chat-new-btn" onClick={handleNewConversation}>
          <Plus className="w-4 h-4" />
          <span>{t("chat.new_conversation")}</span>
        </button>

        <div className="chat-convo-list">
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
              {t("chat.no_conversations")}
            </p>
          ) : (
            conversations.map((convo) => (
              <div
                key={convo.id}
                className={`chat-convo-item group ${
                  activeConvo?.id === convo.id ? "chat-convo-active" : ""
                }`}
                onClick={() => handleSelectConversation(convo)}
              >
                {editingTitle === convo.id ? (
                  <input
                    autoFocus
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onBlur={() => handleFinishRename(convo.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFinishRename(convo.id);
                      if (e.key === "Escape") setEditingTitle(null);
                    }}
                    className="chat-convo-rename-input"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="chat-convo-title">{convo.title}</span>
                    <div className="chat-convo-actions">
                      <button
                        onClick={(e) => handleStartRename(convo, e)}
                        title={t("chat.rename_conversation")}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(convo, e)}
                        title={t("chat.delete_conversation")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="chat-main">
        {!activeConvo && messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="bg-brand-100 dark:bg-brand-900/30 p-5 rounded-2xl mb-4">
              <Bot className="w-12 h-12 text-brand-600 dark:text-brand-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {t("nav.ai_assistant")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md text-center">
              {t("chat.welcome")}
            </p>
          </div>
        ) : (
          <div className="chat-messages">
            {messages
              .filter(
                (m) =>
                  m.role === "user" ||
                  m.role === "assistant" ||
                  m.role === "tool",
              )
              .map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  toolCalls={
                    msg.id !== undefined ? toolCallsMap[msg.id] : undefined
                  }
                />
              ))}

            {/* Streaming assistant message */}
            {streaming && (
              <div className="chat-message chat-message-assistant animate-fade-in">
                <div className="chat-avatar chat-avatar-assistant">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="chat-bubble chat-bubble-assistant">
                  {streamingSegments.map((seg, i) => {
                    const isLast = i === streamingSegments.length - 1;
                    return (
                      <div
                        key={i}
                        className={`chat-segment${i > 0 ? " chat-segment-next" : ""}`}
                      >
                        {seg.thinking && (
                          <ReasoningBlock
                            thinking={seg.thinking}
                            defaultExpanded={isLast}
                          />
                        )}
                        {seg.content ? (
                          <div className="chat-content prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {seg.content}
                            </ReactMarkdown>
                          </div>
                        ) : isLast ? (
                          <div className="chat-thinking-indicator">
                            <div className="chat-thinking-dots">
                              <span />
                              <span />
                              <span />
                            </div>
                            <span className="text-sm">
                              {t(`chat.${streamingStatus}`) ||
                                t("chat.thinking")}
                            </span>
                          </div>
                        ) : null}
                        {seg.toolCalls && seg.toolCalls.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {seg.toolCalls.map((tc, j) => (
                              <ToolCallBadge key={j} toolName={tc} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input area */}
        <div className="chat-input-area">
          {/* Input bar */}
          <div className="chat-input-bar">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.input_placeholder")}
              className="chat-input"
              rows={1}
              disabled={streaming}
            />
            {streaming ? (
              <button
                onClick={handleStop}
                className="chat-stop-btn"
                title={t("chat.stop")}
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="chat-send-btn"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toolbar */}
          <div className="chat-toolbar">
            {models.length > 0 && (
              <CustomSelect
                value={currentModel}
                onChange={handleModelChange}
                options={models.map((m) => ({ value: m.name, label: m.name }))}
                placeholder={t("chat.model")}
                fullWidth={true}
                openUpward={true}
                className="chat-model-select"
              />
            )}
            <button
              onClick={handleToggleThink}
              disabled={streaming}
              className={`chat-think-toggle ${thinkEnabled ? "chat-think-active" : ""}`}
              title={t("chat.think_tooltip")}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>{t("chat.think")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
