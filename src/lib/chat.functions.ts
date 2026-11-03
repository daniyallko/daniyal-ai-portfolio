import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const V = z.object({ visitorId: z.string().uuid() });
const VT = V.extend({ threadId: z.string().uuid() });

export const listThreads = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => V.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("chat_threads").select("id, title, updated_at").eq("visitor_id", data.visitorId).order("updated_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => V.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("chat_threads").insert({ visitor_id: data.visitorId }).select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VT.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("chat_threads").select("id, title").eq("id", data.threadId).eq("visitor_id", data.visitorId).maybeSingle();
    if (!t) return null;
    const { data: msgs, error } = await supabaseAdmin.from("chat_messages").select("id, role, content, sources, debug").eq("thread_id", t.id).order("created_at");
    if (error) throw new Error(error.message);
    return { ...t, messages: (msgs ?? []) as { id: string; role: string; content: string; sources: unknown; debug: unknown }[] };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VT.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("chat_threads").delete().eq("id", data.threadId).eq("visitor_id", data.visitorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
