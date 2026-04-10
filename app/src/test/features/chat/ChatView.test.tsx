import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import ChatView from "../../../features/chat/ChatView";

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

vi.mock("../../../i18n/i18n", () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      "chat.setup.title": "Set up AI Assistant",
      "chat.setup.description": "Select an Ollama model",
      "chat.setup.step_connect": "Connect",
      "chat.setup.step_model": "Choose Model",
      "chat.setup.step_ready": "Ready",
      "chat.ollama_url": "Ollama URL",
      "chat.test_connection": "Test connection",
      "chat.connection_error": "Cannot connect to Ollama",
      "chat.model": "Model",
      "chat.setup.no_models": "No models found",
      "chat.setup.select_model": "Select a model",
      "chat.setup.get_started": "Get Started",
      "chat.setup.install_hint":
        "Don't have Ollama? Visit ollama.com to install it.",
      "chat.new_conversation": "New Chat",
      "chat.no_conversations": "No conversations yet",
      "chat.input_placeholder": "Type a message...",
      "chat.send": "Send",
      "chat.stop": "Stop generating",
      "chat.welcome": "Ask me anything about your finances",
      "chat.thinking": "Thinking...",
      "chat.reasoning": "Reasoning",
      "chat.tool_call": "Queried {tool}",
      "chat.rename_conversation": "Rename conversation",
      "chat.delete_conversation": "Delete conversation",
      "chat.think": "Thinking",
      "chat.think_tooltip": "Enable extended thinking",
      "nav.ai_assistant": "AI Assistant",
    };
    return map[key] ?? key;
  },
}));

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    onChange,
    value,
  }: {
    onChange: (v: string) => void;
    value: string;
  }) => (
    <select
      data-testid="model-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function makeInvokeMock({
  configured = true,
  conversations = [] as Array<{ id: string; title?: string }>,
  messages = [] as unknown[],
}: {
  configured?: boolean;
  conversations?: Array<{ id: string; title?: string }>;
  messages?: unknown[];
} = {}) {
  return vi.fn().mockImplementation((cmd: string) => {
    if (cmd === "get_llm_settings")
      return Promise.resolve(
        configured
          ? { ollama_model: "llama3.2", ollama_url: "http://localhost:11434" }
          : {},
      );
    if (cmd === "list_ollama_models")
      return Promise.resolve([{ name: "llama3.2" }]);
    if (cmd === "get_conversations") return Promise.resolve(conversations);
    if (cmd === "get_conversation_messages") return Promise.resolve(messages);
    if (cmd === "create_conversation")
      return Promise.resolve({ id: "conv-1", title: "New Chat" });
    if (cmd === "delete_conversation") return Promise.resolve(null);
    if (cmd === "rename_conversation") return Promise.resolve(null);
    if (cmd === "llm_chat") return Promise.resolve(null);
    if (cmd === "cancel_llm_chat") return Promise.resolve(null);
    if (cmd === "check_ollama_connection") return Promise.resolve(false);
    return Promise.resolve(null);
  });
}

describe("ChatView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state before configuration is determined", () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
    render(<ChatView />);
    // Main UI not yet visible while loading
    expect(screen.queryByText("New Chat")).not.toBeInTheDocument();
  });

  it("shows ChatSetup when no model is configured", async () => {
    vi.mocked(invoke).mockImplementation(makeInvokeMock({ configured: false }));
    render(<ChatView />);
    await waitFor(() => {
      expect(screen.getByText("Set up AI Assistant")).toBeInTheDocument();
    });
  });

  it("shows the chat UI when a model is configured", async () => {
    vi.mocked(invoke).mockImplementation(makeInvokeMock({ configured: true }));
    render(<ChatView />);
    await waitFor(() => {
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });

  it("shows the welcome message when no conversations exist", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({ configured: true, conversations: [] }),
    );
    render(<ChatView />);
    await waitFor(() => {
      expect(
        screen.getByText("Ask me anything about your finances"),
      ).toBeInTheDocument();
    });
  });

  it("lists existing conversations in the sidebar", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [
          { id: "c1", title: "Budget Review" },
          { id: "c2", title: "Investment Q&A" },
        ],
      }),
    );
    render(<ChatView />);
    await waitFor(() => {
      expect(screen.getByText("Budget Review")).toBeInTheDocument();
      expect(screen.getByText("Investment Q&A")).toBeInTheDocument();
    });
  });

  it("calls create_conversation when 'New Chat' is clicked", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({ configured: true, conversations: [] }),
    );
    render(<ChatView />);
    await waitFor(() => screen.getByText("New Chat"));
    fireEvent.click(screen.getByText("New Chat"));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("create_conversation", {
        title: "New Chat",
      });
    });
  });

  it("sends a message via llm_chat when Enter is pressed", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({ configured: true, conversations: [] }),
    );
    render(<ChatView />);
    await waitFor(() => screen.getByText("New Chat"));

    // Create a conversation to have an active one
    fireEvent.click(screen.getByText("New Chat"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "create_conversation",
        expect.any(Object),
      ),
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "How much did I spend?" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("llm_chat", expect.any(Object));
    });
  });

  it("does not call llm_chat when input is whitespace only", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({ configured: true, conversations: [] }),
    );
    render(<ChatView />);
    await waitFor(() => screen.getByText("New Chat"));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await act(async () => {});
    expect(invoke).not.toHaveBeenCalledWith("llm_chat", expect.any(Object));
  });

  it("calls get_conversation_messages when a conversation is selected", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [{ id: "c1", title: "Saved Convo" }],
        messages: [],
      }),
    );

    render(<ChatView />);
    await waitFor(() => screen.getByText("Saved Convo"));
    fireEvent.click(screen.getByText("Saved Convo"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_conversation_messages", {
        conversationId: "c1",
      });
    });
  });

  it("calls delete_conversation when the delete button is clicked", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [{ id: "c1", title: "Old Chat" }],
      }),
    );

    render(<ChatView />);
    await waitFor(() => screen.getByText("Old Chat"));

    const deleteBtn = screen.getByTitle("Delete conversation");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("delete_conversation", {
        conversationId: "c1",
      });
    });
  });
});
