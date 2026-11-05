import { chunkDocument, setExtraChunks } from "@/lib/portfolio";

let loaded: { until: number; value: Promise<void> } | undefined;
/** Loads admin documents into the shared corpus (60s per-isolate refresh). */
export function syncDocuments(force = false): Promise<void> {
  if (!force && loaded && loaded.until > Date.now()) return loaded.value;
  const value = (async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("kb_documents").select("id, title, section, content").order("created_at");
    if (error) throw new Error(error.message);
    setExtraChunks((data ?? []).flatMap((d) => chunkDocument(d)));
  })();
  loaded = { until: Date.now() + 60_000, value };
  value.catch((e) => { loaded = undefined; console.error("KB document sync failed", e); });
  return value;
}
