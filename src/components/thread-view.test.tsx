import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ThreadView } from "./thread-view";

const mocks = vi.hoisted(() => ({
  getThread: vi.fn(),
  appendVoiceTurns: vi.fn(),
  speak: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/chat.functions", () => ({
  getThread: mocks.getThread,
  appendVoiceTurns: mocks.appendVoiceTurns,
}));
vi.mock("@/lib/visitor", () => ({ getVisitorId: () => "visitor-test" }));
vi.mock("@/components/voice-switcher", () => ({
  VoiceSwitcher: () => <div>Voice settings</div>,
  useVoicePrefs: () => ({
    persona: { id: "lead", ttsVoice: "voice", gender: "male" },
    setPersonaId: vi.fn(),
    lock: null,
    setLock: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-speech", () => ({
  useSpeech: () => ({
    id: null,
    state: "idle",
    error: null,
    speak: mocks.speak,
    stop: vi.fn(),
    hotSwap: vi.fn(),
    ttfaMs: null,
    ttfbMs: null,
    delimiter: null,
    swaps: 0,
  }),
}));
vi.mock("@/hooks/use-live-voice", () => ({
  useLiveVoice: () => ({
    status: "idle",
    error: null,
    endReason: null,
    muted: false,
    outputMuted: false,
    playbackBlocked: false,
    telemetry: { current: {} },
    audioRef: { current: null },
    start: mocks.start,
    stop: mocks.stop,
    setMuted: vi.fn(),
    setOutputMuted: vi.fn(),
    resumePlayback: vi.fn(),
  }),
}));
vi.mock("@/components/voice-diagnostics", () => ({
  TelemetryPanel: () => null,
  VoiceOrb: () => null,
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => (
    <button type="button" aria-label="Theme options">
      Theme
    </button>
  ),
}));

function renderThread(threadId = "thread-1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThreadView threadId={threadId} />
    </QueryClientProvider>,
  );
}

function thread(
  messages: { id: string; role: string; content: string; sources?: string; debug?: string }[] = [],
) {
  return { id: "thread-1", title: "Chat", messages };
}

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  mimeType = "audio/webm";
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn();

  constructor(readonly stream: MediaStream) {}
}

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("ThreadView", () => {
  it("shows an accessible initial-load failure and retries the same thread", async () => {
    mocks.getThread.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(thread());
    renderThread("thread-retry");
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load this chat/i);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { name: "Ask me about Daniyal." }),
    ).toBeInTheDocument();
    expect(mocks.getThread).toHaveBeenCalledTimes(2);
    expect(mocks.getThread).toHaveBeenNthCalledWith(1, {
      data: { visitorId: "visitor-test", threadId: "thread-retry" },
    });
    expect(mocks.getThread).toHaveBeenNthCalledWith(2, {
      data: { visitorId: "visitor-test", threadId: "thread-retry" },
    });
  });

  it("places theme controls in the shared chat header", async () => {
    mocks.getThread.mockResolvedValue(thread());
    renderThread();
    expect(await screen.findByRole("button", { name: "Theme options" })).toBeInTheDocument();
  });

  it("preserves sources → delta → done streaming and answer-only listen controls", async () => {
    mocks.getThread.mockResolvedValue(thread());
    const events = [
      {
        type: "sources",
        sources: [
          {
            n: 1,
            id: "project-atlas",
            section: "Projects",
            title: "Project Atlas",
            text: "Atlas details",
          },
        ],
        debug: { model: "test-model" },
      },
      { type: "delta", text: "Grounded " },
      { type: "delta", text: "answer [1]." },
      { type: "done", debug: { model: "test-model", timingsMs: { firstToken: 20 } } },
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        events.forEach((event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));
    const view = renderThread();
    const input = await screen.findByRole("textbox", { name: "Message Daniyal's AI" });
    fireEvent.change(input, { target: { value: "Tell me about Atlas" } });
    fireEvent.click(screen.getByRole("button", { name: /^Send$/ }));

    await screen.findByRole("button", { name: /^1$/ });
    expect(view.container.querySelector(".prose-chat")).toHaveTextContent("Grounded answer 1.");
    expect(screen.getByText("Tell me about Atlas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Project Atlas/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Listen to this answer" })).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Send$/ })).toBeInTheDocument());
    expect(screen.queryByText(/retrieving sources/)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
    vi.unstubAllGlobals();
  });

  it("disables answer read-aloud while recording a question", async () => {
    mocks.getThread.mockResolvedValue(
      thread([{ id: "answer-1", role: "assistant", content: "A grounded answer." }]),
    );
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
    renderThread();

    const listen = await screen.findByRole("button", { name: "Listen to this answer" });
    expect(listen).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Record a question" }));

    expect(await screen.findByRole("button", { name: "Stop recording" })).toBeInTheDocument();
    expect(listen).toBeDisabled();
  });
});
