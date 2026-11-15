import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpeech } from "./use-speech";

vi.mock("@/lib/speech", () => ({ prepareForSpeech: (text: string) => text }));
vi.mock("@/lib/language", () => ({
  polyglotFirstClause: () => ({ first: "First line.", rest: "Remaining answer.", delimiter: "." }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("phone read-aloud", () => {
  it("plays both clauses in the same tap-unlocked context and stops only after the last clause", async () => {
    const sources: Array<{ start: ReturnType<typeof vi.fn>; onended: (() => void) | null }> = [];
    const resume = vi.fn().mockResolvedValue(undefined);
    const construct = vi.fn();
    class Context {
      state = "running";
      sampleRate = 48000;
      destination = {};
      resume = resume;
      close = vi.fn().mockResolvedValue(undefined);
      createBuffer = vi.fn();
      decodeAudioData = vi.fn().mockResolvedValue({});
      constructor() { construct(); }
      createBufferSource() {
        const source = { buffer: null, connect: vi.fn(), disconnect: vi.fn(), stop: vi.fn(), start: vi.fn(), onended: null as (() => void) | null };
        sources.push(source);
        return source;
      }
    }
    vi.stubGlobal("AudioContext", Context);
    vi.stubGlobal("Audio", class {
      src = "";
      pause = vi.fn();
      play = vi.fn().mockResolvedValue(undefined);
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, blob: async () => ({ arrayBuffer: async () => new ArrayBuffer(16) }),
    }));
    const { result } = renderHook(() => useSpeech({ voice: "test", lang: "en" }));
    let playback: Promise<void> | undefined;
    act(() => { playback = result.current.speak("answer", "First line. Remaining answer."); });
    // Resume is invoked synchronously before any network request completes.
    expect(resume).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(sources).toHaveLength(2));
    expect(result.current.state).toBe("playing");
    act(() => sources[1]?.onended?.());
    await waitFor(() => expect(sources).toHaveLength(3));
    expect(sources[2]?.start).toHaveBeenCalledTimes(1);
    expect(construct).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("playing");
    await act(async () => { sources[2]?.onended?.(); await playback; });
    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
  });
});