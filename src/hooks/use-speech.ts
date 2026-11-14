import { useCallback, useEffect, useRef, useState } from "react";
import { prepareForSpeech } from "@/lib/speech";
import { polyglotFirstClause } from "@/lib/language";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export type SpeakState = "idle" | "loading" | "playing";

/**
 * Read-aloud playback for one answer at a time.
 * Clicking the same answer again stops it; starting another answer stops the first.
 */
export type SpeechVoice = { voice: string; lang: string | null };
type Override = Partial<SpeechVoice>;

export function useSpeech(config: SpeechVoice) {
  const configRef = useRef(config);
  configRef.current = config;
  const lastRef = useRef<{ key: string; segments: string[]; override?: Override } | null>(null);
  const segRef = useRef(0);
  const [delimiter, setDelimiter] = useState<string | null>(null);
  const [swaps, setSwaps] = useState(0);
  const [id, setId] = useState<string | null>(null);
  const [state, setState] = useState<SpeakState>("idle");
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const acRef = useRef<AbortController | null>(null);
  const tokenRef = useRef(0);
  const ttfaRef = useRef<number | null>(null);
  const [ttfaMs, setTtfaMs] = useState<number | null>(null);
  const ttfbRef = useRef<number | null>(null);
  const [ttfbMs, setTtfbMs] = useState<number | null>(null);

  // One persistent element, unlocked inside the user's tap, reused for every chunk:
  // mobile browsers block play() on new Audio() created after the gesture expires.
  const getAudio = () => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  };
  const unlock = () => {
    const a = getAudio();
    a.src = SILENT_WAV;
    a.play().catch(() => {});
  };

  const stop = useCallback(() => {
    tokenRef.current += 1;
    idRef.current = null;
    acRef.current?.abort();
    acRef.current = null;
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setId(null);
    setState("idle");
  }, []);

  const speak = useCallback(
    async (
      key: string,
      text: string,
      override?: Override,
      opts: { force?: boolean; prepared?: boolean; src?: string } = {},
    ) => {
      if (idRef.current === key && !opts.force) {
        stop();
        return;
      }
      stop();
      unlock();
      setError(null);
      const token = tokenRef.current;
      idRef.current = key;
      setId(key);
      setState("loading");
      const ac = new AbortController();
      acRef.current = ac;
      const t0 = performance.now();
      // Adaptive first-clause chunking: synthesize a short opening clause and the rest in parallel,
      // so audio starts as soon as the small first chunk is ready.
      const fc = polyglotFirstClause(opts.prepared ? text : prepareForSpeech(text));
      const { first, rest } = fc;
      if (!opts.force) setDelimiter(fc.delimiter);
      lastRef.current = {
        key,
        segments: rest ? [first, rest] : [first],
        ...(override ? { override } : {}),
      };
      segRef.current = 0;
      const fetchWav = async (part: string) => {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: part,
            voice: override?.voice ?? configRef.current.voice,
            lang: override?.lang ?? configRef.current.lang,
          }),
          signal: ac.signal,
        });
        if (ttfbRef.current === null) {
          ttfbRef.current = Math.round(performance.now() - t0);
          setTtfbMs(ttfbRef.current);
        }
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Could not generate audio");
        }
        return res.blob();
      };
      const play = (blob: Blob) =>
        new Promise<void>((resolve, reject) => {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          const audio = getAudio();
          audio.src = url;
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Playback failed"));
          audio.play().then(() => {
            if (token !== tokenRef.current) return;
            if (ttfaRef.current === null) {
              ttfaRef.current = Math.round(performance.now() - t0);
              setTtfaMs(ttfaRef.current);
            }
            setState("playing");
          }, reject);
        });
      try {
        ttfaRef.current = null;
        ttfbRef.current = null;
        if (opts.src) {
          // Pre-recorded clip: play instantly; fall through to live synthesis if it fails.
          try {
            await new Promise<void>((resolve, reject) => {
              const audio = getAudio();
              audio.src = opts.src!;
              audio.onended = () => resolve();
              audio.onerror = () => reject(new Error("missing"));
              audio.play().then(() => {
                if (token === tokenRef.current) setState("playing");
              }, reject);
            });
            if (token === tokenRef.current) stop();
            return;
          } catch {
            if (token !== tokenRef.current) return;
          }
        }
        const firstP = fetchWav(first);
        const restP = rest ? fetchWav(rest) : null;
        restP?.catch(() => {});
        const a = await firstP;
        if (token !== tokenRef.current) return;
        await play(a);
        if (token !== tokenRef.current) return;
        segRef.current = 1;
        if (restP) {
          const b = await restP;
          if (token !== tokenRef.current) return;
          await play(b);
        }
        if (token === tokenRef.current) stop();
      } catch (e) {
        if (ac.signal.aborted || (e as Error).name === "AbortError" || token !== tokenRef.current)
          return;
        setError((e as Error).message || "Could not generate audio");
        stop();
      }
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  /** Voice changed mid-answer: drop queued audio and re-synthesize the unplayed clauses with the new voice. */
  const hotSwap = useCallback(() => {
    const last = lastRef.current;
    const key = idRef.current;
    if (!last || !key || last.override || key.startsWith("preview:")) return false;
    const remaining = last.segments.slice(segRef.current).join(" ");
    if (!remaining) return false;
    setSwaps((n) => n + 1);
    void speak(key, remaining, undefined, { force: true, prepared: true });
    return true;
  }, [speak]);

  return {
    id,
    state,
    error,
    ttfaMs,
    ttfbMs,
    delimiter,
    swaps,
    speak,
    stop,
    hotSwap,
    clearError: () => setError(null),
  };
}
