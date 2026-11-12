import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Square,
  ArrowLeft,
  Mic,
  AudioLines,
  PhoneOff,
  MicOff,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AssistantMessage } from "@/components/chat-message";
import { InspectPanel } from "@/components/chat-inspector";
import type { Debug, Msg, Source } from "@/components/chat-types";
import { useSpeech } from "@/hooks/use-speech";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { appendVoiceTurns, getThread } from "@/lib/chat.functions";
import {
  actionHref,
  actionLabel,
  detectActions,
  endpointSilenceMs,
  normalizeQueryKey,
  truncateToPlayed,
} from "@/lib/voice-logic";
import {
  TelemetryPanel,
  VoiceOrb,
  type Dispatch,
  type PrefetchLog,
} from "@/components/voice-diagnostics";
import { getVisitorId } from "@/lib/visitor";
import { VoiceSwitcher, useVoicePrefs } from "@/components/voice-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { detectLanguage, previewLine, type DetectedLanguage } from "@/lib/language";
import { browserCache, rememberBrowser } from "@/lib/rag-browser";
import { answerKey, fingerprint, retrievalKey, type CacheEntry } from "@/lib/rag-cache";
import { CHAT_MODEL, CHAT_SYSTEM } from "@/lib/prompt";

const SUGGESTIONS = [
  "What RAG systems has Daniyal built in production?",
  "Is he open to relocating to the UAE?",
  "Summarize his experience with LangGraph and agents.",
  "What's his biggest infrastructure achievement?",
];

export type ThreadControl = { send: (q: string) => void; startCall: () => void; ready: boolean };
export type EmbedOptions = {
  active: boolean;
  onClose: () => void;
  controlRef: { current: ThreadControl | null };
};

export function ThreadView({ threadId, embed }: { threadId: string; embed?: EmbedOptions }) {
  const visitorId = getVisitorId();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming">("idle");
  const [panel, setPanel] = useState<{
    msgId: string;
    tab: "sources" | "dev";
    focus?: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const captionsRef = useRef<HTMLDivElement>(null);
  const [rec, setRec] = useState<"idle" | "recording" | "transcribing">("idle");
  const [recError, setRecError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const prefs = useVoicePrefs();
  const [detected, setDetected] = useState<DetectedLanguage | null>(null);
  const activeLang = prefs.lock ?? detected?.code ?? null;
  const speech = useSpeech({ voice: prefs.persona.ttsVoice, lang: activeLang });
  const noteLanguage = (text: string, hint?: string | null) => {
    if (text.trim().length >= 3) setDetected(detectLanguage(text, hint));
  };
  type Caption = { role: "user" | "assistant"; text: string; turn: number; interrupted?: boolean };
  const [captions, setCaptions] = useState<Caption[]>([]);
  const turnsRef = useRef<Caption[]>([]); // full call transcript, persisted on hang-up
  const turnRef = useRef(0);
  const dropAssistantRef = useRef(false);
  const pendingBargeRef = useRef<number | null>(null);
  const [droppedPackets, setDroppedPackets] = useState(0);
  const capStartPlayedRef = useRef(0);
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPrefetchKey = useRef("");
  const retrievingRef = useRef(false);
  const [prefetchLog, setPrefetchLog] = useState<PrefetchLog[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [endpointMs, setEndpointMs] = useState(700);
  const dispatch = (text: string, source: Dispatch["source"]) => {
    const acts = detectActions(text);
    if (acts.length)
      setDispatches((d) =>
        [
          ...d,
          ...acts.map((action) => ({ at: Date.now(), source, action, href: actionHref(action) })),
        ].slice(-8),
      );
  };
  const updateCaptions = (fn: (c: Caption[]) => Caption[]) => {
    turnsRef.current = fn(turnsRef.current);
    setCaptions(turnsRef.current.slice(-6));
  };
  const prefetch = (text: string) => {
    clearTimeout(prefetchTimer.current);
    setEndpointMs(endpointSilenceMs(text));
    if (text.trim().split(/\s+/).length <= 4 && !/[\u3040-\u30FF\u4E00-\u9FFF]{6}/.test(text))
      return;
    prefetchTimer.current = setTimeout(async () => {
      const key = normalizeQueryKey(text);
      if (!key || key === lastPrefetchKey.current) return;
      lastPrefetchKey.current = key;
      if (browserCache(retrievalKey(text))) {
        setPrefetchLog((l) => [...l, { query: text, cache: "L1", ms: 0 }].slice(-20));
        return;
      }
      retrievingRef.current = true;
      try {
        const r = await fetch("/api/prefetch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: text }),
        });
        const j = (await r.json()) as { cache?: string; ms?: number; entry?: CacheEntry | null };
        if (j.entry) rememberBrowser([j.entry]);
        if (r.ok)
          setPrefetchLog((l) =>
            [...l, { query: text, cache: j.cache ?? "miss", ms: j.ms ?? 0 }].slice(-20),
          );
      } catch {
        /* speculative only */
      } finally {
        retrievingRef.current = false;
      }
    }, 250);
  };
  useEffect(() => {
    if (input.trim()) prefetch(input);
    return () => clearTimeout(prefetchTimer.current);
  }, [input]);
  const voice = useLiveVoice({
    url: `/api/live?voice=${prefs.persona.id}${prefs.lock ? `&lang=${prefs.lock}` : ""}`,
    onEvent: (ev: LiveEvent) => {
      if (ev.type === "app.barge_in") {
        // Audio is already flushed locally; confirm the interruption once the user's words arrive.
        pendingBargeRef.current = Number(ev["playedMs"] ?? 0) - capStartPlayedRef.current;
        return;
      }
      const isIn = ev.type === "session.input_transcript.delta";
      const isOut = ev.type === "session.output_transcript.delta";
      if (!isIn && !isOut) return;
      const delta = typeof ev["delta"] === "string" ? (ev["delta"] as string) : "";
      if (!delta) return;
      if (isIn) {
        if (pendingBargeRef.current !== null) {
          const played = pendingBargeRef.current;
          pendingBargeRef.current = null;
          dropAssistantRef.current = true; // zombie tokens of the interrupted turn are dropped
          updateCaptions((c) => {
            const l = c[c.length - 1];
            if (!l || l.role !== "assistant") return c;
            return [
              ...c.slice(0, -1),
              { ...l, text: truncateToPlayed(l.text, played), interrupted: true },
            ];
          });
        }
        const last = turnsRef.current[turnsRef.current.length - 1];
        if (!last || last.role !== "user") turnRef.current += 1;
        const turn = turnRef.current;
        updateCaptions((c) => {
          const l = c[c.length - 1];
          if (l && l.role === "user") return [...c.slice(0, -1), { ...l, text: l.text + delta }];
          return [...c, { role: "user", text: delta, turn }];
        });
        noteLanguage(turnsRef.current[turnsRef.current.length - 1]!.text);
        prefetch(turnsRef.current[turnsRef.current.length - 1]!.text);
        return;
      }
      if (dropAssistantRef.current) {
        const t = voice.telemetry.current;
        if (t.vad === "silence" && t.silenceMs > 300)
          dropAssistantRef.current = false; // user finished: new turn
        else {
          setDroppedPackets((n) => n + 1);
          return;
        }
      }
      const last = turnsRef.current[turnsRef.current.length - 1];
      if (!last || last.role !== "assistant") {
        capStartPlayedRef.current = voice.telemetry.current.playedMs;
        if (last?.role === "user") dispatch(last.text, "voice"); // sync tool dispatch with audio onset
      }
      const turn = turnRef.current;
      updateCaptions((c) => {
        const l = c[c.length - 1];
        if (l && l.role === "assistant" && l.turn === turn && !l.interrupted)
          return [...c.slice(0, -1), { ...l, text: l.text + delta }];
        return [...c, { role: "assistant", text: delta, turn }];
      });
    },
  });
  const inCall =
    voice.status === "connecting" || voice.status === "connected" || voice.status === "stopping";

  // Persist the voice call into this thread once it ends, then show it in the history.
  useEffect(() => {
    if (voice.status !== "closed") return;
    const turns = turnsRef.current
      .filter((t) => t.text.trim())
      .map((t) => ({
        role: t.role,
        content: t.interrupted ? `${t.text.trim()} — (interrupted)` : t.text.trim(),
      }));
    turnsRef.current = [];
    if (!turns.length) return;
    void appendVoiceTurns({ data: { visitorId, threadId, turns } })
      .then(async () => {
        const t = await getThread({ data: { visitorId, threadId } });
        if (t)
          setMessages(
            t.messages.map((m) => ({
              id: m.id,
              role: m.role as Msg["role"],
              content: m.content,
              sources: m.sources ? (JSON.parse(m.sources) as Source[]) : undefined,
              debug: m.debug ? (JSON.parse(m.debug) as Debug) : undefined,
            })),
          );
        qc.invalidateQueries({ queryKey: ["threads"] });
      })
      .catch(() => {});
  }, [voice.status, visitorId, threadId, qc]);

  // Mid-call voice swap: the provider fixes the voice per session, so reconnect right after the transcript is saved.
  const restartRef = useRef(false);
  useEffect(() => {
    if (voice.status === "closed" && restartRef.current) {
      restartRef.current = false;
      voice.start();
    }
  }, [voice.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const choosePersona = (id: string) => {
    if (id === prefs.persona.id) return;
    prefs.setPersonaId(id);
    // Let the new voice settle into the speech hook before re-synthesizing the unplayed clauses.
    setTimeout(() => speech.hotSwap(), 0);
    if (inCall) {
      restartRef.current = true;
      voice.stop();
    }
  };
  const lastDebug = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.debug?.timingsMs)?.debug;
  const startCall = () => {
    speech.stop();
    turnsRef.current = [];
    setCaptions([]);
    turnRef.current = 0;
    dropAssistantRef.current = false;
    pendingBargeRef.current = null;
    voice.start();
  };

  const loadThread = useCallback(() => {
    setLoaded("loading");
    getThread({ data: { visitorId, threadId } })
      .then((t) => {
        if (!t) return setLoaded("missing");
        setMessages(
          t.messages.map((m) => ({
            id: m.id,
            role: m.role as Msg["role"],
            content: m.content,
            sources: m.sources ? (JSON.parse(m.sources) as Source[]) : undefined,
            debug: m.debug ? (JSON.parse(m.debug) as Debug) : undefined,
          })),
        );
        setLoaded("ok");
      })
      .catch(() => setLoaded("error"));
  }, [threadId, visitorId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Hand-off from the homepage command dock: send its question or start a live call once.
  const pendingDone = useRef(false);
  useEffect(() => {
    if (embed || loaded !== "ok" || pendingDone.current) return;
    pendingDone.current = true;
    const raw = sessionStorage.getItem("daniyal.pending.v1");
    if (!raw) return;
    sessionStorage.removeItem("daniyal.pending.v1");
    try {
      const p = JSON.parse(raw) as { q?: string; call?: boolean };
      if (p.call) startCall();
      else if (p.q) void send(p.q);
    } catch {
      /* ignore */
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    else endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);
  useEffect(() => {
    const el = captionsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [captions]);
  useEffect(() => {
    if (status === "idle" && (!embed || embed.active)) taRef.current?.focus();
  }, [status, loaded, embed?.active]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || status !== "idle") return;
    speech.stop();
    noteLanguage(message);
    setInput("");
    const aid = crypto.randomUUID();
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: message }]);
    dispatch(message, "text");
    setStatus("submitted");
    const ac = new AbortController();
    abortRef.current = ac;
    const patch = (fn: (m: Msg) => Msg) =>
      setMessages((ms) => ms.map((m) => (m.id === aid ? fn(m) : m)));
    try {
      const local = browserCache(
        answerKey(message, fingerprint(CHAT_MODEL + CHAT_SYSTEM), prefs.lock ?? undefined),
      );
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId,
          visitorId,
          message,
          ...(local ? { cachedKey: local.key } : {}),
          ...(prefs.lock ? { lang: prefs.lock } : {}),
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      setMessages((m) => [...m, { id: aid, role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "sources") patch((m) => ({ ...m, sources: ev.sources, debug: ev.debug }));
          else if (ev.type === "delta") {
            setStatus("streaming");
            patch((m) => ({ ...m, content: m.content + ev.text }));
          } else if (ev.type === "done") {
            patch((m) => ({ ...m, debug: ev.debug }));
            if (ev.cacheEntry) rememberBrowser([ev.cacheEntry]);
          } else if (ev.type === "error") patch((m) => ({ ...m, error: ev.message }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((m) =>
          m.some((x) => x.id === aid)
            ? m.map((x) => (x.id === aid ? { ...x, error: (e as Error).message } : x))
            : [...m, { id: aid, role: "assistant", content: "", error: (e as Error).message }],
        );
      }
    } finally {
      setStatus("idle");
      abortRef.current = null;
      qc.invalidateQueries({ queryKey: ["threads"] });
    }
  };

  if (embed)
    embed.controlRef.current = { send: (q) => void send(q), startCall, ready: loaded === "ok" };

  const toggleRecord = async () => {
    setRecError(null);
    if (rec === "recording") {
      recorderRef.current?.stop();
      return;
    }
    if (rec !== "idle" || status !== "idle") return;
    speech.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 24000,
        },
      });
      const mime =
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
          MediaRecorder.isTypeSupported(t),
        ) ?? "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const parts: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(parts, { type });
        if (blob.size < 1000) {
          setRec("idle");
          setRecError("That recording was too short.");
          return;
        }
        setRec("transcribing");
        try {
          const fd = new FormData();
          fd.append(
            "file",
            new File([blob], type.includes("mp4") ? "question.mp4" : "question.webm", { type }),
          );
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          const j = (await res.json()) as {
            text?: string;
            error?: string;
            language?: string | null;
          };
          if (!res.ok) throw new Error(j.error ?? "Transcription failed");
          if (!j.text) throw new Error("I couldn't hear a question. Try again.");
          setRec("idle");
          noteLanguage(j.text, j.language);
          void send(j.text);
        } catch (e) {
          setRec("idle");
          setRecError((e as Error).message);
        }
      };
      recorderRef.current = mr;
      mr.start();
      setRec("recording");
    } catch {
      setRecError("Microphone access was blocked.");
    }
  };

  useEffect(
    () => () => {
      const mr = recorderRef.current;
      if (mr && mr.state !== "inactive") {
        mr.onstop = null;
        mr.stop();
        mr.stream.getTracks().forEach((t) => t.stop());
      }
    },
    [],
  );

  if (loaded === "error")
    return (
      <div className="assistant-boot" role="alert">
        <span className="assistant-boot__mark" aria-hidden>
          d
        </span>
        <h1 className="text-xl font-semibold">Chat unavailable</h1>
        <p>Couldn't load this chat. Check your connection and try again.</p>
        <div className="flex gap-2">
          <button type="button" className="assistant-boot__primary" onClick={loadThread}>
            Retry
          </button>
          {embed && (
            <button type="button" onClick={embed.onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    );

  if (loaded === "missing")
    return (
      <div className="assistant-boot">
        <span className="assistant-boot__mark" aria-hidden="true">
          d
        </span>
        <h1 className="text-xl font-semibold text-foreground">Conversation not found</h1>
        <p>This chat doesn't exist in this browser.</p>
        <Link
          to="/chat"
          className="assistant-boot__primary inline-flex min-h-11 items-center rounded-full px-5"
        >
          Start a new one
        </Link>
      </div>
    );

  const active = panel ? messages.find((m) => m.id === panel.msgId) : undefined;

  return (
    <div className="chat-surface flex h-full min-h-0 bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top relative z-10 flex min-h-[72px] shrink-0 items-center gap-2 border-b border-hairline bg-background/90 px-3 py-3 backdrop-blur-xl sm:gap-3 sm:px-6">
          {embed ? (
            <button
              type="button"
              onClick={embed.onClose}
              aria-label="Back to portfolio"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hairline text-muted-foreground transition-colors hover:border-signal hover:text-signal"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <Link
              to="/"
              aria-label="Back to portfolio"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hairline text-muted-foreground transition-colors hover:border-signal hover:text-signal md:hidden"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-signal/40 bg-accent font-serif text-xl italic text-signal"
            aria-hidden="true"
          >
            d
          </div>
          <div className={`min-w-0 ${embed ? "hidden min-[420px]:block" : "hidden xl:block"}`}>
            <p className="truncate text-sm font-semibold tracking-[-0.01em]">
              daniyal.ai{" "}
              <span className="ml-1 font-mono text-[9px] font-normal uppercase tracking-[0.16em] text-signal">
                live index
              </span>
            </p>
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground sm:block">
              Hybrid RAG · every claim has a source
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <VoiceSwitcher
              persona={prefs.persona}
              onPersona={choosePersona}
              lock={prefs.lock}
              onLock={prefs.setLock}
              detected={detected}
              previewing={speech.id}
              previewState={speech.state}
              onPreview={(p) => {
                if (!inCall)
                  void speech.speak(
                    `preview:${p.id}`,
                    previewLine(activeLang ?? "en", p.gender === "female"),
                    { voice: p.ttsVoice, lang: activeLang ?? "en" },
                    { src: `/voice-previews/${p.id}-${activeLang ?? "en"}.mp3` },
                  );
              }}
            />
          </div>
        </header>

        <div ref={scrollRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-7 sm:px-6 sm:py-10">
            {loaded === "ok" && messages.length === 0 && (
              <section className="chat-empty pt-6 sm:pt-12" aria-labelledby="empty-chat-title">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
                  Portfolio intelligence / 001
                </p>
                <h1
                  id="empty-chat-title"
                  className="mt-4 max-w-xl font-serif text-5xl leading-[0.98] tracking-[-0.04em] sm:text-6xl"
                >
                  Ask me about <em className="text-signal">Daniyal.</em>
                </h1>
                <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
                  Answers come from his portfolio only. Follow the evidence, inspect the retrieval,
                  or start a voice conversation.
                </p>
                <div className="mt-8 grid gap-px overflow-hidden border border-hairline bg-hairline sm:grid-cols-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => send(s)}
                      className="group min-h-24 bg-card p-4 text-left transition-colors hover:bg-accent sm:p-5"
                    >
                      <span className="mb-3 block font-mono text-[10px] text-signal">0{i + 1}</span>
                      <span className="block text-sm leading-relaxed text-foreground/85 transition-colors group-hover:text-foreground">
                        {s}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="chat-message-in flex justify-end pl-10 sm:pl-20">
                  <div
                    className="max-w-[42rem] border-r-2 border-signal bg-secondary px-4 py-3 text-[15px] leading-relaxed text-secondary-foreground sm:px-5"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                      You
                    </span>
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="chat-message-in border-l border-hairline pl-4 sm:pl-6">
                  <AssistantMessage
                    m={m}
                    onCite={(n) => setPanel({ msgId: m.id, tab: "sources", focus: n })}
                    onDev={() => setPanel({ msgId: m.id, tab: "dev" })}
                    onSpeak={() => speech.speak(m.id, m.content)}
                    speakState={speech.id === m.id ? speech.state : "idle"}
                    speakDisabled={
                      inCall ||
                      rec !== "idle" ||
                      (status !== "idle" && m.id === messages[messages.length - 1]?.id)
                    }
                  />
                </div>
              ),
            )}
            {status === "submitted" && (
              <div
                role="status"
                className="flex items-center gap-3 border-l border-signal/50 pl-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:pl-6"
              >
                <span className="signal-pulse inline-block h-4 w-1 bg-signal" /> retrieving sources
                <span className="signal-ellipsis" aria-hidden="true">
                  …
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="composer-dock safe-bottom relative mx-auto w-full max-w-3xl shrink-0 px-3 pb-3 sm:px-6 sm:pb-6"
        >
          <audio ref={voice.audioRef} className="hidden" />
          <TelemetryPanel
            telemetry={voice.telemetry}
            inCall={inCall}
            endpointMs={endpointMs}
            prefetch={prefetchLog}
            dispatches={dispatches}
            llmFirstTokenMs={
              (lastDebug?.timingsMs?.["firstToken"] as number | null | undefined) ?? null
            }
            ragCache={lastDebug?.cache ?? null}
            ragMs={
              lastDebug?.timingsMs
                ? Number(lastDebug.timingsMs["embed"] ?? 0) +
                  Number(lastDebug.timingsMs["retrieve"] ?? 0)
                : null
            }
            ttsTtfaMs={speech.ttfaMs}
            ttsTtfbMs={speech.ttfbMs}
            droppedPackets={droppedPackets}
            persona={prefs.persona}
            detected={detected}
            lock={prefs.lock}
            bridge={
              lastDebug?.bridge
                ? {
                    ...lastDebug.bridge,
                    matched: (lastDebug.candidates ?? []).filter((c) => c.kept).map((c) => c.title),
                  }
                : null
            }
            delimiter={speech.delimiter}
            swaps={speech.swaps}
          />
          {!inCall && voice.endReason && (
            <div
              role="status"
              className="mb-3 flex flex-wrap items-center gap-3 border border-hairline bg-card px-4 py-3 font-mono text-[11px]"
            >
              <span className="text-muted-foreground">
                {voice.endReason === "idle"
                  ? "Call paused after 15s of silence."
                  : "5-minute voice limit reached."}
              </span>
              <button
                type="button"
                onClick={startCall}
                className="ml-auto min-h-11 rounded-full border border-signal px-4 text-signal transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                resume call
              </button>
            </div>
          )}
          {(inCall || voice.error) && (
            <div className="voice-console mb-3 overflow-hidden border border-signal/35 bg-card shadow-[0_18px_70px_-40px_var(--signal)]">
              <div className="h-0.5 bg-gradient-to-r from-signal via-signal/30 to-transparent" />
              <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center sm:p-4">
                {inCall && (
                  <div className="flex shrink-0 justify-center">
                    <VoiceOrb
                      telemetry={voice.telemetry}
                      active={voice.status === "connected"}
                      retrievingRef={retrievingRef}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${voice.status === "connected" ? "animate-pulse bg-signal motion-reduce:animate-none" : "bg-muted-foreground"}`}
                      aria-hidden="true"
                    />
                    <span
                      role="status"
                      className="max-w-full leading-relaxed text-muted-foreground"
                    >
                      {voice.status === "connected"
                        ? voice.muted
                          ? "voice call · muted"
                          : "voice call · listening — interrupt anytime"
                        : voice.status === "connecting"
                          ? "connecting voice…"
                          : voice.status === "stopping"
                            ? "ending call…"
                            : "voice call ended"}
                    </span>
                    <div className="flex w-full flex-wrap items-center gap-2 pt-1 min-[420px]:ml-auto min-[420px]:w-auto min-[420px]:pt-0">
                      {voice.status === "connected" && (
                        <button
                          type="button"
                          onClick={() => voice.setMuted(!voice.muted)}
                          aria-pressed={voice.muted}
                          className="flex min-h-11 items-center gap-1.5 rounded-full border border-hairline px-3 text-muted-foreground transition-colors hover:border-signal hover:text-foreground"
                        >
                          {voice.muted ? (
                            <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {voice.muted ? "unmute" : "mute"}
                        </button>
                      )}
                      {voice.status === "connected" && (
                        <button
                          type="button"
                          onClick={() => voice.setOutputMuted(!voice.outputMuted)}
                          aria-pressed={voice.outputMuted}
                          className="flex min-h-11 items-center gap-1.5 rounded-full border border-hairline px-3 text-muted-foreground transition-colors hover:border-signal hover:text-foreground"
                        >
                          {voice.outputMuted ? (
                            <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {voice.outputMuted ? "voice off" : "voice on"}
                        </button>
                      )}
                      {inCall && (
                        <button
                          type="button"
                          onClick={voice.stop}
                          disabled={voice.status === "stopping"}
                          className="flex min-h-11 items-center gap-1.5 rounded-full bg-destructive px-3 text-destructive-foreground disabled:opacity-50"
                        >
                          <PhoneOff className="h-3.5 w-3.5" aria-hidden="true" />
                          end
                        </button>
                      )}
                    </div>
                  </div>
                  {voice.playbackBlocked && (
                    <button
                      type="button"
                      onClick={voice.resumePlayback}
                      className="mt-3 min-h-11 w-full bg-primary px-4 text-xs font-semibold text-primary-foreground min-[420px]:w-auto"
                    >
                      Tap to hear the assistant
                    </button>
                  )}
                  {voice.error && (
                    <p role="alert" className="mt-3 text-sm leading-relaxed text-destructive">
                      {voice.error}
                    </p>
                  )}
                  {captions.length > 0 && (
                    <div
                      ref={captionsRef}
                      aria-label="Live call captions"
                      className="chat-scroll mt-3 max-h-36 space-y-2 overflow-y-auto border-t border-hairline pt-3 text-sm leading-relaxed"
                    >
                      {captions.map((c, i) => (
                        <p
                          key={i}
                          className={
                            c.role === "user" ? "text-muted-foreground" : "text-foreground"
                          }
                        >
                          <span className="font-mono text-[10px] uppercase text-signal">
                            {c.role === "user" ? "you › " : "ai › "}
                          </span>
                          {c.text}
                          {c.interrupted && (
                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                              — interrupted
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                  {captions.some((c) => /\b(resume|résumé|cv|curriculum)\b/i.test(c.text)) && (
                    <a
                      href="/api/public/resume"
                      download
                      className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-sm border border-primary px-3 font-mono text-xs text-signal transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      ↓ Download resume
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          {recError && (
            <p
              role="alert"
              className="mb-2 border-l-2 border-destructive pl-3 text-sm text-destructive"
            >
              {recError}
            </p>
          )}
          {speech.error && (
            <p
              role="alert"
              className="mb-2 border-l-2 border-destructive pl-3 text-sm text-destructive"
            >
              {speech.error}
            </p>
          )}
          <div className="composer-shell flex items-end gap-1.5 border border-input bg-card p-2 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.8)] transition-colors focus-within:border-signal sm:gap-2">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              aria-label="Message Daniyal's AI"
              placeholder={
                rec === "recording"
                  ? "Recording… tap the mic to finish"
                  : rec === "transcribing"
                    ? "Transcribing…"
                    : "Ask Daniyal…"
              }
              className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-relaxed outline-none placeholder:text-muted-foreground sm:text-sm"
            />
            <button
              type="button"
              aria-label={rec === "recording" ? "Stop recording" : "Record a question"}
              title="Record a question"
              onClick={toggleRecord}
              disabled={rec === "transcribing" || status !== "idle" || inCall}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${rec === "recording" ? "animate-pulse border-destructive bg-destructive text-destructive-foreground" : "border-hairline text-muted-foreground hover:border-signal hover:text-signal"}`}
            >
              {rec === "transcribing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : rec === "recording" ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              aria-label="Start voice chat"
              title="Real-time voice chat"
              onClick={startCall}
              disabled={inCall || rec !== "idle"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${inCall ? "border-signal bg-primary text-primary-foreground" : "border-hairline text-muted-foreground hover:border-signal hover:text-signal"}`}
            >
              <AudioLines className="h-4 w-4" />
            </button>
            {status === "idle" ? (
              <button
                type="submit"
                aria-label="Send"
                disabled={!input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Stop"
                onClick={() => abortRef.current?.abort()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-signal bg-secondary text-signal"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-2 hidden text-center font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
            Enter to send · Shift + Enter for a new line · grounded answers, not invented claims
          </p>
        </form>
      </div>

      {panel && active && (
        <InspectPanel
          m={active}
          tab={panel.tab}
          focus={panel.focus}
          setTab={(tab) => setPanel({ ...panel, tab })}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
