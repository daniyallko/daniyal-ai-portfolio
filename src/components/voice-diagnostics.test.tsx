import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelemetryPanel, VoiceOrb } from "./voice-diagnostics";
import { getPersona } from "@/config/voicePersonas";
import type { VoiceTelemetry } from "@/hooks/use-live-voice";

function telemetry(): VoiceTelemetry {
  return {
    sessionId: "session-test", turnId: 0, micRms: 0, zcr: 0, vad: "silence", silenceMs: 0,
    onsetDetectMs: null, bufferMs: 0, outRms: 0, underruns: 0, playedMs: 0,
    assistantSpeaking: false, ducked: false, bargeIns: 0, lastBargeCutMs: null,
    ttfaMs: null, connectedAt: null, lastActivity: Date.now(), maxMs: 300_000,
    idleMs: 15_000, worklet: false, micAnalyser: null, outAnalyser: null,
  };
}

function renderTelemetry() {
  return render(
    <TelemetryPanel
      telemetry={{ current: telemetry() }}
      inCall={false}
      endpointMs={600}
      prefetch={[]}
      dispatches={[]}
      llmFirstTokenMs={null}
      ragCache={null}
      ragMs={null}
      ttsTtfaMs={null}
      ttsTtfbMs={null}
      droppedPackets={0}
      persona={getPersona("lead")}
      detected={null}
      lock={null}
      bridge={null}
      delimiter={null}
      swaps={0}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DEV", true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TelemetryPanel", () => {
  it("renders no development telemetry or check controls in production", () => {
    vi.stubEnv("DEV", false);
    renderTelemetry();
    expect(screen.queryByRole("button", { name: /Telemetry/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/system check/i)).not.toBeInTheDocument();
  });

  it("closes telemetry on Escape without closing its parent surface", () => {
    renderTelemetry();
    const trigger = screen.getByRole("button", { name: /Telemetry/ });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Voice and RAG telemetry" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("retains Ctrl+Shift+D and development check suites", () => {
    renderTelemetry();
    expect(screen.getByRole("button", { name: /Telemetry/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "D", ctrlKey: true, shiftKey: true });
    expect(screen.getByRole("dialog", { name: "Voice and RAG telemetry" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Voice and RAG telemetry" }).className).toContain("bottom-52");
    expect(screen.getByRole("button", { name: "Run System Check" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Multilingual & Voice Check" })).toBeInTheDocument();
  });
});

describe("VoiceOrb", () => {
  it("draws static state feedback without a continuous animation frame under reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const context = {
      scale: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
      stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), globalAlpha: 1,
      strokeStyle: "", fillStyle: "", lineWidth: 1,
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => frames.push(callback)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(<VoiceOrb telemetry={{ current: telemetry() }} active retrievingRef={{ current: false }} />);
    expect(frames).toHaveLength(1);
    act(() => frames[0]!(0));
    expect(frames).toHaveLength(1);
    expect(screen.getByText("listening")).toBeInTheDocument();
  });
});
