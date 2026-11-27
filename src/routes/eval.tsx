import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, FlaskConical, Play, Square } from "lucide-react";
import { listEvalRuns } from "@/lib/eval.functions";
import { golden } from "@/lib/golden";
import { ThemeToggle } from "@/components/theme-toggle";
import type { EvalResult } from "./api/eval";

export const Route = createFileRoute("/eval")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title: "RAG Evaluation — Daniyal's Recruiter Assistant" },
      {
        name: "description",
        content:
          "Golden-set evaluation of answer quality, citation coverage, retrieval relevance and latency.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "RAG Evaluation — Daniyal's Recruiter Assistant" },
      {
        property: "og:description",
        content: "Answer quality, citations, retrieval and latency across the golden test set.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvalPage,
});

type Summary = {
  cases: number;
  quality: number;
  facts: number;
  citeCoverage: number;
  recall: number;
  mrr: number;
  latencyAvg: number;
  latencyP95: number;
  firstTokenAvg: number;
};
type Run = {
  id: string;
  model: string;
  created_at: string;
  summary: Summary;
  results: EvalResult[];
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ms = (x: number | null) =>
  x == null ? "—" : x >= 1000 ? `${(x / 1000).toFixed(1)}s` : `${Math.round(x)}ms`;
const tone = (x: number) =>
  x >= 0.85 ? "text-signal" : x >= 0.6 ? "text-chart-3" : "text-destructive";

function EvalPage() {
  const qc = useQueryClient();
  const { data: raw = [] } = useQuery({ queryKey: ["eval-runs"], queryFn: () => listEvalRuns() });
  const runs: Run[] = useMemo(
    () =>
      raw.map((r) => ({ ...r, summary: JSON.parse(r.summary), results: JSON.parse(r.results) })),
    [raw],
  );
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
    setRunning(true);
    setErr(null);
    setLive([]);
    ac.current = new AbortController();
    try {
      const res = await fetch("/api/eval", { method: "POST", signal: ac.current.signal });
      if (!res.body) throw new Error("No response");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const l of lines) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l);
          if (ev.type === "case") {
            setLive((x) => [...(x ?? []), ev.result]);
            if (ev.result.error) setErr(ev.result.error);
          }
        }
      }
      await qc.invalidateQueries({ queryKey: ["eval-runs"] });
      setLive(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background bg-grid">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-hairline pb-5">
          <Link
            to="/chat"
            className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to chat
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Quality observatory
            </span>
            <ThemeToggle />
          </div>
        </header>

        <section
          className="mt-8 flex flex-col gap-6 lg:mt-12 lg:flex-row lg:items-end lg:justify-between"
          aria-labelledby="eval-title"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-signal">
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              Retrieval / response diagnostics
            </p>
            <h1
              id="eval-title"
              className="mt-4 font-serif text-4xl leading-none tracking-[-0.025em] sm:text-5xl lg:text-6xl"
            >
              Evaluation <span className="italic text-signal">/ golden set</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              {golden.length} fixed recruiter questions ·{" "}
              {runs[0]
                ? `last run ${new Date(runs[0].created_at).toLocaleString()} · ${runs[0].model}`
                : "no saved runs yet"}
              {prev && " · deltas vs previous run"}
            </p>
          </div>
          {running ? (
            <button
              type="button"
              onClick={() => ac.current?.abort()}
              className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 border border-destructive/50 bg-destructive/10 px-5 font-mono text-xs text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              Stop evaluation ({live?.length ?? 0}/{golden.length})
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 bg-primary px-5 font-mono text-xs font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-18px_var(--signal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:transform-none"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Run evaluation
            </button>
          )}
        </section>

        <div aria-live="polite" className="sr-only">
          {running
            ? `Evaluation running: ${live?.length ?? 0} of ${golden.length} cases complete`
            : ""}
        </div>
        {err && (
          <p
            role="alert"
            className="mt-6 border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive"
            style={{ overflowWrap: "anywhere" }}
          >
            {err}
          </p>
        )}

        {summary ? (
          <section
            className="mt-8 grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-5"
            aria-label="Latest evaluation summary"
          >
            <Tile label="Answer quality" v={summary.quality} p={prev?.summary.quality} />
            <Tile
              label="Citation coverage"
              v={summary.citeCoverage}
              p={prev?.summary.citeCoverage}
            />
            <Tile
              label="Recall @ 5"
              v={summary.recall}
              p={prev?.summary.recall}
              sub={`MRR ${summary.mrr.toFixed(2)}`}
            />
            <Tile label="Fact coverage" v={summary.facts} p={prev?.summary.facts} />
            <div className="col-span-2 bg-card p-4 sm:col-span-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Latency avg / p95
              </p>
              <p className="tnum mt-3 font-mono text-xl font-semibold">
                {ms(summary.latencyAvg)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {ms(summary.latencyP95)}
                </span>
              </p>
              <p className="tnum mt-1 font-mono text-[11px] text-muted-foreground">
                first token {ms(summary.firstTokenAvg)}
                {prev && (
                  <Delta d={(prev.summary.latencyAvg - summary.latencyAvg) / 1000} unit="s" />
                )}
              </p>
            </div>
          </section>
        ) : (
          <section
            className="surface mt-8 border-dashed p-6 text-sm leading-6 text-muted-foreground sm:p-8"
            aria-label="Empty evaluation state"
          >
            <p className="font-serif text-2xl text-foreground">No baseline yet.</p>
            <p className="mt-2 max-w-xl">
              Run the golden set to measure answer quality, citation integrity, retrieval relevance,
              and response latency. Results appear case by case.
            </p>
          </section>
        )}

        <section className="mt-8" aria-labelledby="case-results-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="case-results-title" className="font-serif text-2xl">
                Case signals
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Expand any completed case to inspect its answer and retrieval path.
              </p>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {current.length}/{golden.length} complete
            </p>
          </div>
          <div
            role="region"
            aria-label="Golden case results"
            tabIndex={0}
            className="overflow-x-auto border border-hairline bg-card outline-none scrollbar-thin focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table className="w-full min-w-[960px] border-collapse font-mono text-xs">
              <caption className="sr-only">
                Golden evaluation cases in fixed test-set order. Activate a case question for answer
                details.
              </caption>
              <thead className="border-b border-hairline bg-secondary/45 text-muted-foreground">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium uppercase tracking-[0.12em]"
                  >
                    Case
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-medium uppercase tracking-[0.12em]"
                  >
                    Quality
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-medium uppercase tracking-[0.12em]"
                  >
                    Facts
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-medium uppercase tracking-[0.12em]"
                  >
                    Cites
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-medium uppercase tracking-[0.12em]"
                  >
                    Recall
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-medium uppercase tracking-[0.12em]"
                  >
                    MRR
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-medium uppercase tracking-[0.12em]"
                  >
                    1st tok
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-medium uppercase tracking-[0.12em]"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {golden.map((g, index) => {
                  const r = current.find((x) => x.id === g.id);
                  const p = prevById.get(g.id);
                  const expanded = open === g.id && !!r;
                  const toggle = () => {
                    if (r) setOpen(open === g.id ? null : g.id);
                  };
                  return (
                    <Fragment key={g.id}>
                      <tr
                        className={`border-b border-hairline/70 transition-colors ${expanded ? "bg-accent/35" : r ? "hover:bg-secondary/35" : "opacity-45"}`}
                      >
                        <td className="w-[380px] px-4 py-2 font-sans text-sm">
                          <button
                            type="button"
                            disabled={!r}
                            aria-label={`Details for ${g.question}`}
                            aria-expanded={expanded}
                            aria-controls={`case-${g.id}-details`}
                            onClick={toggle}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter" && e.key !== " ") return;
                              e.preventDefault();
                              toggle();
                            }}
                            className="group flex min-h-11 w-full cursor-pointer items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default"
                          >
                            <span className="tnum w-6 shrink-0 font-mono text-[10px] text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0 flex-1 leading-5">
                              <span className="sr-only">Details for </span>
                              {g.question}
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-signal ${expanded ? "rotate-180 text-signal" : ""}`}
                              aria-hidden="true"
                            />
                          </button>
                        </td>
                        {r ? (
                          <>
                            <Cell v={r.quality} p={p?.quality} />
                            <Cell v={r.facts} p={p?.facts} />
                            <Cell v={r.citeCoverage} p={p?.citeCoverage} />
                            <Cell v={r.recall} p={p?.recall} />
                            <td className={`tnum px-3 py-3 text-center ${tone(r.mrr)}`}>
                              {r.mrr.toFixed(2)}
                            </td>
                            <td className="tnum px-3 py-3 text-center">
                              {ms(r.latency.firstToken)}
                            </td>
                            <td className="tnum px-3 py-3 text-center">{ms(r.latency.total)}</td>
                          </>
                        ) : (
                          <td colSpan={7} className="px-3 py-3 text-center text-muted-foreground">
                            {running ? "pending…" : "—"}
                          </td>
                        )}
                      </tr>
                      {expanded && r && (
                        <tr className="border-b border-hairline bg-background/70">
                          <td
                            colSpan={8}
                            id={`case-${g.id}-details`}
                            className="px-5 py-5 sm:px-8 sm:py-6"
                          >
                            <div className="grid gap-5 lg:grid-cols-2">
                              <DetailList
                                label="Expected chunks"
                                items={r.expected}
                                present={r.retrieved}
                              />
                              <DetailList
                                label="Retrieved chunks"
                                items={r.retrieved}
                                present={r.expected}
                              />
                            </div>
                            {r.missing.length > 0 && (
                              <p className="mt-5 border-l-2 border-destructive pl-3 text-destructive">
                                Missing facts: {r.missing.join(", ")}
                              </p>
                            )}
                            <p className="mt-5 font-mono text-[11px] leading-5 text-muted-foreground">
                              {r.citations} citations
                              {r.invalidCitations ? `, ${r.invalidCitations} invalid` : ""} ·
                              retrieval {ms(r.latency.retrieve)}
                            </p>
                            <div className="mt-4 border-l-2 border-signal/60 pl-4">
                              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
                                Generated answer
                              </p>
                              <p
                                className="whitespace-pre-wrap font-sans text-sm leading-7 text-foreground/90"
                                style={{ overflowWrap: "anywhere" }}
                              >
                                {r.error ?? r.answer}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-4 max-w-4xl font-mono text-[10px] leading-5 text-muted-foreground">
          Quality = 50% facts mentioned + 30% sentences cited + 20% no invalid citations. Wide
          results scroll inside the labelled table region.
        </p>
      </div>
    </main>
  );
}

function summarize(rs: EvalResult[]): Summary {
  const a = (f: (r: EvalResult) => number) =>
    rs.length ? rs.reduce((s, r) => s + f(r), 0) / rs.length : 0;
  const t = rs.map((r) => r.latency.total).sort((x, y) => x - y);
  return {
    cases: rs.length,
    quality: a((r) => r.quality),
    facts: a((r) => r.facts),
    citeCoverage: a((r) => r.citeCoverage),
    recall: a((r) => r.recall),
    mrr: a((r) => r.mrr),
    latencyAvg: a((r) => r.latency.total),
    latencyP95: t[Math.max(0, Math.ceil(t.length * 0.95) - 1)] ?? 0,
    firstTokenAvg: a((r) => r.latency.firstToken ?? 0),
  };
}

function Delta({ d, unit = "pp" }: { d: number; unit?: string }) {
  const v = unit === "pp" ? Math.round(d * 100) : +d.toFixed(1);
  if (!v) return null;
  return (
    <span
      className={`ml-1.5 ${v > 0 ? "text-signal" : "text-destructive"}`}
      aria-label={`${v > 0 ? "Up" : "Down"} ${Math.abs(v)}${unit}`}
    >
      {v > 0 ? "+" : "−"}
      {Math.abs(v)}
      {unit}
    </span>
  );
}

function Tile({
  label,
  v,
  p,
  sub,
}: {
  label: string;
  v: number;
  p?: number | undefined;
  sub?: string;
}) {
  return (
    <div className="bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={`tnum mt-3 font-mono text-xl font-semibold ${tone(v)}`}>
        {pct(v)}
        {p != null && (
          <span className="text-xs font-normal">
            <Delta d={v - p} />
          </span>
        )}
      </p>
      {sub && <p className="tnum mt-1 font-mono text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Cell({ v, p }: { v: number; p?: number | undefined }) {
  return (
    <td className={`tnum px-3 py-3 text-center ${tone(v)}`}>
      {pct(v)}
      {p != null && <Delta d={v - p} />}
    </td>
  );
}

function DetailList({
  label,
  items,
  present,
}: {
  label: string;
  items: string[];
  present: string[];
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((item) => (
            <Chip key={item} ok={present.includes(item)}>
              {item}
            </Chip>
          ))
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </div>
    </div>
  );
}

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex max-w-full items-center border px-2 py-1 font-mono text-[10px] leading-4 ${ok ? "border-signal/35 bg-accent/50 text-signal" : "border-hairline bg-secondary/50 text-muted-foreground"}`}
      style={{ overflowWrap: "anywhere" }}
    >
      {children}
    </span>
  );
}
