import { generateEmbeddings } from "@lovable.dev/ai-gateway";
import { buildChunks, type Chunk } from "@/lib/portfolio";
import { normalizeQueryKey } from "@/lib/voice-logic";
import { bridgeQuery } from "@/lib/language";
import { detectLanguageAndRegister, normalizeCrossLingualRagQuery } from "@/lib/multilingualVoiceEngine";
import { bm25Scores, cosine, hybridRank } from "@/lib/retrieval";
import { retrievalKey } from "@/lib/rag-cache";
import { makeEntry, readCache, remember, persistCache } from "@/server/rag-cache.server";
import { defer } from "@/lib/background.server";

const EMBED_MODEL = "google/gemini-embedding-2";

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

async function embed(texts: string[]): Promise<number[][]> {
  const res = await generateEmbeddings({ model: EMBED_MODEL, input: texts });
  return (res as unknown as { data: { embedding: number[] }[] }).data.map((d) => d.embedding);
}

let corpusHot: { version: string; until: number; value: Promise<Map<string, number[]>> } | undefined;
async function chunkEmbeddings(chunks: Chunk[]): Promise<Map<string, number[]>> {
  const version = hash(JSON.stringify(chunks));
  if (corpusHot?.version === version && corpusHot.until > Date.now()) return corpusHot.value;
  const value = loadChunkEmbeddings(chunks);
  corpusHot = { version, until: Date.now() + 5 * 60_000, value };
  try { return await value; } catch (error) { corpusHot = undefined; throw error; }
}
export async function warmCorpus() { await chunkEmbeddings(buildChunks()); }
async function loadChunkEmbeddings(chunks: Chunk[]): Promise<Map<string, number[]>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("kb_embeddings").select("chunk_id, content_hash, embedding");
  if (error) throw new Error(error.message);
  const map = new Map<string, number[]>();
  const have = new Map((data ?? []).map((r) => [r.chunk_id, r]));
  const missing: Chunk[] = [];
  for (const c of chunks) {
    const row = have.get(c.id);
    if (row && row.content_hash === hash(c.title + c.text)) map.set(c.id, row.embedding as number[]);
    else missing.push(c);
  }
  if (missing.length) {
    const vecs = await embed(missing.map((c) => `${c.title}\n${c.text}`));
    const rows = missing.map((c, i) => {
      const embedding = vecs[i];
      if (!embedding) throw new Error("Missing corpus embedding");
      return { chunk_id: c.id, content_hash: hash(c.title + c.text), embedding, updated_at: new Date().toISOString() };
    });
    const { error: upErr } = await supabaseAdmin.from("kb_embeddings").upsert(rows);
    if (upErr) console.error("kb_embeddings upsert failed", upErr.message);
    missing.forEach((c, i) => { const vector = vecs[i]; if (vector) map.set(c.id, vector); });
  }
  return map;
}

export type Source = { n: number; id: string; section: string; title: string; text: string };
export type RetrievalDebug = {
  query: string;
  timingsMs: { embed: number; retrieve: number };
  bridge?: { raw: string; tokens: string[]; normalized: string; ms: number };
  candidates: { id: string; title: string; bm25: number; dense: number; bm25Rank: number | null; denseRank: number | null; rrf: number; kept: boolean }[];
};

// Warm in-memory cache keyed by normalized query tokens (speculative prefetch + repeat questions).
const CACHE_TTL = 5 * 60_000;
const warm = new Map<string, { at: number; value: Promise<{ sources: Source[]; debug: RetrievalDebug }> }>();

export async function retrieve(rawQuery: string, topK = 5, request?: Request): Promise<{ sources: Source[]; debug: RetrievalDebug & { cache?: string } }> {
  // Cross-lingual bridge: non-English queries gain canonical English search terms (deterministic, no LLM).
  const b = bridgeQuery(rawQuery);
  const isEnglish = detectLanguageAndRegister(rawQuery).langCode === "en";
  const n = isEnglish ? null : normalizeCrossLingualRagQuery(rawQuery);
  const extra = n ? n.englishSearchQuery.split(" ").filter((t) => !b.tokens.includes(t)) : [];
  const tokens = [...b.tokens, ...extra];
  const query = extra.length ? `${b.normalized} ${extra.join(" ")}` : b.normalized;
  const bridge = { raw: rawQuery, tokens, normalized: query, ms: +(b.ms + (n?.normalizationTimeMs ?? 0)).toFixed(2) };
  const key = retrievalKey(rawQuery, topK);
  const now = Date.now();
  for (const [k, v] of warm) if (now - v.at > CACHE_TTL) warm.delete(k);
  const hit = warm.get(key);
  if (hit) {
    try {
      const r = await hit.value;
      return { sources: r.sources, debug: { ...r.debug, query, bridge, cache: "hit", timingsMs: { embed: 0, retrieve: Date.now() - now } } };
    } catch { warm.delete(key); }
  }
  const value = (async () => {
    const cached = await readCache(key).catch(() => null);
    if (cached) {
      return { sources: cached.entry.sources, debug: { query, bridge, cache: cached.tier, candidates: [], timingsMs: { embed: 0, retrieve: Date.now() - now } } };
    }
    const result = await retrieveUncached(query, topK);
    if (result.sources.length) {
      // Publish corpus text only, never transcripts or private query qualifiers.
      const entry = makeEntry(key, result.sources.map((s) => s.title).join(" | "), result.sources);
      remember(entry);
      if (request) await defer(request, persistCache(entry, Date.now() - now));
      else await persistCache(entry, Date.now() - now).catch((error: unknown) => console.error("RAG persistence failed", error));
    }
    return result;
  })();
  warm.set(key, { at: now, value });
  while (warm.size > 100) { const k = warm.keys().next().value; if (k === undefined) break; warm.delete(k); }
  try {
    const r = await value;
    return { sources: r.sources, debug: { ...r.debug, bridge, cache: "cache" in r.debug ? String(r.debug.cache) : "miss" } };
  } catch (e) { warm.delete(key); throw e; }
}

async function retrieveUncached(query: string, topK: number): Promise<{ sources: Source[]; debug: RetrievalDebug }> {
  const chunks = buildChunks();
  const t0 = Date.now();
  const [vecMap, [qv]] = await Promise.all([chunkEmbeddings(chunks), embed([query])]);
   const qvec = qv;
   if (!qvec) throw new Error("Missing query embedding");
  const t1 = Date.now();
  const dense = chunks.map((c) => cosine(qvec, vecMap.get(c.id) ?? []));
  const sparse = bm25Scores(query, chunks);
  const ranked = hybridRank(chunks, sparse, dense);
  // Relevance gate: keep top-K with some lexical or semantic signal.
  const kept = new Set(ranked.filter((r) => r.bm25 > 0 || r.dense > 0.35).slice(0, topK).map((r) => r.chunk.id));
  const sources = ranked.filter((r) => kept.has(r.chunk.id)).map((r, i) => ({ n: i + 1, id: r.chunk.id, section: r.chunk.section, title: r.chunk.title, text: r.chunk.text }));
  return {
    sources,
    debug: {
      query,
      timingsMs: { embed: t1 - t0, retrieve: Date.now() - t1 },
      candidates: ranked.slice(0, 10).map((r) => ({
        id: r.chunk.id, title: r.chunk.title, bm25: +r.bm25.toFixed(3), dense: +r.dense.toFixed(3),
        bm25Rank: isFinite(r.bm25Rank) ? r.bm25Rank : null, denseRank: isFinite(r.denseRank) ? r.denseRank : null,
        rrf: +r.rrf.toFixed(5), kept: kept.has(r.chunk.id),
      })),
    },
  };
}
