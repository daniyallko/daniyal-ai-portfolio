import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Activity, ChevronDown } from "lucide-react";
import type { VoiceTelemetry } from "@/hooks/use-live-voice";
import { actionLabel, type UiAction } from "@/lib/voice-logic";

export type OrbState = "idle" | "listening" | "retrieving" | "thinking" | "speaking";

export function orbState(t: VoiceTelemetry, active: boolean, retrieving: boolean): OrbState {
  if (!active) return "idle";
  if (t.assistantSpeaking && !t.ducked) return "speaking";
  if (t.vad === "speech") return "listening";
  if (retrieving) return "retrieving";
  if (t.silenceMs > 0 && t.silenceMs < 4000 && t.ttfaMs === null) return "thinking";
  return "listening";
}

/** 60fps canvas orb driven by the mic and output AnalyserNodes. */
export function VoiceOrb({ telemetry, active, retrievingRef }: { telemetry: MutableRefObject<VoiceTelemetry>; active: boolean; retrievingRef: MutableRefObject<boolean> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState<OrbState>("idle");
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 96, H = 96;
    c.width = W * dpr; c.height = H * dpr;
    g.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const primary = `oklch(${css.getPropertyValue("--primary").replace(/oklch\(|\)/g, "").trim() || "0.91 0.2 122"})`;
    const muted = `oklch(${css.getPropertyValue("--muted-foreground").replace(/oklch\(|\)/g, "").trim() || "0.6 0 0"})`;
    const freq = new Uint8Array(128);
    let raf = 0, last: OrbState = "idle";
    const draw = (now: number) => {
      const t = telemetry.current;
      const st = orbState(t, active, retrievingRef.current);
      if (st !== last) { last = st; setLabel(st); }
      g.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      let r = 18;
      if (st === "listening") r += Math.min(14, t.micRms * 160);
      if (st === "thinking") r += Math.sin(now / 300) * 2;
      g.strokeStyle = st === "idle" ? muted : primary;
      g.fillStyle = st === "idle" ? muted : primary;
      g.globalAlpha = 0.15;
      g.beginPath(); g.arc(cx, cy, r + 6, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      if (st === "speaking" && t.outAnalyser) {
        t.outAnalyser.getByteFrequencyData(freq);
        const bars = 48;
        for (let i = 0; i < bars; i++) {
          const v = freq[Math.floor((i / bars) * 64)]! / 255;
          const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const len = 2 + v * 20;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
          g.lineTo(cx + Math.cos(a) * (r + 2 + len), cy + Math.sin(a) * (r + 2 + len));
          g.stroke();
        }
      } else if (st === "retrieving") {
        const a0 = (now / 220) % (Math.PI * 2);
        g.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          g.beginPath(); g.arc(cx, cy, r + 8, a0 + (k * Math.PI * 2) / 3, a0 + (k * Math.PI * 2) / 3 + 0.6); g.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [telemetry, active, retrievingRef]);
  return (
    <div className="flex flex-col items-center">
      <canvas ref={ref} style={{ width: 96, height: 96 }} aria-hidden />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground" aria-live="polite">{label}</span>
    </div>
  );
}

export type Dispatch = { at: number; source: "voice" | "text"; action: UiAction; href: string };
export type PrefetchLog = { query: string; cache: string; ms: number };

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-1 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`tabular-nums ${warn ? "text-destructive" : "text-foreground"}`}>{v}</dd>
    </div>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1 w-full bg-border" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export function TelemetryPanel(props: {
  telemetry: MutableRefObject<VoiceTelemetry>;
  inCall: boolean;
  endpointMs: number;
  prefetch: PrefetchLog[];
  dispatches: Dispatch[];
  llmFirstTokenMs: number | null;
  ragCache: string | null;
  ttsTtfaMs: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [open]);
  const t = props.telemetry.current;
  const remaining = t.connectedAt && props.inCall ? Math.max(0, t.maxMs - (Date.now() - t.connectedAt)) : null;
  const idleLeft = props.inCall ? Math.max(0, t.idleMs - (Date.now() - t.lastActivity)) : null;
  const fmt = (ms: number | null) => (ms === null ? "—" : `${Math.round(ms)}ms`);
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const hits = props.prefetch.filter((p) => p.cache === "hit").length;
  return (
    <section className="mb-2 border border-border bg-card font-mono text-[11px]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="telemetry-body" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-muted-foreground hover:text-foreground">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span>telemetry</span>
        <span className="ml-auto flex gap-3">
          <span>turn #{t.turnId}</span>
          {remaining !== null && <span className={remaining < 60000 ? "text-destructive" : ""}>⏱ {mmss(remaining)}</span>}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="telemetry-body" className="grid gap-px border-t border-border bg-border md:grid-cols-3">
          <dl className="bg-card p-3">
            <p className="mb-1 text-primary">audio</p>
            <Row k="mic rms" v={t.micRms.toFixed(3)} />
            <Meter value={t.micRms} max={0.2} />
            <Row k="vad" v={t.vad === "speech" ? "speech onset" : `silence ${t.silenceMs}ms`} />
            <Row k="onset detect" v={fmt(t.onsetDetectMs)} />
            <Row k="worklet buffer" v={t.worklet ? `${t.bufferMs.toFixed(1)}ms` : "fallback"} warn={!t.worklet && props.inCall} />
            <Meter value={t.bufferMs} max={100} />
            <Row k="out rms" v={t.outRms.toFixed(3)} />
            <Row k="underruns" v={String(t.underruns)} />
          </dl>
          <dl className="bg-card p-3">
            <p className="mb-1 text-primary">turns & latency</p>
            <Row k="session" v={t.sessionId.slice(0, 8)} />
            <Row k="turn_id" v={String(t.turnId)} />
            <Row k="barge-ins" v={`${t.bargeIns}${t.lastBargeCutMs !== null ? ` · cut ${t.lastBargeCutMs}ms` : ""}`} />
            <Row k="endpoint (pred.)" v={`${props.endpointMs}ms`} />
            <Row k="voice TTFA" v={fmt(t.ttfaMs)} />
            <Row k="LLM first token" v={fmt(props.llmFirstTokenMs)} />
            <Row k="read-aloud TTFA" v={fmt(props.ttsTtfaMs)} />
            <Row k="RAG cache (text)" v={props.ragCache ?? "—"} />
          </dl>
          <dl className="bg-card p-3">
            <p className="mb-1 text-primary">prefetch & tools</p>
            <Row k="prefetch hit/total" v={`${hits}/${props.prefetch.length}`} />
            {props.prefetch.slice(-2).map((p, i) => <Row key={i} k={p.query.slice(0, 22)} v={`${p.cache} ${p.ms}ms`} />)}
            <Row k="idle cutoff" v={idleLeft === null ? "—" : `${Math.ceil(idleLeft / 1000)}s`} warn={idleLeft !== null && idleLeft < 5000} />
            <p className="mt-2 text-muted-foreground">tool dispatches</p>
            {props.dispatches.length === 0 ? <p className="text-muted-foreground">none</p> : props.dispatches.slice(-4).map((d) => (
              <p key={d.at + d.href} className="truncate"><span className="text-primary">{d.source}›</span> {actionLabel(d.action)}</p>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
