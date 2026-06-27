import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import ChatSetup from "../../../features/chat/ChatSetup";

describe("ChatSetup", () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no prior LLM settings, connection fails
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") return Promise.resolve({});
      if (cmd === "check_ollama_connection") return Promise.resolve(false);
      if (cmd === "list_ollama_models") return Promise.resolve([]);
      if (cmd === "set_llm_settings") return Promise.resolve(null);
      return Promise.resolve(null);
    });
  });

  it("renders the setup title", () => {
    render(<ChatSetup onComplete={onComplete} />);
    expect(screen.getByText("Set up AI Assistant")).toBeInTheDocument();
  });

  it("shows the connect step URL input by default", async () => {
    render(<ChatSetup onComplete={onComplete} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("http://localhost:11434"),
      ).toBeInTheDocument();
    });
  });

  it("pre-populates URL from stored LLM settings on mount", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings")
        return Promise.resolve({ ollama_url: "http://my-server:11434" });
      if (cmd === "check_ollama_connection") return Promise.resolve(false);
      return Promise.resolve(null);
    });

    render(<ChatSetup onComplete={onComplete} />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText("http://localhost:11434");
      expect((input as HTMLInputElement).value).toBe("http://my-server:11434");
    });
  });

  it("advances to model step when connection check succeeds on mount", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") return Promise.resolve({});
      if (cmd === "check_ollama_connection") return Promise.resolve(true);
      if (cmd === "list_ollama_models")
        return Promise.resolve([{ name: "llama3.2" }]);
      if (cmd === "set_llm_settings") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<ChatSetup onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("llama3.2")).toBeInTheDocument();
    });
  });

  it("shows an error when connection test fails", async () => {
    render(<ChatSetup onComplete={onComplete} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("http://localhost:11434"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test connection"));

    await waitFor(() => {
      expect(screen.getByText(/Cannot connect to Ollama/)).toBeInTheDocument();
    });
  });

  it("shows model list on model step", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") return Promise.resolve({});
      if (cmd === "check_ollama_connection") return Promise.resolve(true);
      if (cmd === "list_ollama_models")
        return Promise.resolve([
          { name: "llama3.2", size: 2_000_000_000 },
          { name: "mistral", size: 4_000_000_000 },
        ]);
      if (cmd === "set_llm_settings") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<ChatSetup onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("llama3.2")).toBeInTheDocument();
      expect(screen.getByText("mistral")).toBeInTheDocument();
    });
  });

  it("shows no-models message when connection succeeds but no models installed", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") return Promise.resolve({});
      if (cmd === "check_ollama_connection") return Promise.resolve(true);
      if (cmd === "list_ollama_models") return Promise.resolve([]);
      if (cmd === "set_llm_settings") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<ChatSetup onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText(/No models found/)).toBeInTheDocument();
    });
  });

  it("progresses to ready step after clicking Select a model", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") return Promise.resolve({});
      if (cmd === "check_ollama_connection") return Promise.resolve(true);
      if (cmd === "list_ollama_models")
        return Promise.resolve([{ name: "llama3.2" }]);
      if (cmd === "set_llm_settings") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<ChatSetup onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("llama3.2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Select a model"));

    await waitFor(() => {
      expect(screen.getByText("Get Started")).toBeInTheDocument();
    });
  });

  it("calls onComplete when 'Get Started' is clicked", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") return Promise.resolve({});
      if (cmd === "check_ollama_connection") return Promise.resolve(true);
      if (cmd === "list_ollama_models")
        return Promise.resolve([{ name: "llama3.2" }]);
      if (cmd === "set_llm_settings") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<ChatSetup onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("llama3.2")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Select a model"));
    await waitFor(() => {
      expect(screen.getByText("Get Started")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Get Started"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });

  it("goes back from model step to connect step", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_llm_settings") return Promise.resolve({});
      if (cmd === "check_ollama_connection") return Promise.resolve(true);
      if (cmd === "list_ollama_models")
        return Promise.resolve([{ name: "llama3.2" }]);
      if (cmd === "set_llm_settings") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<ChatSetup onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("llama3.2")).toBeInTheDocument();
    });

    // The back button on the model step has "Test connection" text
    const backBtn = screen.getByText(/Test connection/);
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("http://localhost:11434"),
      ).toBeInTheDocument();
    });
  });
});
