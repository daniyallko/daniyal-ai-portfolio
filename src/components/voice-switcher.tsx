import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Languages, Loader2, LockKeyhole, Square, Volume2 } from "lucide-react";
import {
  VOICE_PERSONAS,
  DEFAULT_PERSONA_ID,
  getPersona,
  type VoicePersona,
} from "@/config/voicePersonas";
import { LANGUAGES, isLangCode, type DetectedLanguage, type LangCode } from "@/lib/language";

const KEY = "daniyal.voicePrefs.v1";

/** Persisted voice + language lock. Read after mount so SSR markup never mismatches. */
export function useVoicePrefs() {
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);
  const [lock, setLock] = useState<LangCode | null>(null);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as {
        personaId?: string;
        lock?: string;
      };
      if (v.personaId) setPersonaId(getPersona(v.personaId).id);
      if (isLangCode(v.lock)) setLock(v.lock);
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ personaId, lock }));
    } catch {
      /* retain in-memory preferences */
    }
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const vh = window.innerHeight;
      const top = r.bottom + 8;
      setPos({
        top,
        right: Math.max(8, window.innerWidth - r.right),
        maxH: Math.max(240, vh - top - 12),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);
  const langLabel = props.lock
    ? `Locked: ${LANGUAGES[props.lock].name}`
    : `Auto: ${props.detected?.name ?? "detecting"}`;
  return (
    <div ref={ref} className="relative ml-auto">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="voice-language-popover"
        aria-label={`Voice and language: ${props.persona.name}, ${langLabel}`}
        className="flex h-11 max-w-full items-center gap-2 rounded-full border border-hairline bg-card/80 px-2.5 font-mono text-[10px] transition-colors hover:border-signal hover:text-signal sm:px-3"
      >
        <span className="grid h-7 min-w-7 shrink-0 place-items-center border border-signal/45 px-1 text-signal">
          {props.persona.badge}
        </span>
        <span className="hidden max-w-36 truncate font-sans text-xs font-medium text-foreground min-[420px]:inline lg:max-w-none">
          {props.persona.name}
        </span>
        <span
          className="hidden max-w-32 truncate text-muted-foreground md:inline"
          aria-live="polite"
        >
          {langLabel}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{ top: pos.top, right: pos.right, maxHeight: Math.min(pos.maxH, 560) }}
          id="voice-language-popover"
          role="dialog"
          aria-label="Voice and language"
          className="voice-popover fixed z-[100] w-[min(360px,calc(100vw-2rem))] overflow-y-auto overscroll-contain border border-hairline bg-card shadow-2xl"
        >
          <div className="border-b border-hairline px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
              Voice persona
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Choose the delivery. Changing voice during a call reconnects it.
            </p>
          </div>
          <ul className="p-2">
            {VOICE_PERSONAS.map((p) => {
              const active = p.id === props.persona.id;
              const busy = props.previewing === `preview:${p.id}`;
              return (
                <li
                  key={p.id}
                  className={`flex items-stretch gap-2 border-l-2 p-2 ${active ? "border-signal bg-accent/45" : "border-transparent"}`}
                >
                  <button
                    type="button"
                    onClick={() => props.onPersona(p.id)}
                    aria-pressed={active}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center border font-mono text-[10px] ${active ? "border-signal bg-primary text-primary-foreground" : "border-hairline text-muted-foreground"}`}
                    >
                      {p.badge}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-sm font-medium leading-snug text-foreground"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {p.name}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {p.tagline} · {p.gender} · {p.rate}x
                      </span>
                    </span>
                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-signal" aria-label="Selected" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onPreview(p)}
                    aria-label={`Preview ${p.name}`}
                    aria-pressed={busy && props.previewState === "playing"}
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 self-center rounded-full border border-hairline px-2.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-signal hover:text-signal"
                  >
                    {busy && props.previewState === "loading" ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : busy && props.previewState === "playing" ? (
                      <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span className="hidden min-[380px]:inline">
                      {busy && props.previewState === "playing"
                        ? "stop"
                        : busy && props.previewState === "loading"
                          ? "readying"
                          : "preview"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="flex min-h-16 flex-wrap items-center gap-3 border-t border-hairline px-4 py-3">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
              {props.lock ? (
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Language
            </span>
            <select
              value={props.lock ?? "auto"}
              onChange={(e) => props.onLock(isLangCode(e.target.value) ? e.target.value : null)}
              className="ml-auto min-h-11 max-w-full rounded-full border border-hairline bg-background px-3 text-xs text-foreground"
            >
              <option value="auto">Auto-detect</option>
              {(Object.keys(LANGUAGES) as LangCode[]).map((c) => (
                <option key={c} value={c}>
                  Lock: {LANGUAGES[c].name}
                </option>
              ))}
            </select>
          </label>
        </div>,
        document.body,
      )}
    </div>
  );
}
