import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/rag-warm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { warmCorpus } = await import("@/server/rag.server");
        const { popularCache } = await import("@/server/rag-cache.server");
        try {
          const [corpus, popular] = await Promise.allSettled([warmCorpus(), popularCache()]);
          if (corpus.status === "rejected") console.error("rag-warm corpus failed", corpus.reason);
          if (popular.status === "rejected") console.error("rag-warm cache failed", popular.reason);
          if (corpus.status === "rejected" && popular.status === "rejected") throw corpus.reason;
          if (corpus.status === "fulfilled") {
            // Pre-answer recruiter questions in the background; no-op once cached for this corpus version.
            const { warmAnswers, prerecordAnswerAudio } = await import("@/server/answer-warm.server");
            const { WARM_TIER1, WARM_TIER2 } = await import("@/lib/warm-questions");
            const { defer } = await import("@/lib/background.server");
            await defer(request, warmAnswers(WARM_TIER1)
                .then(() => prerecordAnswerAudio(WARM_TIER1))
                .then(() => warmAnswers(WARM_TIER2)));
          }
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
