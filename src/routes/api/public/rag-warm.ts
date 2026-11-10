import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/rag-warm")({
  server: {
    handlers: {
      POST: async () => {
        const { warmCorpus } = await import("@/server/rag.server");
        const { popularCache } = await import("@/server/rag-cache.server");
        try {
          const [chunksLoaded, entries] = await Promise.all([warmCorpus(), popularCache()]);
          return Response.json(
            { status: "warmed", chunksLoaded, entries, topCachedQueries: entries.length },
            { headers: { "cache-control": "no-store" } },
          );
        } catch {
          return Response.json({ entries: [], error: "Warm-up unavailable" }, { status: 503 });
        }
      },
    },
  },
});
