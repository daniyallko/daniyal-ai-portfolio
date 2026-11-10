import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, AudioLines, Loader2, Mic, Square } from "lucide-react";
import { profile } from "@/lib/portfolio";
import { useTypewriter } from "@/lib/use-typewriter";
import { VoiceSwitcher, useVoicePrefs } from "@/components/voice-switcher";
import { useSpeech } from "@/hooks/use-speech";
import { previewLine } from "@/lib/language";
import { HeroBuilding } from "@/components/hero-building";

export type AssistantRequest = { q?: string; call?: boolean };

const PROMPTS = [
  "Ask anything about Daniyal's AI and engineering experience…",
  "Tap Live Voice to talk to Daniyal's AI in real time…",
  "Speak in English, Hindi, Hinglish or Spanish — auto-detected…",
  "Ask: “Show me Daniyal's best RAG and Kubernetes work”…",
] as const;

const CREDS = [
  "Advanced RAG",
  "LangGraph agents",
  "Real-time voice AI",
  "Kubernetes",
  "FastAPI",
  "Pinecone hybrid search",
];

const CHIPS: { label: string; q?: string; call?: boolean }[] = [
  {
    label: "System architecture",
    q: "Walk me through the architecture of AI BotKit's RAG pipeline.",
  },
  { label: "Featured projects", q: "What are Daniyal's most impressive projects?" },
  { label: "Start voice intro", call: true },
  { label: "Résumé & availability", q: "Summarize his experience and availability for new roles." },
];

export function HomeHero({ onOpen }: { onOpen: (request?: AssistantRequest) => void }) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [rec, setRec] = useState<"idle" | "recording" | "transcribing">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const prefs = useVoicePrefs();
  const speech = useSpeech({ voice: prefs.persona.ttsVoice, lang: prefs.lock });
  const typed = useTypewriter(PROMPTS, !reducedMotion && !input && !focused && rec === "idle");

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  const go = (pending: AssistantRequest) => {
    speech.stop();
    onOpen(pending);
  };
  const send = (text: string) => {
    if (text.trim()) {
      go({ q: text.trim() });
      setInput("");
    }
  };

  const toggleDictation = async () => {
    setErr(null);
    if (rec === "recording") {
      recRef.current?.stop();
      return;
    }
    if (rec !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
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
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(parts, { type });
        if (blob.size < 1000) {
          setRec("idle");
          setErr("That recording was too short.");
          return;
        }
        setRec("transcribing");
        try {
          const fd = new FormData();
          fd.append(
            "file",
            new File([blob], type.includes("mp4") ? "question.mp4" : "question.webm", { type }),
          );
          const r = await fetch("/api/transcribe", { method: "POST", body: fd });
          const j = (await r.json()) as { text?: string; error?: string };
          if (!r.ok || !j.text)
            throw new Error(j.error ?? "I couldn't hear a question. Try again.");
          setInput((v) => (v ? `${v} ${j.text}` : j.text!));
          taRef.current?.focus();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setRec("idle");
        }
      };
      recRef.current = mr;
      mr.start();
      setRec("recording");
    } catch {
      setErr("Microphone access was blocked.");
    }
  };

  useEffect(
    () => () => {
      const recorder = recRef.current;
      recRef.current = null;
      if (!recorder) return;
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  return (
    <section className="home-hero hero-exit relative flex min-h-[calc(100dvh-4.5rem)] flex-col justify-center overflow-hidden text-left">
      <HeroBuilding />
      <div className="relative z-10 mx-auto grid w-full max-w-[90rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_10rem] lg:py-16 xl:px-12">
        <div className="hero-copy flex min-w-0 flex-col items-start">
          <p
            className="hero-enter flex items-center gap-2 rounded-full border border-hairline bg-background/55 px-3 py-1.5 font-mono text-[10px] tracking-[0.04em] text-muted-foreground backdrop-blur-md sm:text-[11px]"
            style={{ "--enter": 0 } as React.CSSProperties}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-signal opacity-60 motion-reduce:hidden" />
              <span className="relative h-2 w-2 rounded-full bg-signal" />
            </span>
            Available · {profile.location} · open to relocation
          </p>
          <h1
            className="hero-enter mt-7 max-w-[12ch] text-[clamp(3.25rem,7.4vw,7.5rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-balance"
            style={{ "--enter": 1 } as React.CSSProperties}
          >
            Mohd Daniyal builds AI that{" "}
            <span className="font-serif font-normal italic tracking-[-0.025em] text-signal">
              talks back.
            </span>
          </h1>
          <p
            className="hero-enter mt-7 max-w-[62ch] text-[clamp(1rem,1.35vw,1.2rem)] leading-relaxed text-muted-foreground"
            style={{ "--enter": 2 } as React.CSSProperties}
          >
            {profile.title} with 5+ years in production. Core engineer on AI BotKit — a RAG chatbot
            platform live on 1,000+ websites serving 100,000+ users.
          </p>
          <ul
            className="hero-enter mt-6 flex max-w-3xl flex-wrap gap-1.5"
            style={{ "--enter": 3 } as React.CSSProperties}
          >
            {CREDS.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => send(`Tell me about Daniyal's experience with ${c}.`)}
                  className="min-h-9 rounded-md border border-hairline px-2.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>

          {/* Unified command dock */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="hero-enter hero-dock surface mt-8 w-full max-w-3xl rounded-xl p-2 text-left backdrop-blur-2xl focus-within:border-primary/60"
            style={{ "--enter": 4 } as React.CSSProperties}
          >
            <div className="relative min-h-[3.25rem]">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                aria-label="Ask about Daniyal"
                placeholder={focused ? "Ask about experience, projects, stack…" : ""}
                className="block max-h-40 w-full resize-none bg-transparent px-3 py-3.5 text-base outline-none placeholder:text-muted-foreground"
              />
              {!input && !focused && (
                <p
                  aria-hidden
                  className="pointer-events-none absolute inset-x-3 top-3.5 truncate text-base text-muted-foreground"
                >
                  {rec === "recording"
                    ? "Listening… tap the mic to finish"
                    : rec === "transcribing"
                      ? "Transcribing…"
                      : reducedMotion
                        ? PROMPTS[0]
                        : typed}
                  {rec === "idle" && !reducedMotion && (
                    <span className="caret ml-px inline-block h-[1.05em] w-px translate-y-[3px] bg-primary" />
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-hairline px-1 pt-2">
              <div className="min-w-0 [&>div]:!ml-0">
                <VoiceSwitcher
                  persona={prefs.persona}
                  onPersona={prefs.setPersonaId}
                  lock={prefs.lock}
                  onLock={prefs.setLock}
                  detected={null}
                  previewing={speech.id}
                  previewState={speech.state}
                  onPreview={(p) =>
                    void speech.speak(
                      `preview:${p.id}`,
                      previewLine(prefs.lock ?? "en", p.gender === "female"),
                      { voice: p.ttsVoice, lang: prefs.lock ?? "en" },
                    )
                  }
                />
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleDictation}
                  disabled={rec === "transcribing"}
                  aria-label={rec === "recording" ? "Stop dictation" : "Dictate a question"}
                  title="Dictate"
                  className={`grid h-11 w-11 place-items-center rounded-xl transition-colors disabled:opacity-40 ${rec === "recording" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
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
                  onClick={() => go({ call: true })}
                  aria-label="Talk live with Daniyal's AI"
                  className="breathe relative flex h-11 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-px active:translate-y-px"
                >
                  <AudioLines className="h-4 w-4" />
                  <span className="hidden sm:inline">Talk live</span>
                </button>
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send question"
                  className="grid h-11 w-11 place-items-center rounded-xl border border-hairline text-foreground transition-colors hover:border-primary disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>
          {(err || speech.error) && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {err ?? speech.error}
            </p>
          )}
          <div
            className="hero-enter mt-4 flex flex-wrap gap-2"
            style={{ "--enter": 5 } as React.CSSProperties}
          >
            {CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => go(c.call ? { call: true } : { q: c.q! })}
                className="min-h-11 rounded-full border border-hairline bg-background/25 px-4 text-sm text-muted-foreground backdrop-blur-md transition-colors hover:border-primary/60 hover:text-foreground"
              >
                {c.label}
              </button>
            ))}
          </div>
          <a
            href="#work"
            className="hero-enter group mt-8 flex min-h-11 items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
            style={{ "--enter": 6 } as React.CSSProperties}
          >
            <span className="h-px w-10 bg-signal transition-transform duration-300 group-hover:scale-x-150 group-hover:origin-left" />
            See the work <ArrowUpRight className="h-3.5 w-3.5 rotate-90" />
          </a>
        </div>
        <aside
          aria-hidden
          className="hidden border-l border-white/15 pl-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:flex lg:flex-col lg:justify-between lg:py-2"
        >
          <div>
            <span className="text-signal">01</span> / Portfolio
          </div>
          <div className="[writing-mode:vertical-rl]">Agentic systems · RAG · Voice</div>
          <div>
            2026 <span className="text-signal">↗</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
