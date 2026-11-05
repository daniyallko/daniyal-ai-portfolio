# RAG cache audit — 5 November 2026

Baseline measured locally before changes: first `/api/prefetch` request **3,835ms retrieval / 3,838ms HTTP**, repeat **0ms retrieval / 3.09ms HTTP**. These are single samples, not production percentiles. No live audio latency was measured.

| System | Before | Paths and bottleneck |
|---|---|---|
| Proactive page-load warming | MISSING | `src/routes/__root.tsx` tracks visits but does not warm RAG. First query pays DB + embedding latency. |
| Browser L1 RAM + persistent hydration | MISSING | `src/routes/chat.$threadId.tsx` has no RAG browser cache; visitor localStorage is identity, not a cache. |
| Isolate L2 hot corpus + Q&A | PARTIAL | `src/server/rag.server.ts`: 100 query promises / 5-minute TTL; uncached questions refetch all `kb_embeddings`. No answer cache. |
| Shared persistent L3 | MISSING | `kb_embeddings` persists corpus vectors only; no query/answer cache. |
| Write-behind persistence | MISSING | `src/server/rag.server.ts` waits for embedding upsert; `src/routes/api/chat.ts` persists after generation. |
| Speculative typing / interim speech | PARTIAL | `src/routes/chat.$threadId.tsx`: 250ms voice-interim debounce; typing not wired. `/api/prefetch` awaits computation. |

## Implementation boundaries
- Four tiers: browser RAM, browser localStorage, bounded isolate RAM, shared database. Isolate RAM is expendable acceleration, never durable storage.
- Public retrieval entries contain portfolio source text only. Global answers are restricted to independently answerable public-vocabulary questions, generated without conversation history. Private/contextual questions continue streaming normally and are not published to shared cache.
- Retrieval keys preserve meaningful words, numbers, negation and entities. Known multilingual topic aliases reuse retrieval; different response language/script/register uses different answer keys. Arbitrary semantic equivalence is not claimed without model work.
- Corpus + prompt/model versions invalidate stale entries. Browser hits remain server-validated and messages remain saved to the current isolated thread.
- Page warming loads the corpus and popular public entries, not an LLM call per visit. Typed/interim queries warm retrieval only.
- Worker `ctx.waitUntil` is registered per request, with request-level `waitUntil` support and an awaited fallback when unavailable. No Edge Functions added: this project uses TanStack server handlers.
- Native live voice still uses its existing full-portfolio session prompt and delegated RAG. Retrieval warming helps delegation; cached text does not replace native WebRTC speech.

## Targets, not guarantees
5–35ms applies to hot lookup, not global network delivery, fresh inference, transcription, TTS or cold worker scheduling. Cold starts cannot be eliminated on every isolate by a previous visitor.