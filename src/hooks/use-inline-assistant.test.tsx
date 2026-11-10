import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useInlineAssistant } from "./use-inline-assistant";
import { VoiceSwitcher } from "@/components/voice-switcher";
import { TelemetryPanel } from "@/components/voice-diagnostics";
import { getPersona } from "@/config/voicePersonas";
import type { VoiceTelemetry } from "@/hooks/use-live-voice";

const mocks = vi.hoisted(() => ({
  createThread: vi.fn(),
  listThreads: vi.fn(),
  send: vi.fn(),
  startCall: vi.fn(),
  mounts: 0,
}));

vi.mock("@/lib/chat.functions", () => ({
  createThread: mocks.createThread,
  listThreads: mocks.listThreads,
}));
vi.mock("@/lib/visitor", () => ({ getVisitorId: () => "visitor-test" }));
vi.mock("@/components/thread-view", () => ({
  ThreadView: ({ embed }: { embed: { active: boolean; onClose: () => void; controlRef: { current: unknown } } }) => {
    const [mount] = useState(() => ++mocks.mounts);
    const [inspection, setInspection] = useState(false);
    embed.controlRef.current = { send: mocks.send, startCall: mocks.startCall, ready: true };
    return <div data-testid="thread" data-mount={mount}>
      <button type="button" onClick={embed.onClose}>Inside close</button>
      <button type="button" onClick={() => setInspection(true)}>Open inspection</button>
      <button type="button">Inside action</button>
      <VoiceSwitcher persona={getPersona("lead")} onPersona={() => {}} lock={null} onLock={() => {}} detected={null} previewing={null} previewState="idle" onPreview={() => {}} />
      <TelemetryPanel
        telemetry={{ current: { sessionId: "qa", turnId: 0, micRms: 0, zcr: 0, vad: "silence", silenceMs: 0, onsetDetectMs: null, bufferMs: 0, outRms: 0, underruns: 0, playedMs: 0, assistantSpeaking: false, ducked: false, bargeIns: 0, lastBargeCutMs: null, ttfaMs: null, connectedAt: null, lastActivity: 0, maxMs: 300_000, idleMs: 15_000, worklet: false, micAnalyser: null, outAnalyser: null } satisfies VoiceTelemetry }}
        inCall={false} endpointMs={600} prefetch={[]} dispatches={[]} llmFirstTokenMs={null} ragCache={null} ragMs={null}
        ttsTtfaMs={null} ttsTtfbMs={null} droppedPackets={0} persona={getPersona("lead")} detected={null} lock={null} bridge={null} delimiter={null} swaps={0}
      />
      {inspection && <aside
        role="dialog"
        aria-label="Answer inspection"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setInspection(false);
          }
        }}
      ><button type="button">Close inspection</button></aside>}
    </div>;
  },
}));

function Host({ theme = "dark" }: { theme?: string }) {
  const assistant = useInlineAssistant();
  return <div data-theme={theme}>
    <div data-testid="shell" inert={assistant.open ? true : undefined} aria-hidden={assistant.open || undefined}>
      <button type="button" onClick={() => assistant.go()}>Open empty</button>
      <button type="button" onClick={() => assistant.go({ q: "Architecture" })}>Open message</button>
      <button type="button" onClick={() => assistant.go({ q: "Projects" })}>Open projects</button>
      <button type="button" onClick={() => assistant.go({ call: true })}>Open voice</button>
    </div>
    {assistant.node}
  </div>;
}

async function openReadyThread() {
  mocks.createThread.mockResolvedValue({ id: "thread-1" });
  render(<Host />);
  fireEvent.click(screen.getByRole("button", { name: "Open empty" }));
  await screen.findByTestId("thread");
  fireEvent.click(screen.getByRole("button", { name: "Inside close" }));
  await waitFor(() => expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("data-open", "false"));
  mocks.send.mockClear();
  mocks.startCall.mockClear();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mounts = 0;
  mocks.listThreads.mockResolvedValue([]);
  mocks.createThread.mockResolvedValue({ id: "thread-1" });
  document.body.style.overflow = "";
  document.body.innerHTML = "";
});

describe("useInlineAssistant", () => {
  it("adopts an existing thread before considering creation during rapid entry", async () => {
    let resolveList!: (threads: { id: string }[]) => void;
    mocks.listThreads.mockReturnValue(new Promise<{ id: string }[]>((resolve) => { resolveList = resolve; }));
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Open message" }));
    fireEvent.click(screen.getByText("Open projects"));
    expect(mocks.createThread).not.toHaveBeenCalled();

    resolveList([{ id: "existing-thread" }]);
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith("Projects"));
    expect(mocks.createThread).not.toHaveBeenCalled();
    expect(mocks.listThreads).toHaveBeenCalledOnce();
  });

  it("creates only after the shared lookup completes empty", async () => {
    let resolveList!: (threads: { id: string }[]) => void;
    mocks.listThreads.mockReturnValue(new Promise<{ id: string }[]>((resolve) => { resolveList = resolve; }));
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Open message" }));
    fireEvent.click(screen.getByText("Open projects"));
    expect(mocks.createThread).not.toHaveBeenCalled();

    resolveList([]);
    await waitFor(() => expect(mocks.createThread).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith("Projects"));
    expect(mocks.createThread).toHaveBeenCalledOnce();
  });

  it("dispatches ready requests synchronously and records all entry modes", async () => {
    await openReadyThread();
    fireEvent.click(screen.getByRole("button", { name: "Open message" }));
    expect(mocks.send).toHaveBeenCalledWith("Architecture");
    expect(screen.getByRole("dialog")).toHaveAttribute("data-entry", "message");
    fireEvent.click(screen.getByRole("button", { name: "Inside close" }));
    fireEvent.click(screen.getByRole("button", { name: "Open voice" }));
    expect(mocks.startCall).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-entry", "voice");
    fireEvent.click(screen.getByRole("button", { name: "Inside close" }));
    fireEvent.click(screen.getByRole("button", { name: "Open empty" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-entry", "empty");
  });

  it("shares rapid creation and hands off only the latest request once", async () => {
    let resolve!: (thread: { id: string }) => void;
    mocks.createThread.mockReturnValue(new Promise<{ id: string }>((r) => { resolve = r; }));
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Open message" }));
    fireEvent.click(screen.getByText("Open projects"));
    await waitFor(() => expect(mocks.createThread).toHaveBeenCalledOnce());
    resolve({ id: "thread-shared" });
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith("Projects"));
    await new Promise((r) => setTimeout(r, 80));
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it("retains a failed request for Retry and supports Close", async () => {
    mocks.createThread.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ id: "thread-retry" });
    render(<Host />);
    const trigger = screen.getByRole("button", { name: "Open message" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't open the assistant/i);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith("Architecture"));
    fireEvent.click(screen.getByRole("button", { name: "Inside close" }));
    expect(trigger).toHaveFocus();
  });

  it("keeps the same thread instance across close, reopen, and theme changes", async () => {
    mocks.createThread.mockResolvedValue({ id: "thread-stable" });
    const view = render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Open empty" }));
    const thread = await screen.findByTestId("thread");
    const mount = thread.dataset["mount"];
    fireEvent.click(screen.getByRole("button", { name: "Inside close" }));
    expect(screen.getByTestId("thread")).toBe(thread);
    view.rerender(<Host theme="light" />);
    fireEvent.click(screen.getByRole("button", { name: "Open empty" }));
    expect(screen.getByTestId("thread")).toBe(thread);
    expect(screen.getByTestId("thread")).toHaveAttribute("data-mount", mount!);
    expect(mocks.mounts).toBe(1);
  });

  it("closes only the voice popover when Escape originates on its trigger", async () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Open empty" }));
    await screen.findByTestId("thread");
    const trigger = screen.getByRole("button", { name: /^Voice and language:/ });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Voice and language" })).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Voice and language" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Daniyal's AI assistant" })).toHaveAttribute("data-open", "true");
    expect(trigger).toHaveFocus();
  });

  it("closes only telemetry on nested Escape", async () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Open empty" }));
    await screen.findByTestId("thread");
    fireEvent.click(screen.getByRole("button", { name: /Telemetry/ }));
    const telemetry = screen.getByRole("dialog", { name: "Voice and RAG telemetry" });
    const close = screen.getByRole("button", { name: "Close telemetry" });
    close.focus();

    fireEvent.keyDown(close, { key: "Escape" });

    expect(telemetry).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Daniyal's AI assistant" })).toHaveAttribute("data-open", "true");
  });

  it("closes only the nested inspector on Escape", async () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Open empty" }));
    await screen.findByTestId("thread");
    fireEvent.click(screen.getByRole("button", { name: "Open inspection" }));
    const inspector = screen.getByRole("dialog", { name: "Answer inspection" });
    fireEvent.keyDown(inspector, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Answer inspection" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Daniyal's AI assistant" })).toHaveAttribute("data-open", "true");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("leaves nested Escape for the inspector even when it unmounts first", async () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Open empty" }));
    await screen.findByTestId("thread");
    fireEvent.click(screen.getByRole("button", { name: "Open inspection" }));
    const inspector = screen.getByRole("dialog", { name: "Answer inspection" });
    inspector.remove();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    Object.defineProperty(event, "target", { value: inspector });
    fireEvent(document, event);

    expect(screen.getByRole("dialog", { name: "Daniyal's AI assistant" })).toHaveAttribute("data-open", "true");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("makes the background inert, restores overflow, traps Tab, and closes on Escape", async () => {
    document.body.style.overflow = "scroll";
    await openReadyThread();
    const trigger = screen.getByRole("button", { name: "Open message" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByTestId("shell")).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    const dialog = screen.getByRole("dialog");
    const last = screen.getByRole("button", { name: /Telemetry/ });
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Inside close" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(document.body.style.overflow).toBe("scroll");
    expect(trigger).toHaveFocus();
    expect(screen.getByTestId("shell")).not.toHaveAttribute("inert");
  });
});
