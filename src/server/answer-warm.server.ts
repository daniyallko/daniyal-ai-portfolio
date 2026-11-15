import { streamResponse } from "@lovable.dev/ai-gateway";
import { CHAT_MODEL as MODEL, CHAT_SYSTEM as SYSTEM } from "@/lib/prompt";
import { answerKey, canShareAnswer, canonicalQuery, corpusVersion, fingerprint } from "@/lib/rag-cache";
import { detectLanguage, replyLanguageHint } from "@/lib/language";
import { detectLanguageAndRegister } from "@/lib/multilingualVoiceEngine";
import { detectActions } from "@/lib/voice-logic";
import { makeEntry, persistCache, readCache } from "./rag-cache.server";
import { retrieve } from "./rag.server";

const g = globalThis as { __answerWarm?: Map<string, Promise<WarmReport>> };
const running = (g.__answerWarm ??= new Map());
export type WarmReport = { generated: number; cached: number; skipped: number; failed: number };

async function answerOne(q: string): Promise<"generated" | "cached" | "skipped" | "failed"> {
  if (!canShareAnswer(q, 0)) return "skipped";
  const key = answerKey(q, fingerprint(MODEL + SYSTEM));
  if (await readCache(key).catch(() => null)) return "cached";
  try {
    const t0 = Date.now();
    const r = await retrieve(q, 5);
    if (!r.sources.length) return "skipped";
    const detected = detectLanguage(q);
    const hint = replyLanguageHint(detected);
    const ctx = r.sources.map((s) => `[${s.n}] (${s.section}) ${s.title}\n${s.text}`).join("\n\n");
    const content = `${hint ? `REPLY LANGUAGE: ${hint.trim()}\n${detectLanguageAndRegister(q).systemPromptInstruction}\n\n` : ""}RETRIEVAL STATUS: ok\nSOURCES:\n${ctx}\n\nQUESTION: ${q}${hint}`;
    const s = await streamResponse({
      model: MODEL,
      instructions: SYSTEM,
      input: [{ role: "user", content }],
      reasoning: { effort: "none" },
    });
    let text = "";
    for await (const ev of s as AsyncIterable<{ type: string; delta?: string }>)
      if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
    if (!text.trim()) return "failed";
    const entry = makeEntry(key, canonicalQuery(q), r.sources, text, detectActions(q), detected.code);
    await persistCache(entry, Date.now() - t0);
    return "generated";
  } catch (e) {
    console.error("answer warm failed", q, e);
    return "failed";
  }
}

/** Pre-answers missing questions for the current corpus version; deduped per isolate. */
export function warmAnswers(questions: string[], concurrency = 4): Promise<WarmReport> {
  const id = `${corpusVersion()}:${fingerprint(questions.join("|"))}`;
  const existing = running.get(id);
  if (existing) return existing;
  const job = (async () => {
    const report: WarmReport = { generated: 0, cached: 0, skipped: 0, failed: 0 };
    const queue = [...questions];
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        for (let q = queue.shift(); q; q = queue.shift()) report[await answerOne(q)]++;
      }),
    );
    if (report.failed) running.delete(id);
    return report;
  })();
  running.set(id, job);
  return job;
}
