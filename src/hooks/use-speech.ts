import { useCallback, useEffect, useRef, useState } from "react";

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
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Could not generate audio");
        }
        const blob = await res.blob();
        if (token !== tokenRef.current) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          if (token === tokenRef.current) stop();
        };
        audio.onerror = () => {
          if (token !== tokenRef.current) return;
          setError("Playback failed");
          stop();
        };
        await audio.play();
        if (token !== tokenRef.current) return;
        setState("playing");
      } catch (e) {
        if (ac.signal.aborted || (e as Error).name === "AbortError" || token !== tokenRef.current) return;
        setError((e as Error).message || "Could not generate audio");
        stop();
      }
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { id, state, error, speak, stop, clearError: () => setError(null) };
}
