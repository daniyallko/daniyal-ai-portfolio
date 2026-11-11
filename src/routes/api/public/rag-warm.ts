import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/rag-warm")({
  server: {
    handlers: {
      POST: async () => {
        const { warmCorpus } = await import("@/server/rag.server");
        const { popularCache } = await import("@/server/rag-cache.server");
        try {
          const [corpus, popular] = await Promise.allSettled([warmCorpus(), popularCache()]);
          if (corpus.status === "rejected") console.error("rag-warm corpus failed", corpus.reason);
          if (popular.status === "rejected") console.error("rag-warm cache failed", popular.reason);
          if (corpus.status === "rejected" && popular.status === "rejected") throw corpus.reason;
          const chunksLoaded = corpus.status === "fulfilled" ? corpus.value : 0;
          const entries = popular.status === "fulfilled" ? popular.value : [];
          return Response.json(
            { status: "warmed", chunksLoaded, entries, topCachedQueries: entries.length },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (e) {
          console.error("rag-warm failed", e);
          return Response.json({ entries: [], error: "Warm-up unavailable" }, { status: 503 });
        }
      },
    },
  },
});
