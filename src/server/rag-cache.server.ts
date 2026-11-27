import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { BoundedCache, CACHE_TTL, corpusVersion, type CacheEntry } from "@/lib/rag-cache";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// L2 isolate RAM: survives across requests on a warm server, capped at 500 entries.
const g = globalThis as typeof globalThis & { __EDGE_RAG_L2__?: BoundedCache<CacheEntry> };
const hot = (g.__EDGE_RAG_L2__ ??= new BoundedCache<CacheEntry>(500));
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Public cache configuration unavailable");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
type Row = Database["public"]["Tables"]["rag_query_cache"]["Row"];
function fromRow(row: Row): CacheEntry | null {
  if (row.corpus_version !== corpusVersion() || Date.parse(row.expires_at) <= Date.now())
    return null;
  const sources = row.sources as unknown as CacheEntry["sources"];
  if (
    !Array.isArray(sources) ||
    !sources.every((s) => typeof s.id === "string" && typeof s.text === "string")
  )
    return null;
  return {
    key: row.cache_key,
    query: row.canonical_english_query,
    lang: row.lang_code,
    version: row.corpus_version,
    sources,
    text: row.response_text,
    tools: Array.isArray(row.tool_calls) ? row.tool_calls : [],
    expiresAt: Date.parse(row.expires_at),
  };
}
export async function readCache(
  key: string,
): Promise<{ entry: CacheEntry; tier: "L2" | "L3" } | null> {
  const existing = hot.get(key);
  if (existing) return { entry: existing, tier: "L2" };
  const { data, error } = await publicClient()
    .from("rag_query_cache")
    .select("*")
    .eq("cache_key", key)
    .maybeSingle();
  if (error) {
    console.error("Shared cache read failed", error.message);
    return null;
  }
  if (!data) return null;
  const entry = fromRow(data);
  if (!entry) return null;
  hot.set(key, entry, entry.expiresAt);
  return { entry, tier: "L3" };
}
export function remember(entry: CacheEntry) {
  hot.set(entry.key, entry, entry.expiresAt);
}
export async function persistCache(entry: CacheEntry, computeMs: number) {
  remember(entry);
  const { error } = await supabaseAdmin.from("rag_query_cache").upsert(
    {
      cache_key: entry.key,
      canonical_english_query: entry.query,
      lang_code: entry.lang,
      matched_chunk_ids: entry.sources.map((s) => s.id),
      retrieved_context: entry.sources.map((s) => `[${s.n}] ${s.title}\n${s.text}`).join("\n\n"),
      response_text: entry.text,
      sources: entry.sources as unknown as Json,
      tool_calls: entry.tools as Json,
      corpus_version: entry.version,
      compute_saved_ms: Math.round(computeMs),
      expires_at: new Date(entry.expiresAt).toISOString(),
    },
    { onConflict: "cache_key" },
  );
  if (error) throw new Error(error.message);
}
export async function touchCache(key: string) {
  const { error } = await supabaseAdmin.rpc("touch_rag_cache", { _key: key });
  if (error) throw new Error(error.message);
}
export async function popularCache(): Promise<CacheEntry[]> {
  const { data, error } = await publicClient()
    .from("rag_query_cache")
    .select("*")
    .eq("corpus_version", corpusVersion())
    .gt("expires_at", new Date().toISOString())
    .order("hit_count", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Cache hydration failed", error.message);
    return [];
  }
  return (data ?? []).flatMap((row) => {
    const entry = fromRow(row);
    if (!entry) return [];
    remember(entry);
    return [entry];
  });
}
export function makeEntry(
  key: string,
  query: string,
  sources: CacheEntry["sources"],
  text = "",
  tools: unknown[] = [],
  lang = "en",
): CacheEntry {
  return {
    key,
    query,
    sources,
    text,
    tools,
    lang,
    version: corpusVersion(),
    expiresAt: Date.now() + CACHE_TTL,
  };
}

/** Deletes shared cache rows from retired corpus versions or past expiry. */
export async function pruneStaleCache(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("rag_query_cache")
    .delete()
    .or(`corpus_version.neq.${corpusVersion()},expires_at.lt.${new Date().toISOString()}`);
  if (error) console.error("Cache prune failed", error.message);
}
