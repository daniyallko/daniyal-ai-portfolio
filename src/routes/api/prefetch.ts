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
          const r = await retrieve(parsed.data.query);
          return Response.json({ cache: r.debug.cache ?? "miss", ms: Date.now() - t0, sources: r.sources.length, ids: r.sources.map((s) => s.id), titles: r.sources.map((s) => s.title), bridge: r.debug.bridge });
        } catch (e) {
          console.error(e);
          return Response.json({ error: "Prefetch failed" }, { status: 502 });
        }
      },
    },
  },
});
