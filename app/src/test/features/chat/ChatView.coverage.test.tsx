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

const eventHandlers = new Map<string, (event: { payload: unknown }) => void>();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    (eventName: string, handler: (event: { payload: unknown }) => void) => {
      eventHandlers.set(eventName, handler);
      return Promise.resolve(() => {
        eventHandlers.delete(eventName);
      });
    },
  ),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    onChange,
    value,
    options,
  }: {
    onChange: (v: string) => void;
    value: string;
    options: { value: string; label: string }[];
  }) => (
    <select
      data-testid="model-select"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

function makeInvokeMock({
  configured = true,
  conversations = [] as Array<{ id: string; title?: string }>,
  messages = [] as unknown[],
  models = [{ name: "llama3.2" }, { name: "mistral" }],
}: {
  configured?: boolean;
  conversations?: Array<{ id: string; title?: string }>;
  messages?: unknown[];
  models?: Array<{ name: string }>;
} = {}) {
  return vi
    .fn()
    .mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "get_llm_settings")
        return Promise.resolve(
          configured
            ? { ollama_model: "llama3.2", ollama_url: "http://localhost:11434" }
            : {},
        );
      if (cmd === "list_ollama_models") return Promise.resolve(models);
      if (cmd === "get_conversations") return Promise.resolve(conversations);
      if (cmd === "get_conversation_messages") return Promise.resolve(messages);
      if (cmd === "create_conversation")
        return Promise.resolve({ id: "conv-new", title: "New Chat" });
      if (cmd === "delete_conversation") return Promise.resolve(null);
      if (cmd === "rename_conversation") return Promise.resolve(null);
      if (cmd === "set_llm_settings") return Promise.resolve(null);
      if (cmd === "llm_chat") {
        if (
          args &&
          (args as { userMessage?: string }).userMessage === "fail me"
        ) {
          return Promise.reject(new Error("Model unavailable"));
        }
        return Promise.resolve(null);
      }
      if (cmd === "cancel_llm_chat") return Promise.resolve(null);
      return Promise.resolve(null);
    });
}

describe("ChatView coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers.clear();
    localStorage.removeItem("chat-think-enabled");
  });

  it("shows assistant error message when llm_chat fails", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [{ id: "c1", title: "Active Chat" }],
      }),
    );

    render(<ChatView />);
    await waitFor(() => screen.getByText("Active Chat"));
    fireEvent.click(screen.getByText("Active Chat"));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "fail me" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText(/Model unavailable/)).toBeInTheDocument();
    });
  });

  it("displays llm-error event as assistant message", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [{ id: "c1", title: "Stream Chat" }],
      }),
    );

    render(<ChatView />);
    await waitFor(() => screen.getByText("Stream Chat"));
    fireEvent.click(screen.getByText("Stream Chat"));

    await waitFor(() => {
      expect(eventHandlers.has("llm-error")).toBe(true);
    });

    const errorHandler = eventHandlers.get("llm-error")!;
    act(() => {
      errorHandler({
        payload: {
          conversation_id: "c1",
          error: "Connection reset",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Connection reset/)).toBeInTheDocument();
    });
  });

  it("clears messages when the active conversation is deleted", async () => {
    let conversations = [{ id: "c1", title: "To Delete" }];
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") {
        return Promise.resolve({
          ollama_model: "llama3.2",
          ollama_url: "http://localhost:11434",
        });
      }
      if (cmd === "list_ollama_models")
        return Promise.resolve([{ name: "llama3.2" }]);
      if (cmd === "get_conversations") return Promise.resolve(conversations);
      if (cmd === "get_conversation_messages") {
        return Promise.resolve([
          {
            id: 1,
            role: "user",
            content: "Hello there",
            conversation_id: "c1",
          },
        ]);
      }
      if (cmd === "delete_conversation") {
        conversations = [];
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    render(<ChatView />);
    await waitFor(() => screen.getByText("To Delete"));
    fireEvent.click(screen.getByText("To Delete"));

    await waitFor(() => {
      expect(screen.getByText("Hello there")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Delete conversation"));

    await waitFor(() => {
      expect(screen.queryByText("Hello there")).not.toBeInTheDocument();
      expect(screen.queryByText("To Delete")).not.toBeInTheDocument();
    });
  });

  it("changes model via model selector", async () => {
    vi.mocked(invoke).mockImplementation(makeInvokeMock({ configured: true }));

    render(<ChatView />);
    await waitFor(() => screen.getByTestId("model-select"));

    fireEvent.change(screen.getByTestId("model-select"), {
      target: { value: "mistral" },
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "set_llm_settings",
        expect.objectContaining({
          ollamaModel: "mistral",
          ollamaUrl: "http://localhost:11434",
        }),
      );
    });
  });

  it("renames a conversation from the sidebar", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [{ id: "c1", title: "Old Title" }],
      }),
    );

    render(<ChatView />);
    await waitFor(() => screen.getByText("Old Title"));

    fireEvent.click(screen.getByLabelText("Rename conversation"));

    const renameInput = screen.getByDisplayValue("Old Title");
    fireEvent.change(renameInput, { target: { value: "Budget Chat" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("rename_conversation", {
        conversationId: "c1",
        title: "Budget Chat",
      });
    });
  });

  it("toggles thinking mode and persists preference", async () => {
    vi.mocked(invoke).mockImplementation(makeInvokeMock({ configured: true }));

    render(<ChatView />);
    await waitFor(() => screen.getByText("Thinking"));

    fireEvent.click(screen.getByText("Thinking"));

    expect(localStorage.getItem("hb_chat_think")).toBe("true");
    expect(screen.getByText("Thinking").closest("button")!.className).toContain(
      "chat-think-active",
    );
  });

  it("renders tool role messages and expands tool output", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [{ id: "c1", title: "Tool Chat" }],
        messages: [
          {
            id: 9,
            role: "tool",
            content: '{"balance":1000}',
            tool_call_id: "get_accounts",
            conversation_id: "c1",
          },
        ],
      }),
    );

    render(<ChatView />);
    await waitFor(() => screen.getByText("Tool Chat"));
    fireEvent.click(screen.getByText("Tool Chat"));

    const toolToggle = await screen.findByText(/accounts/);
    fireEvent.click(toolToggle);

    await waitFor(() => {
      expect(screen.getByText(/"balance": 1000/)).toBeInTheDocument();
    });
  });

  it("shows streaming assistant output from llm-token events", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") {
        return Promise.resolve({
          ollama_model: "llama3.2",
          ollama_url: "http://localhost:11434",
        });
      }
      if (cmd === "list_ollama_models")
        return Promise.resolve([{ name: "llama3.2" }]);
      if (cmd === "get_conversations")
        return Promise.resolve([{ id: "c1", title: "Stream Chat" }]);
      if (cmd === "get_conversation_messages") return Promise.resolve([]);
      if (cmd === "llm_chat") {
        return new Promise(() => {});
      }
      return Promise.resolve(null);
    });

    render(<ChatView />);
    await waitFor(() => screen.getByText("Stream Chat"));
    fireEvent.click(screen.getByText("Stream Chat"));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello stream" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(eventHandlers.has("llm-token")).toBe(true);
    });

    act(() => {
      eventHandlers.get("llm-token")!({
        payload: { conversation_id: "c1", token: "Partial " },
      });
      eventHandlers.get("llm-token")!({
        payload: { conversation_id: "c1", token: "reply" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Partial reply")).toBeInTheDocument();
    });
  });

  it("stops an in-progress stream via the stop button", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") {
        return Promise.resolve({
          ollama_model: "llama3.2",
          ollama_url: "http://localhost:11434",
        });
      }
      if (cmd === "list_ollama_models")
        return Promise.resolve([{ name: "llama3.2" }]);
      if (cmd === "get_conversations")
        return Promise.resolve([{ id: "c1", title: "Stop Chat" }]);
      if (cmd === "get_conversation_messages") return Promise.resolve([]);
      if (cmd === "llm_chat") return new Promise(() => {});
      if (cmd === "cancel_llm_chat") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<ChatView />);
    await waitFor(() => screen.getByText("Stop Chat"));
    fireEvent.click(screen.getByText("Stop Chat"));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Long response" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    const stopBtn = await screen.findByLabelText("Stop generating");
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cancel_llm_chat", {
        conversationId: "c1",
      });
    });
  });

  it("renders assistant tool call badges from stored tool_calls JSON", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [{ id: "c1", title: "Tools Chat" }],
        messages: [
          {
            id: 5,
            role: "assistant",
            content: "Here is your net worth.",
            tool_calls: JSON.stringify([
              { function: { name: "get_net_worth" } },
            ]),
            conversation_id: "c1",
          },
        ],
      }),
    );

    render(<ChatView />);
    await waitFor(() => screen.getByText("Tools Chat"));
    fireEvent.click(screen.getByText("Tools Chat"));

    await waitFor(() => {
      expect(screen.getByText("Queried net worth")).toBeInTheDocument();
      expect(screen.getByText("Here is your net worth.")).toBeInTheDocument();
    });
  });

  it("expands assistant reasoning when the toggle is clicked", async () => {
    vi.mocked(invoke).mockImplementation(
      makeInvokeMock({
        configured: true,
        conversations: [{ id: "c1", title: "Reasoning Chat" }],
        messages: [
          {
            id: 7,
            role: "assistant",
            content: "Your spending is on track.",
            thinking: "Analyzing monthly totals...",
            conversation_id: "c1",
          },
        ],
      }),
    );

    render(<ChatView />);
    await waitFor(() => screen.getByText("Reasoning Chat"));
    fireEvent.click(screen.getByText("Reasoning Chat"));

    fireEvent.click(await screen.findByText("Reasoning"));

    await waitFor(() => {
      expect(
        screen.getByText("Analyzing monthly totals..."),
      ).toBeInTheDocument();
    });
  });
});
