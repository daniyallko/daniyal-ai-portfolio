import { useCallback, useEffect, useRef, useState } from "react";
import { prepareForSpeech } from "@/lib/speech";
import { firstClauseSplit } from "@/lib/voice-logic";

export type SpeakState = "idle" | "loading" | "playing";

/**
 * Read-aloud playback for one answer at a time.
 * Clicking the same answer again stops it; starting another answer stops the first.
 */
export function useSpeech() {
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
      a.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setId(null);
    setState("idle");
  }, []);

  const speak = useCallback(
    async (key: string, text: string) => {
      if (idRef.current === key) {
        stop();
        return;
      }
      stop();
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
      const [first, rest] = firstClauseSplit(prepareForSpeech(text));
      const fetchWav = async (part: string) => {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: part }),
          signal: ac.signal,
        });
        if (ttfbRef.current === null) { ttfbRef.current = Math.round(performance.now() - t0); setTtfbMs(ttfbRef.current); }
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
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Playback failed"));
          audio.play().then(() => {
            if (token !== tokenRef.current) return;
            if (ttfaRef.current === null) { ttfaRef.current = Math.round(performance.now() - t0); setTtfaMs(ttfaRef.current); }
            setState("playing");
          }, reject);
        });
      try {
        ttfaRef.current = null;
        ttfbRef.current = null;
        const firstP = fetchWav(first);
        const restP = rest ? fetchWav(rest) : null;
        restP?.catch(() => {});
        const a = await firstP;
        if (token !== tokenRef.current) return;
        await play(a);
        if (token !== tokenRef.current) return;
        if (restP) {
          const b = await restP;
          if (token !== tokenRef.current) return;
          await play(b);
        }
        if (token === tokenRef.current) stop();
      } catch (e) {
        if (ac.signal.aborted || (e as Error).name === "AbortError" || token !== tokenRef.current) return;
        setError((e as Error).message || "Could not generate audio");
        stop();
      }
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { id, state, error, ttfaMs, ttfbMs, speak, stop, clearError: () => setError(null) };
}
