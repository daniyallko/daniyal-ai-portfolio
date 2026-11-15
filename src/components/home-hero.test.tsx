import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeHero } from "./home-hero";

const mocks = vi.hoisted(() => ({
  stop: vi.fn(),
  speak: vi.fn(),
  setPersonaId: vi.fn(),
  setLock: vi.fn(),
}));

vi.mock("@/hooks/use-speech", () => ({
  useSpeech: () => ({ id: null, state: "idle", error: null, speak: mocks.speak, stop: mocks.stop }),
}));
vi.mock("@/components/axon-hero", () => ({
  AxonHero: ({ paused = false }: { paused?: boolean }) => (
    <div data-testid="axon-hero" data-paused={String(paused)} aria-hidden="true" />
  ),
}));
vi.mock("@/components/voice-switcher", () => ({
  useVoicePrefs: () => ({
    persona: { id: "daniyal", name: "Daniyal", badge: "D", ttsVoice: "voice", gender: "male" },
    setPersonaId: mocks.setPersonaId,
    lock: null,
    setLock: mocks.setLock,
  }),
  VoiceSwitcher: () => <div>Voice controls</div>,
}));

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  static instance: MockMediaRecorder;
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    void this.onstop?.();
  });

  constructor(readonly stream: MediaStream) {
    MockMediaRecorder.instance = this;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HomeHero", () => {
  it("keeps empty send disabled and submits trimmed Enter text only", () => {
    const onOpen = vi.fn();
    render(<HomeHero onOpen={onOpen} />);
    const input = screen.getByRole("textbox", { name: "Ask about Daniyal" });
    expect(screen.getByRole("button", { name: "Send question" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "  Tell me about RAG  " } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(onOpen).toHaveBeenCalledWith({ q: "Tell me about RAG" });
    expect(mocks.stop.mock.invocationCallOrder[0]).toBeLessThan(
      onOpen.mock.invocationCallOrder[0]!,
    );
    expect(input).toHaveValue("");
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("aria-hidden", "true");
  });

  it("preserves every suggestion query and live voice request", () => {
    const onOpen = vi.fn();
    render(<HomeHero onOpen={onOpen} />);
    const suggestions = [
      ["System architecture", { q: "How does AI BotKit's RAG pipeline work?" }],
      ["Best projects", { q: "What are Daniyal's best projects?" }],
      ["Start voice intro", { call: true }],
      ["Availability", { q: "Is Daniyal available immediately? What is his notice period?" }],
    ] as const;

    for (const [label, request] of suggestions) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(onOpen).toHaveBeenLastCalledWith(request);
    }
    fireEvent.click(screen.getByRole("button", { name: "Advanced RAG" }));
    expect(onOpen).toHaveBeenLastCalledWith({
      q: "Tell me about Daniyal's experience with Advanced RAG.",
    });
    fireEvent.click(screen.getByRole("button", { name: "Talk live with Daniyal's AI" }));
    expect(onOpen).toHaveBeenLastCalledWith({ call: true });
    expect(onOpen).toHaveBeenCalledTimes(6);
  });

  it("pauses the portrait while the assistant is open", () => {
    const view = render(<HomeHero onOpen={vi.fn()} assistantOpen={false} />);
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-paused", "false");

    view.rerender(<HomeHero onOpen={vi.fn()} assistantOpen={true} />);
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-paused", "true");

    view.rerender(<HomeHero onOpen={vi.fn()} assistantOpen={false} />);
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-paused", "false");
  });

  it("rotates portfolio questions only while the input is untouched", () => {
    vi.useFakeTimers();
    const { container } = render(<HomeHero onOpen={vi.fn()} />);
    const getPrompt = () => container.querySelector(".hero-prompt");
    expect(getPrompt()).not.toBeNull();
    const first = getPrompt()!.textContent;

    act(() => {
      vi.advanceTimersByTime(3600);
    });
    expect(getPrompt()?.textContent).not.toBe(first);

    const input = screen.getByRole("textbox", { name: "Ask about Daniyal" });
    fireEvent.focus(input);
    const focused = getPrompt()?.textContent;
    act(() => {
      vi.advanceTimersByTime(7200);
    });
    expect(getPrompt()?.textContent).toBe(focused);

    fireEvent.change(input, { target: { value: "My question" } });
    expect(getPrompt()).toBeNull();
  });

  it("removes the availability pill and strengthens the subheading", () => {
    render(<HomeHero onOpen={vi.fn()} />);
    expect(screen.queryByText(/Immediate joiner/)).not.toBeInTheDocument();
    expect(screen.getByText(/Full Stack AI Engineer/)).toHaveClass(
      "font-medium",
      "text-foreground",
    );
  });

  it("stops capture and detaches recorder callbacks when unmounted while recording", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const view = render(<HomeHero onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Dictate a question" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Stop dictation" })).toBeInTheDocument(),
    );
    const recorder = MockMediaRecorder.instance;

    view.unmount();

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(recorder.onstop).toBeNull();
    expect(recorder.ondataavailable).toBeNull();
  });

  it("inserts a transcription into existing text and stops microphone tracks", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: "transcribed question" }),
      }),
    );
    const onOpen = vi.fn();
    render(<HomeHero onOpen={onOpen} />);
    const input = screen.getByRole("textbox", { name: "Ask about Daniyal" });
    fireEvent.change(input, { target: { value: "Existing" } });

    fireEvent.click(screen.getByRole("button", { name: "Dictate a question" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Stop dictation" })).toBeInTheDocument(),
    );
    const recorder = MockMediaRecorder.instance;
    expect(recorder.start).toHaveBeenCalledOnce();

    act(() => {
      recorder.ondataavailable?.({
        data: new Blob([new Uint8Array(1200)], { type: "audio/webm" }),
      });
      fireEvent.click(screen.getByRole("button", { name: "Stop dictation" }));
    });

    await waitFor(() => expect(input).toHaveValue("Existing transcribed question"));
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/transcribe",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    expect(input).toHaveFocus();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the capability points above the chat box on every screen", () => {
    const { container } = render(<HomeHero onOpen={vi.fn()} />);
    const creds = container.querySelector(".hero-creds")!;
    const box = screen.getByRole("textbox", { name: "Ask about Daniyal" });

    expect(creds.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(creds).toHaveClass("order-3");
    expect(creds).not.toHaveClass("lg:order-3");
    expect(box.closest("form")).toHaveClass("order-4");
    expect(box.closest("form")).not.toHaveClass("lg:order-4");
  });

  it("backs every capability point with a translucent panel so it stays readable over the artwork", () => {
    const { container } = render(<HomeHero onOpen={vi.fn()} />);
    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".hero-creds button"),
    );

    expect(chips).toHaveLength(6);
    for (const chip of chips) {
      expect(chip).toHaveClass("bg-card/70");
      expect(chip).toHaveClass("backdrop-blur-md");
      expect(chip).toHaveClass("border-hairline");
    }
  });
});
