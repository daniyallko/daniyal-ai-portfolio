import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const V = z.object({ visitorId: z.string().uuid() });
const VT = V.extend({ threadId: z.string().uuid() });

export const listThreads = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => V.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("chat_threads")
      .select("id, title, updated_at")
      .eq("visitor_id", data.visitorId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => V.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({ visitor_id: data.visitorId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VT.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("chat_threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("visitor_id", data.visitorId)
      .maybeSingle();
    if (!t) return null;
    const { data: msgs, error } = await supabaseAdmin
      .from("chat_messages")
      .select("id, role, content, sources, debug")
      .eq("thread_id", t.id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return {
      ...t,
      messages: (msgs ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources ? JSON.stringify(m.sources) : null,
        debug: m.debug ? JSON.stringify(m.debug) : null,
      })),
    };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VT.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("chat_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("visitor_id", data.visitorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const Turns = VT.extend({
  turns: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(60),
});

// Persist a finished voice call's turns into the same thread as text chat.
export const appendVoiceTurns = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Turns.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("chat_threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("visitor_id", data.visitorId)
      .maybeSingle();
    if (!t) throw new Error("Thread not found");
    if (!data.turns.length) return { ok: true };
    const base = Date.now();
    const rows = data.turns.map((m, i) => ({
      thread_id: t.id,
      role: m.role,
      content: m.content,
      debug: { via: "voice" } as never,
      created_at: new Date(base + i).toISOString(),
    }));
    const { error } = await supabaseAdmin.from("chat_messages").insert(rows);
    if (error) throw new Error(error.message);
    const firstUser = data.turns.find((m) => m.role === "user");
    await supabaseAdmin
      .from("chat_threads")
      .update({
        updated_at: new Date().toISOString(),
        ...(t.title === "New chat" && firstUser
          ? { title: `voice: ${firstUser.content.slice(0, 56)}` }
          : {}),
      })
      .eq("id", t.id);
    const userTurns = data.turns.filter((m) => m.role === "user");
    if (userTurns.length) {
      const { notifyOwner, shortId } = await import("@/lib/telegram.server");
      await notifyOwner([
        `🎙️ Voice call from visitor ${shortId(data.visitorId)} (${userTurns.length} question${userTurns.length > 1 ? "s" : ""})`,
        "",
        ...userTurns.map((m) => `• ${m.content}`),
      ]);
    }
    return { ok: true };
  });
