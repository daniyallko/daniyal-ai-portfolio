import { createFileRoute } from "@tanstack/react-router";
import { streamResponse, GatewayError } from "@lovable.dev/ai-gateway";
import { z } from "zod";

const Body = z.object({
  threadId: z.string().uuid(),
  visitorId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
});

const MODEL = "openai/gpt-6-astra";

const SYSTEM = `You are the portfolio assistant for Mohd Daniyal, a Full Stack AI Engineer. You talk to recruiters and hiring managers.
Rules:
- Answer ONLY from the numbered SOURCES provided. If the sources don't cover it, say so briefly and suggest contacting Daniyal at daniyallko@gmail.com.
- Cite every factual claim inline with the source number in square brackets, e.g. "He built the RAG pipeline [2]." Use multiple like [1][3]. Never invent source numbers.
- Be concise, confident and specific (numbers, technologies). Use short paragraphs or bullets in markdown. Refer to him as Daniyal.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const { threadId, visitorId, message } = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { retrieve } = await import("@/server/rag.server");

        const { data: thread } = await supabaseAdmin.from("chat_threads").select("id, title").eq("id", threadId).eq("visitor_id", visitorId).maybeSingle();
        if (!thread) return Response.json({ error: "Thread not found" }, { status: 404 });

        const { data: history, error: hErr } = await supabaseAdmin.from("chat_messages").select("role, content").eq("thread_id", threadId).order("created_at");
        if (hErr) return Response.json({ error: hErr.message }, { status: 500 });

        const { error: insErr } = await supabaseAdmin.from("chat_messages").insert({ thread_id: threadId, role: "user", content: message });
        if (insErr) return Response.json({ error: insErr.message }, { status: 500 });
        if (thread.title === "New chat") {
          await supabaseAdmin.from("chat_threads").update({ title: message.slice(0, 60) }).eq("id", threadId);
        }

        // Query reformulation: fold the previous user turn in for short follow-ups.
        const prevUser = [...(history ?? [])].reverse().find((m) => m.role === "user")?.content;
        const query = message.split(/\s+/).length < 8 && prevUser ? `${prevUser} ${message}` : message;

        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
            const t0 = Date.now();
            let text = "";
            let sources: unknown = [];
            let debug: Record<string, unknown> = {};
            try {
              const r = await retrieve(query);
              sources = r.sources;
              debug = { ...r.debug, model: MODEL };
              send({ type: "sources", sources: r.sources, debug });
              const ctx = r.sources.map((s) => `[${s.n}] (${s.section}) ${s.title}\n${s.text}`).join("\n\n") || "(no relevant sources)";
              const input = [
                ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
                { role: "user" as const, content: `SOURCES:\n${ctx}\n\nQUESTION: ${message}` },
              ];
              const tLlm = Date.now();
              let firstToken: number | null = null;
              const s = await streamResponse({ model: MODEL, instructions: SYSTEM, input, reasoning: { effort: "low" }, store: false }, { signal: request.signal });
              let usage: unknown = null;
              for await (const ev of s as AsyncIterable<{ type: string; delta?: string; response?: { usage?: unknown } }>) {
                if (ev.type === "response.output_text.delta" && ev.delta) {
                  firstToken ??= Date.now() - tLlm;
                  text += ev.delta;
                  send({ type: "delta", text: ev.delta });
                } else if (ev.type === "response.completed") usage = ev.response?.usage ?? null;
              }
              debug = { ...debug, timingsMs: { ...(debug.timingsMs as object), firstToken, total: Date.now() - t0 }, usage };
              send({ type: "done", debug });
            } catch (e) {
              const msg = e instanceof GatewayError ? e.message : "Something went wrong generating the answer.";
              console.error(e);
              send({ type: "error", message: msg });
              if (!text) text = `_Error: ${msg}_`;
            } finally {
              const { error } = await supabaseAdmin.from("chat_messages").insert({ thread_id: threadId, role: "assistant", content: text, sources: sources as never, debug: debug as never });
              if (error) console.error("save assistant failed", error.message);
              await supabaseAdmin.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
              controller.close();
            }
          },
        });
        return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" } });
      },
    },
  },
});
