import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Activity, ChevronDown } from "lucide-react";
import type { VoiceTelemetry } from "@/hooks/use-live-voice";
import type { VoicePersona } from "@/config/voicePersonas";
import {
  bridgeQuery,
  polyglotFirstClause,
  splitSentences,
  type DetectedLanguage,
  type LangCode,
} from "@/lib/language";
import {
  PolyglotAdaptiveChunker,
  detectLanguageAndRegister,
  getMultilingualEndpointTimeoutMs,
  normalizeCrossLingualRagQuery,
} from "@/lib/multilingualVoiceEngine";
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
export function VoiceOrb({
  telemetry,
  active,
  retrievingRef,
}: {
  telemetry: MutableRefObject<VoiceTelemetry>;
  active: boolean;
  retrievingRef: MutableRefObject<boolean>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState<OrbState>("idle");
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [theme, setTheme] = useState(() => document.documentElement.dataset["theme"] ?? "");
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(root.dataset["theme"] ?? ""));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 96,
      H = 96;
    c.width = W * dpr;
    c.height = H * dpr;
    g.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    // Tokens may be hex, rgb or oklch: wrapping hex in oklch produces an invalid
    // canvas color, leaving the browser's default black stroke in dark mode.
    const primary = css.getPropertyValue("--signal").trim();
    const muted = css.getPropertyValue("--foreground").trim();
    const freq = new Uint8Array(128);
    let raf = 0,
      last: OrbState = "idle";
    const draw = (now: number) => {
      const t = telemetry.current;
      const st = orbState(t, active, retrievingRef.current);
      if (st !== last) {
        last = st;
        setLabel(st);
      }
      g.clearRect(0, 0, W, H);
      const cx = W / 2,
        cy = H / 2;
      let r = 18;
      if (st === "listening") r += Math.min(14, t.micRms * 160);
      if (st === "thinking") r += Math.sin(now / 300) * 2;
      g.strokeStyle = st === "idle" ? muted : primary;
      g.fillStyle = st === "idle" ? muted : primary;
      g.globalAlpha = 0.3;
      g.beginPath();
      g.arc(cx, cy, r + 6, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      if (st === "speaking" && t.outAnalyser) {
        t.outAnalyser.getByteFrequencyData(freq);
        const bars = 48;
        for (let i = 0; i < bars; i++) {
          const v = (freq[Math.floor((i / bars) * 64)] ?? 0) / 255;
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
          g.beginPath();
          g.arc(cx, cy, r + 8, a0 + (k * Math.PI * 2) / 3, a0 + (k * Math.PI * 2) / 3 + 0.6);
          g.stroke();
        }
      }
      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [telemetry, active, retrievingRef, reducedMotion, theme]);
  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={ref}
        className="voice-orb__canvas"
        style={{ width: 96, height: 96 }}
        aria-hidden
      />
      <span
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
        aria-live="polite"
      >
        {label}
      </span>
    </div>
  );
}

export type Dispatch = { at: number; source: "voice" | "text"; action: UiAction; href: string };
export type PrefetchLog = { query: string; cache: string; ms: number };

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 border-b border-hairline py-1.5 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd
        className={`min-w-0 text-right tabular-nums ${warn ? "text-destructive" : "text-foreground"}`}
        style={{ overflowWrap: "anywhere" }}
      >
        {v}
      </dd>
    </div>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  return (
    <div
      className="h-1 w-full bg-border"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full bg-primary transition-[width] duration-75"
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  );
}

type Check = { name: string; status: "idle" | "running" | "pass" | "fail"; detail: string };
const CHECKS = [
  "AudioWorklet registration",
  "Mic AEC constraints",
  "Speculative RAG cache (<50ms)",
  "Turn-ID barge-in cancellation",
  "Generative UI scroll dispatch",
  "Background noise ignored (no false interrupt)",
];

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([
    p,
    new Promise<T>((_, r) => setTimeout(() => r(new Error(`timed out after ${ms}ms`)), ms)),
  ]);

async function checkWorklet(): Promise<string> {
  const ctx = new AudioContext();
  try {
    await ctx.audioWorklet.addModule("/voice-worklets.js");
    new AudioWorkletNode(ctx, "vad-processor");
    new AudioWorkletNode(ctx, "ring-player");
    return `vad-processor + ring-player registered @ ${ctx.sampleRate}Hz`;
  } finally {
    void ctx.close();
  }
}

async function checkMic(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 24000,
    },
  });
  try {
    const st = stream.getAudioTracks()[0]?.getSettings() ?? {};
    if (st.echoCancellation !== true)
      throw new Error(`echoCancellation=${String(st.echoCancellation)}`);
    return `AEC=${st.echoCancellation} NS=${String(st.noiseSuppression)} AGC=${String(st.autoGainControl)} ch=${st.channelCount ?? "?"} sr=${st.sampleRate ?? "?"}`;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

async function checkCache(): Promise<string> {
  const query = `system check ${Date.now()} does he know python fastapi`;
  const call = async () => {
    const r = await fetch("/api/prefetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
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
    let speaking = false,
      cutAt = 0;
    const result = new Promise<string>((resolve) => {
      node.port.onmessage = ({ data }) => {
        if (data.type !== "level") return;
        if (!speaking && data.rms > 0.05) {
          speaking = true;
          cutAt = performance.now();
          node.port.postMessage({ type: "flush" });
          node.port.postMessage({ type: "duck", on: true });
        } else if (speaking && data.rms < 0.001)
          resolve(`playback silenced ${Math.round(performance.now() - cutAt)}ms after interrupt`);
      };
    });
    const msg = await withTimeout(result, 3000);
    const ms = Number(msg.match(/(\d+)ms/)?.[1] ?? 999);
    if (ms > 60) throw new Error(msg);
    return msg;
  } finally {
    void ctx.close();
  }
}

async function checkNoiseRejection(): Promise<string> {
  const ctx = new AudioContext();
  try {
    await ctx.audioWorklet.addModule("/voice-worklets.js");
    await ctx.resume();
    const vad = new AudioWorkletNode(ctx, "vad-processor");
    const sink = ctx.createGain();
    sink.gain.value = 0;
    vad.connect(sink).connect(ctx.destination);
    let onsets = 0;
    vad.port.onmessage = ({ data }) => {
      if (data.type === "onset") onsets++;
    };
    // 1) Knocks: five 40ms noise bursts, 300ms apart.
    const burst = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.04), ctx.sampleRate);
    const d = burst.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * 0.6 * Math.exp(-i / (d.length / 4));
    for (let k = 0; k < 5; k++) {
      const src = ctx.createBufferSource();
      src.buffer = burst;
      src.connect(vad);
      src.start(ctx.currentTime + 0.1 + k * 0.3);
    }
    await new Promise((r) => setTimeout(r, 1800));
    const knockOnsets = onsets;
    // 2) Sustained voice-like tone (harmonic-rich, 160Hz) for 600ms.
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.value = 0.15;
    osc.connect(g).connect(vad);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    await new Promise((r) => setTimeout(r, 900));
    const voiceOnsets = onsets - knockOnsets;
    if (knockOnsets > 0) throw new Error(`${knockOnsets} false interruption(s) from knock sounds`);
    if (voiceOnsets < 1) throw new Error("sustained voice-like sound did not trigger");
    return "5 knocks ignored · sustained voice detected";
  } finally {
    void ctx.close();
  }
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
      try {
        hit = frame.contentDocument?.documentElement.dataset["cobrowseHit"];
      } catch {
        throw new Error("portfolio frame not readable");
      }
      if (hit)
        return `${actionLabel(action)} → #${hit} highlighted in ${Math.round(performance.now() - t0)}ms`;
    }
    throw new Error(`${href} did not highlight a target`);
  } finally {
    frame.remove();
  }
}

const RUNNERS = [
  checkWorklet,
  checkMic,
  checkCache,
  checkBargeIn,
  checkDispatch,
  checkNoiseRejection,
];

const ML_CHECKS = [
  "Engine: Hinglish detect (hi, code-switched)",
  "Engine: cross-lingual normalize (<5ms)",
  "Engine: chunker splits on । and 。",
  "Cross-lingual RAG bridge (Hindi → English, <50ms)",
  "Polyglot clause split (। and 。)",
  "Mid-turn voice hot-swap (no underruns)",
];
const HINDI_Q = "मुझे आपके Kubernetes और Terraform प्रोजेक्ट्स के बारे में बताइए";

async function checkBridge(): Promise<string> {
  const b = bridgeQuery(HINDI_Q);
  for (const t of ["kubernetes", "terraform", "projects"])
    if (!b.tokens.includes(t)) throw new Error(`missing English token "${t}"`);
  if (b.ms >= 25) throw new Error(`normalizer took ${b.ms}ms`);
  const call = async () => {
    const r = await fetch("/api/prefetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: HINDI_Q }),
    });
    if (!r.ok) throw new Error(`prefetch HTTP ${r.status}`);
    return (await r.json()) as { cache: string; ms: number; titles?: string[]; ids?: string[] };
  };
  await call();
  const t0 = performance.now();
  const warm = await call();
  const rtt = Math.round(performance.now() - t0);
  const k8s = (warm.titles ?? []).filter((t, i) =>
    /kubernetes|edwiser|licens|infra|stack/i.test(t + (warm.ids?.[i] ?? "")),
  );
  if (!k8s.length)
    throw new Error(
      `no Kubernetes chunk matched (got ${(warm.titles ?? []).join(", ") || "none"})`,
    );
  if (warm.ms >= 50) throw new Error(`warm retrieval ${warm.ms}ms`);
  return `tokens [${b.tokens.join(", ")}] in ${b.ms}ms → ${warm.cache} ${warm.ms}ms (rtt ${rtt}ms) → ${k8s.slice(0, 3).join(" · ")}. Terraform: not in portfolio, no chunk expected.`;
}

async function checkSplit(): Promise<string> {
  const hi = polyglotFirstClause(
    "Daniyal ने AI BotKit पर काम किया। उन्होंने Kubernetes पर licensing platform चलाया और 99.9% uptime रखा।",
  );
  if (hi.delimiter !== "।" || !hi.first.endsWith("।"))
    throw new Error(`Hindi split on ${String(hi.delimiter)}: "${hi.first}"`);
  const ja = polyglotFirstClause(
    "DaniyalはAI BotKitの中核部分を構築しました。千以上のサイトで稼働しているマルチチャネルのRAGチャットボットです。",
  );
  if (ja.delimiter !== "。")
    throw new Error(`Japanese split on ${String(ja.delimiter)}: "${ja.first}"`);
  const n = splitSentences("एक। दो। three. 四。").length;
  if (n !== 4) throw new Error(`sentence split gave ${n}, expected 4`);
  return `। → "${hi.first}" · 。 → "${ja.first}" · 4/4 mixed-script sentences`;
}

async function checkHotSwap(): Promise<string> {
  const ctx = new AudioContext();
  try {
    await ctx.audioWorklet.addModule("/voice-worklets.js");
    await ctx.resume();
    const node = new AudioWorkletNode(ctx, "ring-player", { outputChannelCount: [1] });
    const sink = ctx.createGain();
    sink.gain.value = 0;
    // Voice A then voice B: two oscillators at different pitches feed the same ring buffer.
    const a = ctx.createOscillator();
    a.frequency.value = 180;
    const b = ctx.createOscillator();
    b.frequency.value = 260;
    a.connect(node);
    node.connect(sink).connect(ctx.destination);
    a.start();
    let phase: "a" | "swapped" | "b" = "a",
      swapAt = 0,
      underrunsAtSwap = -1,
      resumeMs = -1;
    const result = new Promise<string>((resolve, reject) => {
      node.port.onmessage = ({ data }) => {
        if (data.type !== "level") return;
        if (phase === "a" && data.rms > 0.05) {
          phase = "swapped";
          swapAt = performance.now();
          underrunsAtSwap = data.underruns;
          node.port.postMessage({ type: "flush" }); // drop voice A's queued audio
          a.disconnect();
          b.connect(node);
          b.start();
        } else if (phase === "swapped" && data.rms > 0.05) {
          phase = "b";
          resumeMs = Math.round(performance.now() - swapAt);
          setTimeout(() => {
            node.port.onmessage = ({ data: d }) => {
              if (d.type !== "level") return;
              node.port.onmessage = null;
              const extra = d.underruns - underrunsAtSwap;
              if (extra > 0) reject(new Error(`${extra} underrun(s) after swap`));
              else
                resolve(
                  `buffer flushed, new voice audible in ${resumeMs}ms, 0 underruns over 500ms`,
                );
            };
          }, 500);
        }
      };
    });
    return await withTimeout(result, 4000);
  } finally {
    void ctx.close();
  }
}

async function checkEngineDetect(): Promise<string> {
  const d = detectLanguageAndRegister(
    "Mujhe aapke Kubernetes aur Terraform projects ke baare mein bataiye",
  );
  if (d.langCode !== "hi" || !d.isCodeSwitched)
    throw new Error(`got ${d.langCode}, codeSwitched=${d.isCodeSwitched}`);
  return `langCode=hi · isCodeSwitched=true · ${d.langName}`;
}

async function checkEngineNormalize(): Promise<string> {
  const n = normalizeCrossLingualRagQuery("मुझे आपके Kubernetes प्रोजेक्ट्स के बारे में बताइए");
  const q = n.englishSearchQuery.toLowerCase();
  for (const t of ["kubernetes", "projects"])
    if (!q.split(/\s+/).includes(t)) throw new Error(`missing "${t}" in "${n.englishSearchQuery}"`);
  if (n.normalizationTimeMs >= 5) throw new Error(`took ${n.normalizationTimeMs}ms`);
  return `"${n.englishSearchQuery}" in ${n.normalizationTimeMs}ms`;
}

async function checkEngineChunker(): Promise<string> {
  const hi = new PolyglotAdaptiveChunker();
  const a = hi.pushToken("उन्होंने काम किया। फिर");
  if (a[0] !== "उन्होंने काम किया।") throw new Error(`Devanagari gave ${JSON.stringify(a)}`);
  const ja = new PolyglotAdaptiveChunker();
  const b = ja.pushToken("こんにちは。次");
  if (b[0] !== "こんにちは。") throw new Error(`CJK gave ${JSON.stringify(b)}`);
  return `। → ${hi.lastFlushDelimiter} · 。 → ${ja.lastFlushDelimiter}`;
}

const ML_RUNNERS = [
  checkEngineDetect,
  checkEngineNormalize,
  checkEngineChunker,
  checkBridge,
  checkSplit,
  checkHotSwap,
];

function Checklist({ checks }: { checks: Check[] }) {
  return (
    <ul className="space-y-1">
      {checks.map((c) => (
        <li key={c.name} className="grid grid-cols-[48px_minmax(0,1fr)] gap-2">
          <span
            className={`border px-1 text-center ${c.status === "pass" ? "border-primary bg-primary text-primary-foreground" : c.status === "fail" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-muted-foreground"}`}
          >
            {c.status === "pass"
              ? "PASS"
              : c.status === "fail"
                ? "FAIL"
                : c.status === "running"
                  ? "…"
                  : "—"}
          </span>
          <span>
            <span className="text-foreground">{c.name}</span>
            {c.detail && (
              <span className="block break-words text-muted-foreground">{c.detail}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function runSuite(
  runners: (() => Promise<string>)[],
  set: (fn: (c: Check[]) => Check[]) => void,
) {
  for (let i = 0; i < runners.length; i++) {
    set((cs) => cs.map((c, j) => (j === i ? { ...c, status: "running", detail: "" } : c)));
    try {
      const detail = await withTimeout(runners[i]!(), 20000);
      set((cs) => cs.map((c, j) => (j === i ? { ...c, status: "pass", detail } : c)));
    } catch (e) {
      set((cs) =>
        cs.map((c, j) => (j === i ? { ...c, status: "fail", detail: (e as Error).message } : c)),
      );
    }
  }
}

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
  persona: VoicePersona;
  detected: DetectedLanguage | null;
  lock: LangCode | null;
  bridge: {
    raw: string;
    tokens: string[];
    normalized: string;
    ms: number;
    matched: string[];
  } | null;
  delimiter: string | null;
  swaps: number;
}) {
  const [mlChecks, setMlChecks] = useState<Check[]>(
    ML_CHECKS.map((name) => ({ name, status: "idle", detail: "" })),
  );
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const [checks, setChecks] = useState<Check[]>(
    CHECKS.map((name) => ({ name, status: "idle", detail: "" })),
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onEscape, true);
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => {
      document.removeEventListener("keydown", onEscape, true);
      clearInterval(id);
    };
  }, [open]);
  if (!import.meta.env.DEV) return null;
  const running =
    checks.some((c) => c.status === "running") || mlChecks.some((c) => c.status === "running");
  const runAll = () => runSuite(RUNNERS, setChecks);
  const runMl = () => runSuite(ML_RUNNERS, setMlChecks);
  const t = props.telemetry.current;
  const remaining =
    t.connectedAt && props.inCall ? Math.max(0, t.maxMs - (Date.now() - t.connectedAt)) : null;
  const fmt = (ms: number | null) => (ms === null ? "—" : `${Math.round(ms)}ms`);
  const mmss = (ms: number) =>
    `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const lastPrefetch = props.prefetch[props.prefetch.length - 1];
  const ragLabel = lastPrefetch
    ? lastPrefetch.cache === "hit"
      ? "SPECULATIVE CACHE HIT"
      : "HYBRID DB QUERY"
    : props.ragCache
      ? props.ragCache === "hit"
        ? "SPECULATIVE CACHE HIT"
        : "HYBRID DB QUERY"
      : "—";
  const ragMs = lastPrefetch ? lastPrefetch.ms : props.ragMs;
  const ttfaColor =
    t.ttfaMs === null
      ? "text-muted-foreground"
      : t.ttfaMs < 500
        ? "text-primary"
        : t.ttfaMs < 800
          ? "text-amber-400"
          : "text-destructive";
  const mode =
    props.endpointMs <= 400
      ? `Fast ${props.endpointMs}ms`
      : props.endpointMs >= 1100
        ? `Extended ${props.endpointMs}ms`
        : `Normal ${props.endpointMs}ms`;
  const fillPct = Math.min(100, (t.bufferMs / 1000) * 100);
  const lastTool = props.dispatches[props.dispatches.length - 1];
  const { at: _at, ...toolPayload } = lastTool ?? { at: 0 };
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="telemetry-hud"
        title="Telemetry (Ctrl+Shift+D)"
        className="telemetry-trigger fixed bottom-40 right-3 z-30 flex min-h-11 items-center gap-2 rounded-full border border-signal/60 bg-background/95 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-signal shadow-lg backdrop-blur-xl transition-colors hover:bg-primary hover:text-primary-foreground sm:right-4"
      >
        <Activity className="h-3.5 w-3.5" aria-hidden="true" /> Telemetry{" "}
        {remaining !== null && <span className="tabular-nums">· {mmss(remaining)}</span>}
      </button>
      {open && (
        <section
          id="telemetry-hud"
          role="dialog"
          aria-label="Voice and RAG telemetry"
          className="telemetry-popover fixed bottom-52 left-3 right-3 top-3 z-30 overflow-y-auto border border-hairline bg-card font-mono text-[11px] shadow-2xl sm:bottom-52 sm:left-auto sm:right-4 sm:top-auto sm:max-h-[70dvh] sm:w-[min(560px,calc(100vw-2rem))]"
        >
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-hairline bg-card px-3 py-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">voice & rag telemetry</span>
            <span className="ml-auto text-muted-foreground">ctrl+shift+d</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close telemetry"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>
          <div className="grid gap-px bg-border sm:grid-cols-2">
            <dl className="bg-card p-3">
              <p className="mb-1 text-primary">latency breakdown</p>
              <Row k="VAD detection" v={fmt(t.onsetDetectMs)} />
              <Row k="RAG retrieval" v={fmt(ragMs)} />
              <p
                className={`py-1 text-right ${ragLabel === "SPECULATIVE CACHE HIT" ? "text-primary" : "text-muted-foreground"}`}
              >
                {ragLabel}
              </p>
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
              <Row
                k="barge-ins"
                v={`${t.bargeIns}${t.lastBargeCutMs !== null ? ` · cut ${t.lastBargeCutMs}ms` : ""}`}
              />
              <Row
                k="AudioWorklet"
                v={t.worklet ? "Active" : props.inCall ? "Fallback" : "—"}
                warn={props.inCall && !t.worklet}
              />
              <Row k="ring buffer" v={`${fillPct.toFixed(1)}% (${t.bufferMs.toFixed(1)}ms)`} />
              <Meter value={fillPct} max={100} />
              <Row k="underruns" v={String(t.underruns)} warn={t.underruns > 0} />
              <Row k="mic rms · vad" v={`${t.micRms.toFixed(3)} · ${t.vad}`} />
              <Row k="endpointing" v={mode} />
            </dl>
          </div>
          <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
            <dl className="bg-card p-3">
              <p className="mb-1 text-primary">active voice persona</p>
              <Row k="persona" v={`${props.persona.badge} · ${props.persona.name}`} />
              <Row k="tts voice_id" v={props.persona.ttsVoice} />
              <Row k="live voice_id" v={props.persona.liveVoice} />
              <Row k="tts model" v={props.persona.ttsModel.split("/")[1]!} />
              <Row k="hot-swaps" v={String(props.swaps)} />
            </dl>
            <dl className="bg-card p-3">
              <p className="mb-1 text-primary">detected spoken language</p>
              <Row
                k="iso code"
                v={props.lock ? `${props.lock} (locked)` : (props.detected?.code ?? "—")}
              />
              <Row k="language" v={props.detected?.name ?? "—"} />
              <Row k="script" v={props.detected?.script ?? "—"} />
              <Row
                k="code-switching"
                v={
                  props.detected ? (props.detected.isCodeSwitched ? "ACTIVE (mixed)" : "off") : "—"
                }
              />
              <Row k="chunker flush on" v={props.delimiter ? `"${props.delimiter}"` : "—"} />
            </dl>
          </div>
          <div className="border-t border-border p-3">
            <p className="mb-1 text-primary">cross-lingual rag bridge</p>
            {props.bridge ? (
              <div className="space-y-1 text-muted-foreground">
                <p>
                  <span className="text-foreground">raw:</span> {props.bridge.raw}
                </p>
                <p>
                  <span className="text-foreground">→ english tokens:</span>{" "}
                  {props.bridge.tokens.length ? props.bridge.tokens.join(", ") : "(none needed)"}{" "}
                  <span className="tabular-nums">· {props.bridge.ms}ms</span>
                </p>
                <p>
                  <span className="text-foreground">→ matched chunks:</span>{" "}
                  {props.bridge.matched.join(" · ") || "none"}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">ask a question to populate</p>
            )}
          </div>
          {(() => {
            const raw = props.bridge?.raw ?? "";
            const d = raw ? detectLanguageAndRegister(raw) : null;
            const n = raw ? normalizeCrossLingualRagQuery(raw) : null;
            const ep = getMultilingualEndpointTimeoutMs(raw);
            return (
              <div className="border-t border-border p-3">
                <p className="mb-1 text-primary">multilingual voice engine</p>
                <dl>
                  <Row
                    k="active voice"
                    v={`${props.persona.name} · ${props.persona.ttsVoice} · ${props.persona.ttsModel.split("/")[1]!}`}
                  />
                  <Row
                    k="detected language"
                    v={
                      d
                        ? `${d.langName} (${d.langCode}, ${d.script}, Code-Switched: ${d.isCodeSwitched})`
                        : "—"
                    }
                  />
                  <Row
                    k="rag bridge"
                    v={n ? `${n.englishSearchQuery} (${n.normalizationTimeMs}ms)` : "—"}
                  />
                  <Row
                    k="chunker last flush"
                    v={props.delimiter ? `"${props.delimiter}"` : "none"}
                  />
                  <Row k="endpointing" v={raw ? ep.mode : "—"} />
                </dl>
              </div>
            );
          })()}
          <div className="border-t border-border p-3">
            <p className="mb-1 text-primary">last generative UI tool call</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
              {lastTool ? JSON.stringify(toolPayload, null, 1) : "none"}
            </pre>
          </div>
          <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center">
              <p className="text-primary">system check</p>
              <button
                type="button"
                onClick={runAll}
                disabled={running}
                className="ml-auto min-h-11 rounded-full border border-signal px-3 text-signal transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
              >
                {running ? "running…" : "Run System Check"}
              </button>
            </div>
            <Checklist checks={checks} />
          </div>
          <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center">
              <p className="text-primary">multilingual & voice check</p>
              <button
                type="button"
                onClick={runMl}
                disabled={running}
                className="ml-auto min-h-11 rounded-full border border-signal px-3 text-signal transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
              >
                {running ? "running…" : "Run Multilingual & Voice Check"}
              </button>
            </div>
            <Checklist checks={mlChecks} />
          </div>
        </section>
      )}
    </>
  );
}
