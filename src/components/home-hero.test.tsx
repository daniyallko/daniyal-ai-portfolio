import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeHero } from "./home-hero";

const mocks = vi.hoisted(() => ({
  stop: vi.fn(),
  speak: vi.fn(),
  setPersonaId: vi.fn(),
  setLock: vi.fn(),
  typewriter: vi.fn(() => "Typed prompt"),
}));

vi.mock("@/hooks/use-speech", () => ({
  useSpeech: () => ({ id: null, state: "idle", error: null, speak: mocks.speak, stop: mocks.stop }),
}));
vi.mock("@/lib/use-typewriter", () => ({ useTypewriter: mocks.typewriter }));
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
  stop = vi.fn(() => { void this.onstop?.(); });

  constructor(readonly stream: MediaStream) {
    MockMediaRecorder.instance = this;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
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
    expect(mocks.stop.mock.invocationCallOrder[0]).toBeLessThan(onOpen.mock.invocationCallOrder[0]!);
    expect(input).toHaveValue("");
    expect(screen.getByTestId("hero-building")).toHaveAttribute("aria-hidden", "true");
  });

  it("preserves every suggestion query and live voice request", () => {
    const onOpen = vi.fn();
    render(<HomeHero onOpen={onOpen} />);
    const suggestions = [
      ["System architecture", { q: "Walk me through the architecture of AI BotKit's RAG pipeline." }],
      ["Featured projects", { q: "What are Daniyal's most impressive projects?" }],
      ["Start voice intro", { call: true }],
      ["Résumé & availability", { q: "Summarize his experience and availability for new roles." }],
    ] as const;

    for (const [label, request] of suggestions) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(onOpen).toHaveBeenLastCalledWith(request);
    }
    fireEvent.click(screen.getByRole("button", { name: "Advanced RAG" }));
    expect(onOpen).toHaveBeenLastCalledWith({ q: "Tell me about Daniyal's experience with Advanced RAG." });
    fireEvent.click(screen.getByRole("button", { name: "Talk live with Daniyal's AI" }));
    expect(onOpen).toHaveBeenLastCalledWith({ call: true });
    expect(onOpen).toHaveBeenCalledTimes(6);
  });

  it("uses a static prompt without a caret under reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("prefers-reduced-motion"), media: query })));
    const { container } = render(<HomeHero onOpen={vi.fn()} />);

    expect(mocks.typewriter).toHaveBeenCalledWith(expect.any(Array), false);
    expect(screen.getByText("Ask anything about Daniyal's AI and engineering experience…")).toBeInTheDocument();
    expect(container.querySelector(".caret")).toBeNull();
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
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop dictation" })).toBeInTheDocument());
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "transcribed question" }),
    }));
    const onOpen = vi.fn();
    render(<HomeHero onOpen={onOpen} />);
    const input = screen.getByRole("textbox", { name: "Ask about Daniyal" });
    fireEvent.change(input, { target: { value: "Existing" } });

    fireEvent.click(screen.getByRole("button", { name: "Dictate a question" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop dictation" })).toBeInTheDocument());
    const recorder = MockMediaRecorder.instance;
    expect(recorder.start).toHaveBeenCalledOnce();

    act(() => {
      recorder.ondataavailable?.({ data: new Blob([new Uint8Array(1200)], { type: "audio/webm" }) });
      fireEvent.click(screen.getByRole("button", { name: "Stop dictation" }));
    });

    await waitFor(() => expect(input).toHaveValue("Existing transcribed question"));
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("/api/transcribe", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    expect(input).toHaveFocus();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
