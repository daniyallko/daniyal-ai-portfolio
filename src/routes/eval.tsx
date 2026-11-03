import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useRef, useState } from "react";
import { ArrowLeft, Play, Square } from "lucide-react";
import { listEvalRuns } from "@/lib/eval.functions";
import { golden } from "@/lib/golden";
import type { EvalResult } from "./api/eval";

export const Route = createFileRoute("/eval")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "RAG Evaluation — Daniyal's Recruiter Assistant" },
      { name: "description", content: "Golden-set evaluation of answer quality, citation coverage, retrieval relevance and latency." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "RAG Evaluation — Daniyal's Recruiter Assistant" },
      { property: "og:description", content: "Answer quality, citations, retrieval and latency across the golden test set." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvalPage,
});

type Summary = { cases: number; quality: number; facts: number; citeCoverage: number; recall: number; mrr: number; latencyAvg: number; latencyP95: number; firstTokenAvg: number };
type Run = { id: string; model: string; created_at: string; summary: Summary; results: EvalResult[] };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ms = (x: number | null) => (x == null ? "—" : x >= 1000 ? `${(x / 1000).toFixed(1)}s` : `${Math.round(x)}ms`);
const tone = (x: number) => (x >= 0.85 ? "text-primary" : x >= 0.6 ? "text-chart-3" : "text-destructive");

function EvalPage() {
  const qc = useQueryClient();
  const { data: raw = [] } = useQuery({ queryKey: ["eval-runs"], queryFn: () => listEvalRuns() });
  const runs: Run[] = useMemo(() => raw.map((r) => ({ ...r, summary: JSON.parse(r.summary), results: JSON.parse(r.results) })), [raw]);
  const [live, setLive] = useState<EvalResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const ac = useRef<AbortController | null>(null);

  const current = live ?? runs[0]?.results ?? [];
  const prev = live ? runs[0] : runs[1];
  const prevById = new Map(prev?.results.map((r) => [r.id, r]));
  const summary = live ? summarize(live) : runs[0]?.summary;

  const run = async () => {
    setRunning(true); setErr(null); setLive([]);
    ac.current = new AbortController();
    try {
      const res = await fetch("/api/eval", { method: "POST", signal: ac.current.signal });
      if (!res.body) throw new Error("No response");
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop()!;
        for (const l of lines) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l);
          if (ev.type === "case") { setLive((x) => [...(x ?? []), ev.result]); if (ev.result.error) setErr(ev.result.error); }
        }
      }
      await qc.invalidateQueries({ queryKey: ["eval-runs"] });
      setLive(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr((e as Error).message);
    } finally { setRunning(false); }
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/chat" className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />chat</Link>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">eval<span className="text-primary">::</span>golden_set</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {golden.length} cases · {runs[0] ? `last run ${new Date(runs[0].created_at).toLocaleString()} · ${runs[0].model}` : "no runs yet"}
              {prev && " · Δ vs previous run"}
            </p>
          </div>
          {running ? (
            <button onClick={() => ac.current?.abort()} className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 font-mono text-sm"><Square className="h-3.5 w-3.5" />stop ({live?.length ?? 0}/{golden.length})</button>
          ) : (
            <button onClick={run} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-mono text-sm text-primary-foreground hover:bg-primary/90"><Play className="h-3.5 w-3.5" />run eval</button>
          )}
        </div>
        {err && <p className="mt-4 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{err}</p>}

        {summary && (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile label="answer quality" v={summary.quality} p={prev?.summary.quality} />
            <Tile label="citation coverage" v={summary.citeCoverage} p={prev?.summary.citeCoverage} />
            <Tile label="retrieval recall@5" v={summary.recall} p={prev?.summary.recall} sub={`MRR ${summary.mrr.toFixed(2)}`} />
            <Tile label="fact coverage" v={summary.facts} p={prev?.summary.facts} />
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">latency avg / p95</p>
              <p className="mt-1 font-mono text-xl font-bold">{ms(summary.latencyAvg)} <span className="text-sm text-muted-foreground">/ {ms(summary.latencyP95)}</span></p>
              <p className="font-mono text-[11px] text-muted-foreground">first token {ms(summary.firstTokenAvg)}{prev && <Delta d={(prev.summary.latencyAvg - summary.latencyAvg) / 1000} unit="s" />}</p>
            </div>
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full font-mono text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">case</th><th className="px-2">quality</th><th className="px-2">facts</th><th className="px-2">cites</th>
                <th className="px-2">recall</th><th className="px-2">mrr</th><th className="px-2">1st tok</th><th className="px-2">total</th>
              </tr>
            </thead>
            <tbody>
              {golden.map((g) => {
                const r = current.find((x) => x.id === g.id);
                const p = prevById.get(g.id);
                return (
                  <Fragment key={g.id}>
                    <tr onClick={() => r && setOpen(open === g.id ? null : g.id)} className={`border-b border-border/60 ${r ? "cursor-pointer hover:bg-secondary/50" : "opacity-40"}`}>
                      <td className="max-w-[320px] truncate px-3 py-2 font-sans text-sm" title={g.question}>{g.question}</td>
                      {r ? (
                        <>
                          <Cell v={r.quality} p={p?.quality} /><Cell v={r.facts} p={p?.facts} /><Cell v={r.citeCoverage} p={p?.citeCoverage} />
                          <Cell v={r.recall} p={p?.recall} /><td className={`px-2 text-center ${tone(r.mrr)}`}>{r.mrr.toFixed(2)}</td>
                          <td className="px-2 text-center">{ms(r.latency.firstToken)}</td><td className="px-2 text-center">{ms(r.latency.total)}</td>
                        </>
                      ) : (
                        <td colSpan={7} className="px-2 text-center text-muted-foreground">{running ? "pending…" : "—"}</td>
                      )}
                    </tr>
                    {open === g.id && r && (
                      <tr className="border-b border-border/60 bg-background/40">
                        <td colSpan={8} className="space-y-2 px-3 py-3">
                          <p><span className="text-muted-foreground">expected:</span> {r.expected.map((e) => <Chip key={e} ok={r.retrieved.includes(e)}>{e}</Chip>)}</p>
                          <p><span className="text-muted-foreground">retrieved:</span> {r.retrieved.map((e) => <Chip key={e} ok={r.expected.includes(e)}>{e}</Chip>)}</p>
                          {r.missing.length > 0 && <p className="text-destructive">missing facts: {r.missing.join(", ")}</p>}
                          <p className="text-muted-foreground">{r.citations} citations{r.invalidCitations ? `, ${r.invalidCitations} invalid` : ""} · retrieval {ms(r.latency.retrieve)}</p>
                          <p className="whitespace-pre-wrap font-sans text-sm text-foreground/90">{r.error ?? r.answer}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">quality = 50% facts mentioned + 30% sentences cited + 20% no invalid citations · click a row for details</p>
      </div>
    </div>
  );
}

function summarize(rs: EvalResult[]): Summary {
  const a = (f: (r: EvalResult) => number) => (rs.length ? rs.reduce((s, r) => s + f(r), 0) / rs.length : 0);
  const t = rs.map((r) => r.latency.total).sort((x, y) => x - y);
  return { cases: rs.length, quality: a((r) => r.quality), facts: a((r) => r.facts), citeCoverage: a((r) => r.citeCoverage), recall: a((r) => r.recall), mrr: a((r) => r.mrr), latencyAvg: a((r) => r.latency.total), latencyP95: t[Math.max(0, Math.ceil(t.length * 0.95) - 1)] ?? 0, firstTokenAvg: a((r) => r.latency.firstToken ?? 0) };
}

function Delta({ d, unit = "pp" }: { d: number; unit?: string }) {
  const v = unit === "pp" ? Math.round(d * 100) : +d.toFixed(1);
  if (!v) return null;
  return <span className={`ml-1.5 ${v > 0 ? "text-primary" : "text-destructive"}`}>{v > 0 ? "▲" : "▼"}{Math.abs(v)}{unit}</span>;
}

function Tile({ label, v, p, sub }: { label: string; v: number; p?: number | undefined; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold ${tone(v)}`}>{pct(v)}{p != null && <span className="text-xs font-normal"><Delta d={v - p} /></span>}</p>
      {sub && <p className="font-mono text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Cell({ v, p }: { v: number; p?: number | undefined }) {
  return <td className={`px-2 py-2 text-center ${tone(v)}`}>{pct(v)}{p != null && <Delta d={v - p} />}</td>;
}

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={`mr-1 rounded px-1.5 py-0.5 ${ok ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}>{children}</span>;
}
