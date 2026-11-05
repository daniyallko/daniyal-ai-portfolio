import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const amIAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!data };
  });

export const adminListVisitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: visitors }, { data: threads }] = await Promise.all([
      supabaseAdmin.from("visitors").select("*").order("last_seen", { ascending: false }).limit(500),
      supabaseAdmin.from("chat_threads").select("id, visitor_id, title, updated_at").order("updated_at", { ascending: false }).limit(2000),
    ]);
    const byVisitor = new Map<string, { id: string; title: string; updated_at: string }[]>();
    for (const t of threads ?? []) {
      const arr = byVisitor.get(t.visitor_id) ?? [];
      arr.push({ id: t.id, title: t.title, updated_at: t.updated_at });
      byVisitor.set(t.visitor_id, arr);
    }
    const known = new Set((visitors ?? []).map((v) => v.id));
    const rows = (visitors ?? []).map((v) => ({ ...v, threads: byVisitor.get(v.id) ?? [] }));
    // Visitors who chatted before visit tracking existed.
    for (const [vid, ts] of byVisitor) if (!known.has(vid)) rows.push({ id: vid, first_seen: ts[ts.length - 1]!.updated_at, last_seen: ts[0]!.updated_at, visits: 0, ip: null, country: null, city: null, user_agent: null, referrer: null, language: null, landing_path: null, threads: ts });
    return rows;
  });

export const adminGetThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: msgs, error } = await supabaseAdmin.from("chat_messages").select("id, role, content, created_at, debug").eq("thread_id", data.threadId).order("created_at");
    if (error) throw new Error(error.message);
    return (msgs ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at, voice: (m.debug as { via?: string } | null)?.via === "voice" }));
  });

const docInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  section: z.string().trim().min(1).max(60).default("Documents"),
  content: z.string().trim().min(20).max(200_000),
  source_type: z.enum(["text", "pdf"]).default("text"),
});

async function reindex() {
  const { warmCorpus } = await import("@/server/rag.server");
  const t0 = Date.now();
  await warmCorpus(true);
  const { buildChunks } = await import("@/lib/portfolio");
  return { chunks: buildChunks().length, ms: Date.now() - t0 };
}

export const adminListKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("kb_documents").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { buildChunks, chunkDocument, setExtraChunks } = await import("@/lib/portfolio");
    setExtraChunks([]);
    const base = buildChunks().map((c) => ({ id: c.id, section: c.section, title: c.title, text: c.text }));
    setExtraChunks((data ?? []).flatMap((d) => chunkDocument(d)));
    return { docs: (data ?? []).map((d) => ({ ...d, chunks: chunkDocument(d).length })), base };
  });

export const adminSaveKbDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => docInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = { title: data.title, section: data.section, content: data.content, source_type: data.source_type, updated_at: new Date().toISOString() };
    const { error } = data.id
      ? await context.supabase.from("kb_documents").update(row).eq("id", data.id)
      : await context.supabase.from("kb_documents").insert(row);
    if (error) throw new Error(error.message);
    return reindex();
  });

export const adminDeleteKbDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("kb_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return reindex();
  });

export const adminReindexKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => { await assertAdmin(context); return reindex(); });
