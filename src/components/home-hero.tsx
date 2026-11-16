import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, AudioLines, Loader2, Mic, Square } from "lucide-react";
import { profile } from "@/lib/portfolio";
import { VoiceSwitcher, useVoicePrefs } from "@/components/voice-switcher";
import { useSpeech } from "@/hooks/use-speech";
import { previewLine } from "@/lib/language";
import { AxonHero } from "@/components/axon-hero";

export type AssistantRequest = { q?: string; call?: boolean };

const CREDS = [
  "Advanced RAG",
  "LangGraph agents",
  "Real-time voice AI",
  "WhatsApp & Telegram bots",
  "Stripe migrations",
  "Pinecone hybrid search",
];

const CHIPS: { label: string; q?: string; call?: boolean }[] = [
  {
    label: "System architecture",
    q: "How does AI BotKit's RAG pipeline work?",
  },
  { label: "Best projects", q: "What are Daniyal's best projects?" },
  { label: "Start voice intro", call: true },
  { label: "Availability", q: "Is Daniyal available immediately? What is his notice period?" },
];

const PROMPTS = [
  ...CHIPS.flatMap((chip) => (chip.q ? [chip.q] : [])),
  ...CREDS.slice(0, 3).map(
    (credential) => `Tell me about Daniyal's experience with ${credential}.`,
  ),
];

export function HomeHero({
  onOpen,
  assistantOpen = false,
}: {
  onOpen: (request?: AssistantRequest) => void;
  assistantOpen?: boolean;
}) {
  const [input, setInput] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [rec, setRec] = useState<"idle" | "recording" | "transcribing">("idle");
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const prefs = useVoicePrefs();
  const speech = useSpeech({ voice: prefs.persona.ttsVoice, lang: prefs.lock });

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

  useEffect(() => {
    if (inputFocused || input || rec !== "idle") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setPromptIndex((index) => (index + 1) % PROMPTS.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [input, inputFocused, rec]);

  return (
    <section className="home-hero hero-exit relative flex min-h-[calc(100dvh-4.5rem)] flex-col justify-center overflow-hidden text-left">
      <AxonHero paused={assistantOpen} />
      <div className="hero-landing-grid relative z-10 mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.75fr)] lg:gap-4 lg:py-16 xl:px-12">
        <div className="hero-copy flex min-w-0 flex-col items-start">
          <h1
            className="hero-heading hero-enter order-1 mt-0 max-w-[12ch] text-[clamp(2.75rem,7.4vw,7.5rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-balance"
            style={{ "--enter": 1 } as React.CSSProperties}
          >
            Mohd Daniyal builds AI that{" "}
            <span className="font-serif font-normal italic tracking-[-0.025em] text-signal">
              talks back.
            </span>
          </h1>
          <p
            className="hero-subheading hero-enter order-2 mt-5 max-w-[62ch] text-[clamp(1.0625rem,1.35vw,1.25rem)] font-medium leading-relaxed text-foreground sm:mt-7"
            style={{ "--enter": 2 } as React.CSSProperties}
          >
            {profile.title} with 5+ years in production. Core engineer on AI BotKit, a RAG chatbot
            platform live on 1,000+ websites serving 100,000+ users, from hybrid retrieval to
            WhatsApp, Telegram and multilingual voice.
          </p>
          <ul
            className="hero-creds hero-enter order-3 mt-5 flex max-w-3xl flex-wrap gap-1.5 sm:mt-6 sm:gap-2"
            style={{ "--enter": 3 } as React.CSSProperties}
          >
            {CREDS.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => send(`Tell me about Daniyal's experience with ${c}.`)}
                  className="group flex min-h-9 items-center gap-2 rounded-md border border-hairline bg-card/70 px-2.5 font-mono text-[11px] text-foreground/80 backdrop-blur-md transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <span
                    className="h-1 w-1 rounded-full bg-foreground/40 transition-colors group-hover:bg-signal"
                    aria-hidden="true"
                  />
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
            className="hero-enter hero-dock surface order-4 mt-5 w-full max-w-3xl rounded-xl p-2 text-left backdrop-blur-2xl focus-within:border-primary/60 sm:mt-8"
            style={{ "--enter": 4 } as React.CSSProperties}
          >
            <div className="relative min-h-[3.25rem]">
              {rec === "idle" && !input && (
                <span
                  key={promptIndex}
                  aria-hidden="true"
                  className="hero-prompt pointer-events-none absolute inset-x-3 top-3.5 truncate text-base text-muted-foreground"
                >
                  {PROMPTS[promptIndex]}
                </span>
              )}
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                aria-label="Ask about Daniyal"
                placeholder={
                  rec === "recording"
                    ? "Listening… tap the mic to finish"
                    : rec === "transcribing"
                      ? "Transcribing…"
                      : PROMPTS[promptIndex]
                }
                className={`block max-h-40 w-full resize-none bg-transparent px-3 py-3.5 text-base outline-none ${input ? "overflow-y-auto" : "overflow-hidden [scrollbar-width:none]"} ${
                  rec === "idle" && !input
                    ? "placeholder:text-transparent"
                    : "placeholder:text-muted-foreground"
                }`}
              />
            </div>
            <div className="grid grid-cols-1 items-center gap-2 border-t border-hairline px-1 pt-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <VoiceSwitcher
                  wide
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
                      { src: `/voice-previews/${p.id}-${prefs.lock ?? "en"}.mp3` },
                    )
                  }
                />
              </div>
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 [&>button:nth-child(2)]:flex-1 [&>button:nth-child(2)]:justify-center sm:[&>button:nth-child(2)]:flex-none">
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
                  className="relative flex h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-px active:translate-y-px"
                >
                  <AudioLines className="h-4 w-4" />
                  <span className="whitespace-nowrap">Talk live</span>
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
            <p role="alert" className="order-5 mt-3 text-sm text-destructive">
              {err ?? speech.error}
            </p>
          )}
          <div
            className="hero-enter order-6 mt-4 flex flex-wrap gap-2"
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
            className="hero-enter group order-7 mt-8 flex min-h-11 items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
            style={{ "--enter": 6 } as React.CSSProperties}
          >
            <span className="h-px w-10 bg-signal transition-transform duration-300 group-hover:scale-x-150 group-hover:origin-left" />
            See the work <ArrowUpRight className="h-3.5 w-3.5 rotate-90" />
          </a>
        </div>
        <div className="hero-visual relative hidden lg:block lg:min-h-[36rem]">
          <aside
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden border-l border-hairline pl-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground lg:flex lg:flex-col lg:justify-between lg:py-2"
          >
            <div>
              <span className="text-signal">01</span> / Particle field
            </div>
            <div className="[writing-mode:vertical-rl]">Agentic systems · RAG · Voice</div>
            <div>
              2026 <span className="text-signal">↗</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
