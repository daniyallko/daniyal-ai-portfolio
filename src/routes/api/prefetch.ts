import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({ query: z.string().trim().min(3).max(500) });

// Speculative RAG warm-up from interim voice transcripts. Returns only timing/cache info.
export const Route = createFileRoute("/api/prefetch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const { retrieve } = await import("@/server/rag.server");
        const t0 = Date.now();
        try {
          const r = await retrieve(parsed.data.query, 5, request);
          const { retrievalKey } = await import("@/lib/rag-cache");
          const { makeEntry } = await import("@/server/rag-cache.server");
          const entry = makeEntry(retrievalKey(parsed.data.query), r.sources.map((s) => s.title).join(" | "), r.sources);
          const payload = { cache: r.debug.cache ?? "miss", ms: Date.now() - t0, entry, sources: r.sources.length, ids: r.sources.map((s) => s.id), titles: r.sources.map((s) => s.title), bridge: r.debug.bridge };
          const { drainDeferred } = await import("@/lib/background.server");
          const stream = new ReadableStream({ async start(controller) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(payload)));
            await drainDeferred(request);
            controller.close();
          } });
          return new Response(stream, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
        } catch (e) {
          console.error(e);
          return Response.json({ error: "Prefetch failed" }, { status: 502 });
        }
      },
    },
  },
});
