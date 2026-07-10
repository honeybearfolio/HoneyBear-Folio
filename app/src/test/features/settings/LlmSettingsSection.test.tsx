import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LlmSettingsSection from "../../../features/settings/LlmSettingsSection";
import { rust } from "../../../api/tauri-client";

vi.mock("../../../api/tauri-client", () => ({
  rust: {
    get_llm_settings: vi.fn(),
    set_llm_settings: vi.fn(),
    check_ollama_connection: vi.fn(),
    list_ollama_models: vi.fn(),
    delete_all_conversations: vi.fn(),
  },
}));

const mockConfirm = vi.fn();
vi.mock("../../../stores/confirm", () => ({
  useConfirm: () => mockConfirm,
}));

const mockShowToast = vi.fn();
vi.mock("../../../stores/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("../../../components/ui/CustomSelect", () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }) => (
    <select
      data-testid="model-select"
      aria-label={placeholder}
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

describe("LlmSettingsSection", () => {
  const showTooltip = vi.fn();
  const hideTooltip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rust.get_llm_settings).mockResolvedValue({
      ollama_url: "http://localhost:11434",
      ollama_model: "llama3.2",
    });
    vi.mocked(rust.set_llm_settings).mockResolvedValue(undefined);
    vi.mocked(rust.check_ollama_connection).mockResolvedValue(false);
    vi.mocked(rust.list_ollama_models).mockResolvedValue([]);
    vi.mocked(rust.delete_all_conversations).mockResolvedValue(undefined);
  });

  it("loads stored LLM settings on mount", async () => {
    vi.mocked(rust.get_llm_settings).mockResolvedValue({
      ollama_url: "http://my-server:11434",
      ollama_model: "mistral",
    });

    render(
      <LlmSettingsSection showTooltip={showTooltip} hideTooltip={hideTooltip} />,
    );

    await waitFor(() => {
      const input = screen.getByDisplayValue("http://my-server:11434");
      expect(input).toBeInTheDocument();
    });
    expect(rust.get_llm_settings).toHaveBeenCalled();
  });

  it("shows connected status and model list when test connection succeeds", async () => {
    const user = userEvent.setup();
    vi.mocked(rust.check_ollama_connection).mockResolvedValue(true);
    vi.mocked(rust.list_ollama_models).mockResolvedValue([
      { name: "llama3.2" },
      { name: "mistral" },
    ]);

    render(
      <LlmSettingsSection showTooltip={showTooltip} hideTooltip={hideTooltip} />,
    );

    await user.click(screen.getByRole("button", { name: /Test connection/i }));

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
      expect(screen.getByTestId("model-select")).toBeInTheDocument();
    });

    expect(rust.set_llm_settings).toHaveBeenCalled();
    expect(rust.check_ollama_connection).toHaveBeenCalled();
    expect(rust.list_ollama_models).toHaveBeenCalled();
  });

  it("shows not connected status when test connection fails", async () => {
    const user = userEvent.setup();
    vi.mocked(rust.check_ollama_connection).mockResolvedValue(false);

    render(
      <LlmSettingsSection showTooltip={showTooltip} hideTooltip={hideTooltip} />,
    );

    await user.click(screen.getByRole("button", { name: /Test connection/i }));

    await waitFor(() => {
      expect(screen.getByText("Not connected")).toBeInTheDocument();
    });
    expect(rust.list_ollama_models).not.toHaveBeenCalled();
  });
});
