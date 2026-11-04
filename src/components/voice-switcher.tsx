import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Square, Volume2 } from "lucide-react";
import { VOICE_PERSONAS, DEFAULT_PERSONA_ID, getPersona, type VoicePersona } from "@/config/voicePersonas";
import { LANGUAGES, isLangCode, type DetectedLanguage, type LangCode } from "@/lib/language";

const KEY = "daniyal.voicePrefs.v1";

/** Persisted voice + language lock. Read after mount so SSR markup never mismatches. */
export function useVoicePrefs() {
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);
  const [lock, setLock] = useState<LangCode | null>(null);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { personaId?: string; lock?: string };
      if (v.personaId) setPersonaId(getPersona(v.personaId).id);
      if (isLangCode(v.lock)) setLock(v.lock);
    } catch { /* ignore */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify({ personaId, lock }));
  }, [personaId, lock]);
  return { persona: getPersona(personaId), setPersonaId, lock, setLock };
}

export function VoiceSwitcher(props: {
  persona: VoicePersona;
  onPersona: (id: string) => void;
  lock: LangCode | null;
  onLock: (l: LangCode | null) => void;
  detected: DetectedLanguage | null;
  previewing: string | null;
  previewState: "idle" | "loading" | "playing";
  onPreview: (p: VoicePersona) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const langLabel = props.lock
    ? `🔒 ${LANGUAGES[props.lock].name}`
    : `🌐 Auto-Detect: ${props.detected ? props.detected.name : "—"}`;
  return (
    <div ref={ref} className="relative ml-auto">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" className="flex items-center gap-2 border border-border bg-card px-2 py-1 font-mono text-[11px] hover:border-primary/60">
        <span className="border border-primary px-1 text-primary">{props.persona.badge}</span>
        <span className="hidden text-foreground sm:inline">{props.persona.name}</span>
        <span className="text-muted-foreground" aria-live="polite">{langLabel}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div role="dialog" aria-label="Voice and language" className="absolute right-0 top-full z-40 mt-1 w-[min(360px,calc(100vw-2rem))] border border-border bg-card font-mono text-[11px] shadow-2xl">
          <p className="border-b border-border px-3 py-2 text-primary">voice persona</p>
          <ul>
            {VOICE_PERSONAS.map((p) => {
              const active = p.id === props.persona.id;
              const busy = props.previewing === `preview:${p.id}`;
              return (
                <li key={p.id} className={`flex items-center gap-2 border-b border-border px-3 py-2 ${active ? "bg-accent/40" : ""}`}>
                  <button type="button" onClick={() => props.onPersona(p.id)} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className={`border px-1 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{p.badge}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-foreground">{p.name}</span>
                      <span className="block text-muted-foreground">{p.tagline} · {p.gender} · {p.rate}x</span>
                    </span>
                    {active && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                  </button>
                  <button type="button" onClick={() => props.onPreview(p)} aria-label={`Preview ${p.name}`} className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-muted-foreground hover:border-primary hover:text-primary">
                    {busy && props.previewState === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : busy && props.previewState === "playing" ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    preview
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="flex items-center gap-2 px-3 py-2">
            <span className="text-primary">language</span>
            <select value={props.lock ?? "auto"} onChange={(e) => props.onLock(isLangCode(e.target.value) ? e.target.value : null)} className="ml-auto border border-border bg-background px-1 py-0.5 text-foreground">
              <option value="auto">Auto-detect</option>
              {(Object.keys(LANGUAGES) as LangCode[]).map((c) => <option key={c} value={c}>Lock: {LANGUAGES[c].name}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
