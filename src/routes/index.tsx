import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUp, ArrowUpRight, AudioLines, Loader2, Mic, Square } from "lucide-react";
import { profile, stats, experience, projects, skills, education } from "@/lib/portfolio";
import { useTypewriter } from "@/lib/use-typewriter";
import { VoiceSwitcher, useVoicePrefs } from "@/components/voice-switcher";
import { useSpeech } from "@/hooks/use-speech";
import { previewLine } from "@/lib/language";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mohd Daniyal — Full Stack AI Engineer | Agentic AI, RAG, Voice AI" },
      { name: "description", content: "Mohd Daniyal builds production agentic AI, advanced RAG and voice AI. Talk to his AI assistant by text or live voice." },
      { property: "og:title", content: "Mohd Daniyal — Full Stack AI Engineer" },
      { property: "og:description", content: "Agentic AI, advanced RAG and voice AI engineer. 5+ years, AI BotKit on 1,000+ websites." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/** Hand-off from the homepage dock to the chat thread (read once in the thread view). */
export const PENDING_KEY = "daniyal.pending.v1";

const PROMPTS = [
  "Ask anything about Daniyal's AI and engineering experience…",
  "Tap Live Voice to talk to Daniyal's AI in real time…",
  "Speak in English, Hindi, Hinglish or Spanish — auto-detected…",
  "Ask: “Show me Daniyal's best RAG and Kubernetes work”…",
] as const;

const CREDS = ["Advanced RAG", "LangGraph agents", "Real-time voice AI", "Kubernetes", "FastAPI", "Pinecone hybrid search"];

const CHIPS: { label: string; q?: string; call?: boolean }[] = [
  { label: "System architecture", q: "Walk me through the architecture of AI BotKit's RAG pipeline." },
  { label: "Featured projects", q: "What are Daniyal's most impressive projects?" },
  { label: "Start voice intro", call: true },
  { label: "Résumé & availability", q: "Summarize his experience and availability for new roles." },
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -80px 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

// Co-browsing actions from the assistant: /?hl=<element id> or /?skill=<tech>.
function useCoBrowse() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const hl = q.get("hl");
    const skill = q.get("skill")?.toLowerCase();
    const targets: Element[] = [];
    if (hl) { const el = document.getElementById(hl); if (el) targets.push(el); }
    if (skill) {
      document.querySelectorAll<HTMLElement>("[data-skill]").forEach((el) => {
        if (el.dataset["skill"]!.toLowerCase().includes(skill) || el.dataset["group"]!.toLowerCase().includes(skill)) targets.push(el);
      });
    }
    if (!targets.length) return;
    document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in"));
    targets[0]!.scrollIntoView({ behavior: "smooth", block: "center" });
    targets.forEach((el) => el.classList.add("hl-pulse"));
    document.documentElement.dataset["cobrowseHit"] = targets.map((el) => el.id || (el as HTMLElement).dataset["skill"] || "").join(",");
    const t = setTimeout(() => targets.forEach((el) => el.classList.remove("hl-pulse")), 3200);
    return () => clearTimeout(t);
  }, []);
}

const trackSpot = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};

function Index() {
  useCoBrowse();
  useReveal();
  const featured = projects.find((p) => p.featured)!;
  const others = projects.filter((p) => !p.featured);
  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
      <header className="safe-top sticky top-0 z-30 border-b border-hairline bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pb-3 text-sm sm:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-hairline bg-card font-serif text-base italic text-primary">d</span>
            <span className="truncate font-medium">Mohd Daniyal</span>
          </a>
          <nav className="flex items-center gap-1 text-muted-foreground sm:gap-5">
            <a href="#work" className="hidden px-2 py-2 hover:text-foreground sm:inline">Work</a>
            <a href="#log" className="hidden px-2 py-2 hover:text-foreground sm:inline">Experience</a>
            <a href="#stack" className="hidden px-2 py-2 hover:text-foreground sm:inline">Stack</a>
            <Link to="/chat" className="flex min-h-11 items-center rounded-full border border-hairline px-4 text-foreground transition-colors hover:border-primary hover:text-primary">Open assistant</Link>
          </nav>
        </div>
      </header>

      <main id="top" className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 lg:border-x lg:border-hairline">
        <Hero />

        <section className="grid grid-cols-2 border-y border-hairline md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} style={{ "--i": i } as React.CSSProperties} className="reveal border-hairline px-1 py-8 odd:border-r md:border-r md:px-6 md:last:border-r-0">
              <p className="tnum text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.03em]">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        <section id="work" className="py-20 md:py-28">
          <SectionTitle title="Selected work" sub={`${projects.length} systems, from production platforms to personal builds.`} />
          <article id={`proj-${featured.id}`} onPointerMove={trackSpot} className="spot surface reveal mt-10 grid gap-8 rounded-2xl p-6 md:grid-cols-[1.1fr_1fr] md:p-10">
            <div>
              <p className="font-mono text-xs text-primary">Featured · {featured.kind}</p>
              <h3 className="mt-4 text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-none tracking-[-0.03em]">{featured.name}</h3>
              <p className="mt-5 text-lg leading-snug text-foreground/90">{featured.blurb}</p>
            </div>
            <div>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{featured.details}</p>
              <Tags tags={featured.tags} />
            </div>
          </article>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {others.map((p, i) => (
              <article key={p.id} id={`proj-${p.id}`} onPointerMove={trackSpot} style={{ "--i": i } as React.CSSProperties} className="spot surface reveal flex flex-col rounded-2xl p-6">
                <p className="font-mono text-[11px] text-muted-foreground">{p.kind}</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{p.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{p.blurb}</p>
                <Tags tags={p.tags.slice(0, 3)} />
              </article>
            ))}
          </div>
        </section>

        <section id="log" className="border-t border-hairline py-20 md:py-28">
          <SectionTitle title="Experience" sub="Where the systems above were built and run." />
          <ol className="mt-10">
            {experience.map((e, i) => (
              <li key={e.id} style={{ "--i": i } as React.CSSProperties} className="reveal grid gap-4 border-t border-hairline py-8 md:grid-cols-[220px_1fr]">
                <div>
                  <p className="tnum font-mono text-xs text-muted-foreground">{e.period}</p>
                  <p className="mt-2 font-medium text-primary">{e.company}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{e.role}</h3>
                  <ul className="mt-3 max-w-[68ch] space-y-2 text-[15px] leading-relaxed text-muted-foreground">
                    {e.bullets.slice(0, 3).map((b) => <li key={b} className="grid grid-cols-[18px_1fr]"><span className="text-primary">–</span>{b}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="stack" className="border-t border-hairline py-20 md:py-28">
          <SectionTitle title="Tech stack" sub="Tools used in production, grouped by where they sit." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {skills.map((s, i) => (
              <div key={s.group} onPointerMove={trackSpot} style={{ "--i": i } as React.CSSProperties} className="spot surface reveal rounded-2xl p-6">
                <p className="text-sm font-medium text-foreground">{s.group}</p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {s.items.map((it) => <li key={it} data-skill={it} data-group={s.group} className="rounded-md border border-hairline px-2 py-1 font-mono text-[11px] text-muted-foreground">{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <footer id="contact" className="safe-bottom flex flex-col gap-4 border-t border-hairline pt-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{education.degree} · {education.period}</span>
          <span className="flex gap-6">
            <a href={`mailto:${profile.email}`} className="hover:text-primary">{profile.email}</a>
            <a href={profile.website} target="_blank" rel="noreferrer" className="hover:text-primary">Website</a>
          </span>
        </footer>
      </main>
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [rec, setRec] = useState<"idle" | "recording" | "transcribing">("idle");
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const prefs = useVoicePrefs();
  const speech = useSpeech({ voice: prefs.persona.ttsVoice, lang: prefs.lock });
  const typed = useTypewriter(PROMPTS, !input && !focused && rec === "idle");

  const go = (pending: { q?: string; call?: boolean }) => {
    if (leaving) return;
    speech.stop();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    setLeaving(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => navigate({ to: "/chat" }), reduce ? 0 : 560);
  };
  const send = (text: string) => { if (text.trim()) go({ q: text.trim() }); };

  const toggleDictation = async () => {
    setErr(null);
    if (rec === "recording") { recRef.current?.stop(); return; }
    if (rec !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const parts: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(parts, { type });
        if (blob.size < 1000) { setRec("idle"); setErr("That recording was too short."); return; }
        setRec("transcribing");
        try {
          const fd = new FormData();
          fd.append("file", new File([blob], type.includes("mp4") ? "question.mp4" : "question.webm", { type }));
          const r = await fetch("/api/transcribe", { method: "POST", body: fd });
          const j = (await r.json()) as { text?: string; error?: string };
          if (!r.ok || !j.text) throw new Error(j.error ?? "I couldn't hear a question. Try again.");
          setInput((v) => (v ? `${v} ${j.text}` : j.text!));
          taRef.current?.focus();
        } catch (e) { setErr((e as Error).message); } finally { setRec("idle"); }
      };
      recRef.current = mr;
      mr.start();
      setRec("recording");
    } catch { setErr("Microphone access was blocked."); }
  };

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  return (
    <section className={`hero-exit flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center py-14 text-center ${leaving ? "leaving" : ""}`}>
      <p className="flex items-center gap-2 rounded-full border border-hairline bg-card/60 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
        <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-signal opacity-60 motion-reduce:hidden" /><span className="relative h-2 w-2 rounded-full bg-signal" /></span>
        Available · {profile.location} · open to relocation
      </p>
      <h1 className="mt-8 max-w-4xl text-[clamp(2.6rem,7.5vw,6rem)] font-semibold leading-[0.95] tracking-[-0.035em]">
        Mohd Daniyal builds AI that <span className="font-serif font-normal italic tracking-[-0.01em] text-primary">talks back.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-muted-foreground">
        {profile.title} with 5+ years in production. Core engineer on AI BotKit — a RAG chatbot platform live on 1,000+ websites serving 100,000+ users.
      </p>
      <ul className="mt-6 flex max-w-2xl flex-wrap justify-center gap-1.5">
        {CREDS.map((c) => (
          <li key={c}><button type="button" onClick={() => send(`Tell me about Daniyal's experience with ${c}.`)} className="min-h-9 rounded-md border border-hairline px-2.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground">{c}</button></li>
        ))}
      </ul>

      {/* Unified command dock */}
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="surface mt-10 w-full max-w-2xl rounded-2xl p-2 text-left focus-within:border-primary/40">
        <div className="relative min-h-[3.25rem]">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            aria-label="Ask about Daniyal"
            placeholder={focused ? "Ask about experience, projects, stack…" : ""}
            className="block max-h-40 w-full resize-none bg-transparent px-3 py-3.5 text-base outline-none placeholder:text-muted-foreground"
          />
          {!input && !focused && (
            <p aria-hidden className="pointer-events-none absolute inset-x-3 top-3.5 truncate text-base text-muted-foreground">
              {rec === "recording" ? "Listening… tap the mic to finish" : rec === "transcribing" ? "Transcribing…" : typed}
              {rec === "idle" && <span className="caret ml-px inline-block h-[1.05em] w-px translate-y-[3px] bg-primary" />}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-hairline px-1 pt-2">
          <div className="min-w-0 [&>div]:ml-0">
            <VoiceSwitcher
              persona={prefs.persona}
              onPersona={prefs.setPersonaId}
              lock={prefs.lock}
              onLock={prefs.setLock}
              detected={null}
              previewing={speech.id}
              previewState={speech.state}
              onPreview={(p) => void speech.speak(`preview:${p.id}`, previewLine(prefs.lock ?? "en", p.gender === "female"), { voice: p.ttsVoice, lang: prefs.lock ?? "en" })}
            />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={toggleDictation} disabled={rec === "transcribing"} aria-label={rec === "recording" ? "Stop dictation" : "Dictate a question"} title="Dictate" className={`grid h-11 w-11 place-items-center rounded-xl transition-colors disabled:opacity-40 ${rec === "recording" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              {rec === "transcribing" ? <Loader2 className="h-4 w-4 animate-spin" /> : rec === "recording" ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => go({ call: true })} aria-label="Talk live with Daniyal's AI" className="breathe relative flex h-11 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-px active:translate-y-px">
              <AudioLines className="h-4 w-4" /><span className="hidden sm:inline">Talk live</span>
            </button>
            <button type="submit" disabled={!input.trim()} aria-label="Send question" className="grid h-11 w-11 place-items-center rounded-xl border border-hairline text-foreground transition-colors hover:border-primary disabled:opacity-40">
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
      {(err || speech.error) && <p role="alert" className="mt-3 text-sm text-destructive">{err ?? speech.error}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {CHIPS.map((c) => (
          <button key={c.label} type="button" onClick={() => go(c.call ? { call: true } : { q: c.q! })} className="min-h-11 rounded-full border border-hairline px-4 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground">{c.label}</button>
        ))}
      </div>
      <a href="#work" className="mt-14 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">See the work <ArrowUpRight className="h-3.5 w-3.5 rotate-90" /></a>
    </section>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="reveal max-w-2xl">
      <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-none tracking-[-0.03em]">{title}</h2>
      <p className="mt-3 text-muted-foreground">{sub}</p>
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return <div className="mt-5 flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="rounded-md border border-hairline px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{t}</span>)}</div>;
}
