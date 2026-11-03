<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Portfolio + recruiter chatbot
- `src/lib/portfolio.ts` is the single source of truth for portfolio content; the chatbot knowledge base is derived from it via `buildChunks()` — edit content there only.
- Retrieval is hybrid (BM25 + embeddings fused with RRF) in `src/lib/retrieval.ts`; chunk embeddings are cached server-side in `kb_embeddings`, keyed by content hash, so changed content re-embeds automatically.
- Chat threads are anonymous per browser (localStorage visitor UUID); all chat tables are RLS-locked and accessed only through server code that checks visitor_id. Why: recruiters shouldn't need accounts.
- Chat streams NDJSON from `/api/chat` (sources → deltas → done) so citations and dev-mode debug data arrive alongside text.
- Evaluation: golden cases live in `src/lib/golden.ts`, scoring in `src/lib/eval-metrics.ts` (pure, tested); `/api/eval` runs cases sequentially with the shared prompt from `src/lib/prompt.ts` and saves complete runs to `eval_runs`, so `/eval` compares against the previous run.
- Voice: real-time calls go browser → `/api/live` WebSocket relay (`src/lib/live-relay.server.ts`, dispatched in `src/server.ts`, Vite dev via `live-vite-plugin.ts`) → Gateway Live over WebRTC; the full portfolio is embedded in session instructions so answers start instantly, with RAG delegation as a fallback. Recorded questions go to `/api/transcribe` and then through the normal text chat. Why: lowest latency with native barge-in, while staying grounded.
- Read-aloud: each answer has a listen button that posts its text to `/api/speak`, which strips markdown via `prepareForSpeech()` in `src/lib/speech.ts` (pure, tested) and returns WAV from the Gateway speech model; `src/hooks/use-speech.ts` keeps one answer playing at a time and stops for sends, recording, and live calls. Why: spoken answers must not double up or talk over a call.
