import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Activity, ChevronDown } from "lucide-react";
import type { VoiceTelemetry } from "@/hooks/use-live-voice";
import { actionHref, actionLabel, detectActions, type UiAction } from "@/lib/voice-logic";

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

type Check = { name: string; status: "idle" | "running" | "pass" | "fail"; detail: string };
const CHECKS = ["AudioWorklet registration", "Mic AEC constraints", "Speculative RAG cache (<50ms)", "Turn-ID barge-in cancellation", "Generative UI scroll dispatch"];

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error(`timed out after ${ms}ms`)), ms))]);

async function checkWorklet(): Promise<string> {
  const ctx = new AudioContext();
  try {
    await ctx.audioWorklet.addModule("/voice-worklets.js");
    new AudioWorkletNode(ctx, "vad-processor");
    new AudioWorkletNode(ctx, "ring-player");
    return `vad-processor + ring-player registered @ ${ctx.sampleRate}Hz`;
  } finally { void ctx.close(); }
}

async function checkMic(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 24000 } });
  try {
    const st = stream.getAudioTracks()[0]?.getSettings() ?? {};
    if (st.echoCancellation !== true) throw new Error(`echoCancellation=${String(st.echoCancellation)}`);
    return `AEC=${st.echoCancellation} NS=${String(st.noiseSuppression)} AGC=${String(st.autoGainControl)} ch=${st.channelCount ?? "?"} sr=${st.sampleRate ?? "?"}`;
  } finally { stream.getTracks().forEach((t) => t.stop()); }
}

async function checkCache(): Promise<string> {
  const query = `system check ${Date.now()} does he know python fastapi`;
  const call = async () => {
    const r = await fetch("/api/prefetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
    if (!r.ok) throw new Error(`prefetch HTTP ${r.status}`);
    return (await r.json()) as { cache: string; ms: number };
  };
  const cold = await call();
  const warm = await call();
  if (warm.cache !== "hit") throw new Error(`second lookup was ${warm.cache}`);
  if (warm.ms >= 50) throw new Error(`warm lookup ${warm.ms}ms`);
  return `cold ${cold.cache} ${cold.ms}ms → warm hit ${warm.ms}ms`;
}

async function checkBargeIn(): Promise<string> {
  const ctx = new AudioContext();
  try {
    await ctx.audioWorklet.addModule("/voice-worklets.js");
    await ctx.resume();
    const osc = ctx.createOscillator();
    const node = new AudioWorkletNode(ctx, "ring-player", { outputChannelCount: [1] });
    const sink = ctx.createGain();
    sink.gain.value = 0; // silent test
    osc.connect(node).connect(sink).connect(ctx.destination);
    osc.start();
    let speaking = false, cutAt = 0;
    const result = new Promise<string>((resolve) => {
      node.port.onmessage = ({ data }) => {
        if (data.type !== "level") return;
        if (!speaking && data.rms > 0.05) {
          speaking = true;
          cutAt = performance.now();
          node.port.postMessage({ type: "flush" });
          node.port.postMessage({ type: "duck", on: true });
        } else if (speaking && data.rms < 0.001) resolve(`playback silenced ${Math.round(performance.now() - cutAt)}ms after interrupt`);
      };
    });
    const msg = await withTimeout(result, 3000);
    const ms = Number(msg.match(/(\d+)ms/)?.[1] ?? 999);
    if (ms > 60) throw new Error(msg);
    return msg;
  } finally { void ctx.close(); }
}

async function checkDispatch(): Promise<string> {
  const action = detectActions("Tell me about AI BotKit")[0];
  if (!action) throw new Error("no action detected");
  const href = actionHref(action);
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;left:-9999px;width:1200px;height:900px;";
  frame.src = href;
  document.body.appendChild(frame);
  try {
    const t0 = performance.now();
    // Poll for a persistent marker set by the portfolio page (the pulse class is removed after ~3s).
    while (performance.now() - t0 < 18000) {
      await new Promise((r) => setTimeout(r, 100));
      let hit: string | undefined;
      try { hit = frame.contentDocument?.documentElement.dataset["cobrowseHit"]; } catch { throw new Error("portfolio frame not readable"); }
      if (hit) return `${actionLabel(action)} → #${hit} highlighted in ${Math.round(performance.now() - t0)}ms`;
    }
    throw new Error(`${href} did not highlight a target`);
  } finally { frame.remove(); }
}

const RUNNERS = [checkWorklet, checkMic, checkCache, checkBargeIn, checkDispatch];

export function TelemetryPanel(props: {
  telemetry: MutableRefObject<VoiceTelemetry>;
  inCall: boolean;
  endpointMs: number;
  prefetch: PrefetchLog[];
  dispatches: Dispatch[];
  llmFirstTokenMs: number | null;
  ragCache: string | null;
  ragMs: number | null;
  ttsTtfaMs: number | null;
  ttsTtfbMs: number | null;
  droppedPackets: number;
}) {
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const [checks, setChecks] = useState<Check[]>(CHECKS.map((name) => ({ name, status: "idle", detail: "" })));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [open]);
  const running = checks.some((c) => c.status === "running");
  const runAll = async () => {
    for (let i = 0; i < RUNNERS.length; i++) {
      setChecks((cs) => cs.map((c, j) => (j === i ? { ...c, status: "running", detail: "" } : c)));
      try {
        const detail = await withTimeout(RUNNERS[i]!(), 20000);
        setChecks((cs) => cs.map((c, j) => (j === i ? { ...c, status: "pass", detail } : c)));
      } catch (e) {
        setChecks((cs) => cs.map((c, j) => (j === i ? { ...c, status: "fail", detail: (e as Error).message } : c)));
      }
    }
  };
  const t = props.telemetry.current;
  const remaining = t.connectedAt && props.inCall ? Math.max(0, t.maxMs - (Date.now() - t.connectedAt)) : null;
  const fmt = (ms: number | null) => (ms === null ? "—" : `${Math.round(ms)}ms`);
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const lastPrefetch = props.prefetch[props.prefetch.length - 1];
  const ragLabel = lastPrefetch ? (lastPrefetch.cache === "hit" ? "SPECULATIVE CACHE HIT" : "HYBRID DB QUERY") : props.ragCache ? (props.ragCache === "hit" ? "SPECULATIVE CACHE HIT" : "HYBRID DB QUERY") : "—";
  const ragMs = lastPrefetch ? lastPrefetch.ms : props.ragMs;
  const ttfaColor = t.ttfaMs === null ? "text-muted-foreground" : t.ttfaMs < 500 ? "text-primary" : t.ttfaMs < 800 ? "text-amber-400" : "text-destructive";
  const mode = props.endpointMs <= 400 ? `Fast ${props.endpointMs}ms` : props.endpointMs >= 1100 ? `Extended ${props.endpointMs}ms` : `Normal ${props.endpointMs}ms`;
  const fillPct = Math.min(100, (t.bufferMs / 1000) * 100);
  const lastTool = props.dispatches[props.dispatches.length - 1];
  const { at: _at, ...toolPayload } = lastTool ?? { at: 0 };
  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="telemetry-hud" title="Telemetry (Ctrl+Shift+D)" className="fixed bottom-24 right-4 z-30 flex items-center gap-1.5 border border-primary bg-background px-2.5 py-1 font-mono text-[11px] text-primary hover:bg-primary hover:text-primary-foreground">
        ⚡ Telemetry {remaining !== null && <span className="tabular-nums">· {mmss(remaining)}</span>}
      </button>
      {open && (
        <section id="telemetry-hud" role="dialog" aria-label="Voice and RAG telemetry" className="fixed bottom-32 right-4 z-30 max-h-[70vh] w-[min(560px,calc(100vw-2rem))] overflow-y-auto border border-border bg-card font-mono text-[11px] shadow-2xl">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">voice & rag telemetry</span>
            <span className="ml-auto text-muted-foreground">ctrl+shift+d</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close telemetry" className="text-muted-foreground hover:text-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
          </header>
          <div className="grid gap-px bg-border sm:grid-cols-2">
            <dl className="bg-card p-3">
              <p className="mb-1 text-primary">latency breakdown</p>
              <Row k="VAD detection" v={fmt(t.onsetDetectMs)} />
              <Row k="RAG retrieval" v={fmt(ragMs)} />
              <p className={`py-1 text-right ${ragLabel === "SPECULATIVE CACHE HIT" ? "text-primary" : "text-muted-foreground"}`}>{ragLabel}</p>
              <Row k="LLM TTFT" v={fmt(props.llmFirstTokenMs)} />
              <Row k="TTS TTFB" v={fmt(props.ttsTtfbMs)} />
              <Row k="read-aloud TTFA" v={fmt(props.ttsTtfaMs)} />
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted-foreground">voice-to-voice TTFA</dt>
                <dd className={`tabular-nums ${ttfaColor}`}>{fmt(t.ttfaMs)}</dd>
              </div>
            </dl>
            <dl className="bg-card p-3">
              <p className="mb-1 text-primary">pipeline state</p>
              <Row k="turn_id" v={String(t.turnId)} />
              <Row k="dropped stale packets" v={String(props.droppedPackets)} />
              <Row k="barge-ins" v={`${t.bargeIns}${t.lastBargeCutMs !== null ? ` · cut ${t.lastBargeCutMs}ms` : ""}`} />
              <Row k="AudioWorklet" v={t.worklet ? "Active" : props.inCall ? "Fallback" : "—"} warn={props.inCall && !t.worklet} />
              <Row k="ring buffer" v={`${fillPct.toFixed(1)}% (${t.bufferMs.toFixed(1)}ms)`} />
              <Meter value={fillPct} max={100} />
              <Row k="underruns" v={String(t.underruns)} warn={t.underruns > 0} />
              <Row k="mic rms · vad" v={`${t.micRms.toFixed(3)} · ${t.vad}`} />
              <Row k="endpointing" v={mode} />
            </dl>
          </div>
          <div className="border-t border-border p-3">
            <p className="mb-1 text-primary">last generative UI tool call</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">{lastTool ? JSON.stringify(toolPayload, null, 1) : "none"}</pre>
          </div>
          <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center">
              <p className="text-primary">system check</p>
              <button type="button" onClick={runAll} disabled={running} className="ml-auto border border-primary px-2 py-0.5 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50">{running ? "running…" : "Run System Check"}</button>
            </div>
            <ul className="space-y-1">
              {checks.map((c) => (
                <li key={c.name} className="grid grid-cols-[48px_1fr] gap-2">
                  <span className={`border px-1 text-center ${c.status === "pass" ? "border-primary bg-primary text-primary-foreground" : c.status === "fail" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-muted-foreground"}`}>{c.status === "pass" ? "PASS" : c.status === "fail" ? "FAIL" : c.status === "running" ? "…" : "—"}</span>
                  <span><span className="text-foreground">{c.name}</span>{c.detail && <span className="block text-muted-foreground">{c.detail}</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
