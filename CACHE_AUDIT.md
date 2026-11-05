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

## Verification
- 31 focused tests passed: cache eligibility, privacy, language/register keys, translated topic labels, negation/numbers, prompt invalidation, TTL/LRU bounds and deferred-write lifecycle plus existing multilingual/retrieval tests.
- Browser: page-load warming returned 200; typing warmed retrieval; first public answer streamed and entered browser/shared caches; reloading restored saved conversation.
- A separate browser visitor could not open the first visitor's thread. The same standalone question in the second visitor's new thread reused L2 output with citations and persisted independently.
- Hot retrieval measured **2ms / 4.73ms HTTP** after changes. Two cached answer checks took **1,613–4,080ms server / 2,271–4,844ms UI flow**, including ownership/history/message database operations. Instant lookup is not instant end-to-end response.
- Database readback confirmed two cache rows, one completed public answer, and hit count incremented to two.
- Browser cache skips already warmed speculative retrieval and provides answer key hints; server validates entries before delivering cached answers, not an unsafe bypass of session persistence.
- Live spoken caching was not verified. Arbitrary semantic/cross-language equivalence and sub-35ms full answer delivery remain outside the deterministic safe implementation.