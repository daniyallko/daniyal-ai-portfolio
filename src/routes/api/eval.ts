import { createFileRoute } from "@tanstack/react-router";
import { streamResponse, GatewayError } from "@lovable.dev/ai-gateway";
import { golden } from "@/lib/golden";
import { CHAT_MODEL, CHAT_SYSTEM } from "@/lib/prompt";
import {
  mrr,
  factCoverage,
  missingFacts,
  citationStats,
  qualityScore,
  retrievalOutcomeScore,
  noContextAnswerScore,
} from "@/lib/eval-metrics";

export type EvalResult = {
  id: string;
  question: string;
  answer: string;
  error?: string;
  retrieved: string[];
  expected: string[];
  recall: number;
  mrr: number;
  facts: number;
  missing: string[];
  citeCoverage: number;
  citations: number;
  invalidCitations: number;
  quality: number;
  latency: { retrieve: number; firstToken: number | null; total: number };
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const p95 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)] ?? 0;
};

export const Route = createFileRoute("/api/eval")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { retrieve } = await import("@/server/rag.server");
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
            const results: EvalResult[] = [];
            for (const c of golden) {
              if (request.signal.aborted) break;
              const t0 = Date.now();
              let answer = "",
                error: string | undefined,
                firstToken: number | null = null,
                retrieved: string[] = [],
                tRet = 0,
                nSources = 0;
              try {
                const r = await retrieve(c.question);
                tRet = Date.now() - t0;
                retrieved = r.sources.map((s) => s.id);
                nSources = r.sources.length;
                const ctx =
                  r.sources
                    .map((s) => `[${s.n}] (${s.section}) ${s.title}\n${s.text}`)
                    .join("\n\n") || "(no relevant sources)";
                const tL = Date.now();
                const s = await streamResponse(
                  {
                    model: CHAT_MODEL,
                    instructions: CHAT_SYSTEM,
                    input: [
                      {
                        role: "user",
                        content: `RETRIEVAL STATUS: ${nSources ? "ok" : "no_reliable_context"}\nSOURCES:\n${ctx}\n\nQUESTION: ${c.question}`,
                      },
                    ],
                    reasoning: { effort: "low" },
                  },
                  { signal: request.signal },
                );
                for await (const ev of s as AsyncIterable<{ type: string; delta?: string }>) {
                  if (ev.type === "response.output_text.delta" && ev.delta) {
                    firstToken ??= Date.now() - tL;
                    answer += ev.delta;
                  }
                }
              } catch (e) {
                error = e instanceof GatewayError ? e.message : "Evaluation call failed";
                console.error(e);
              }
              const cs = citationStats(answer, nSources);
              const facts = factCoverage(answer, c.mustMention);
              const honestNoContext = c.expectNoContext ? noContextAnswerScore(answer) : 0;
              const citeCoverage = c.expectNoContext && honestNoContext ? 1 : cs.coverage;
              const res: EvalResult = {
                id: c.id,
                question: c.question,
                answer,
                ...(error ? { error } : {}),
                retrieved,
                expected: c.expectedChunks,
                recall: retrievalOutcomeScore(
                  retrieved,
                  c.expectedChunks,
                  c.expectNoContext ? answer : undefined,
                ),
                mrr: mrr(retrieved, c.expectedChunks),
                facts,
                missing: missingFacts(answer, c.mustMention),
                citeCoverage,
                citations: cs.citations,
                invalidCitations: cs.invalid,
                quality: qualityScore(facts, cs.coverage, cs.invalid),
                latency: { retrieve: tRet, firstToken, total: Date.now() - t0 },
              };
              results.push(res);
              send({ type: "case", result: res });
              if (error) break; // stop on gateway failure instead of hammering it
            }
            const totals = results.map((r) => r.latency.total);
            const summary = {
              cases: results.length,
              quality: avg(results.map((r) => r.quality)),
              facts: avg(results.map((r) => r.facts)),
              citeCoverage: avg(results.map((r) => r.citeCoverage)),
              recall: avg(results.map((r) => r.recall)),
              mrr: avg(results.map((r) => r.mrr)),
              latencyAvg: avg(totals),
              latencyP95: p95(totals),
              firstTokenAvg: avg(results.map((r) => r.latency.firstToken ?? 0)),
            };
            if (results.length === golden.length) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { error } = await supabaseAdmin.from("eval_runs").insert({
                model: CHAT_MODEL,
                summary: summary as never,
                results: results as never,
              });
              if (error) console.error("save eval run failed", error.message);
            }
            send({ type: "done", summary });
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" },
        });
      },
    },
  },
});
