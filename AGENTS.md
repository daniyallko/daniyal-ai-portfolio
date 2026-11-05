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
- Voice Phase 2: mic VAD and playback run in AudioWorklets (`public/voice-worklets.js`); `use-live-voice.ts` flushes the ring buffer on local speech onset, keeps a turn_id/telemetry ref, and enforces idle/budget cutoffs; pure helpers (endpointing, first-clause split, action detection, guardrail) live in `src/lib/voice-logic.ts` (tested). Why: barge-in and metrics must not depend on React renders.
- RAG caching uses browser RAM/localStorage, bounded expendable isolate RAM, and `rag_query_cache`; version corpus and prompt/model keys, share only standalone public-vocabulary answers generated without history, and persist with request-scoped waitUntil plus awaited fallback. Why: fast reuse must not publish private context or stale facts. Page load warms corpus/popular entries; typing/interim speech warms retrieval. Co-browsing actions open `?hl=<id>` or `?skill=<tech>`.
- Multilingual voice: personas live in `src/config/voicePersonas.ts` (live + TTS voice ids); language ID, the cross-lingual query bridge, polyglot clause chunking and localized fillers are pure helpers in `src/lib/language.ts` (tested). `retrieve()` always bridges the query to English tokens first. Live-call voices are fixed per session, so a mid-call persona change reconnects; read-aloud re-synthesizes the unplayed clauses. Why: the knowledge base is English-only and the gateway models are multilingual.
- Owner alerts: visits (`trackVisit` in `src/lib/visit.functions.ts`, called from `__root`), chat messages (`/api/chat`) and voice turns (`appendVoiceTurns`) are sent to Telegram via `src/lib/telegram.server.ts`. Admin console `/admin` (under `_authenticated`) reads all visitors/threads through `src/lib/admin.functions.ts` after a `has_role` admin check; the first account ever created is granted admin by a database trigger. Why: owner-only visibility without exposing other visitors' chats.
- Admin-added RAG sources live in `kb_documents`; `src/server/kb-docs.server.ts` loads them into `buildChunks()` via `setExtraChunks`, so corpus version, embeddings and caches invalidate automatically. PDFs are text-extracted in the browser (unpdf) for review before saving.
- Homepage dock → chat handoff: the hero command dock on `/` stores `{q|call}` in sessionStorage `daniyal.pending.v1`, fades the hero, then navigates to `/chat`; `chat.$threadId.tsx` consumes it once the thread loads. Why: the thread view owns all voice/RAG/telemetry bindings, so the homepage never duplicates them.
