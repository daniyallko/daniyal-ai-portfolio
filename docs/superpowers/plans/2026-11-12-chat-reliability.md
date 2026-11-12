# Portfolio Chat Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add abuse controls, bounded memory, explicit retrieval/failure outcomes, safer document chunks, paired follow-up retrieval, and contact escalation to the existing portfolio chatbot.

**Architecture:** Keep the current routes and RAG stack. Add pure helpers for testable policies, one server module for rolling summaries, one server module for atomic rate limiting, and one SQL migration for their persisted state.

**Tech Stack:** TypeScript, TanStack Start, Supabase/Postgres, Vitest, existing Lovable AI gateway.

**Spec:** `docs/superpowers/specs/2026-11-12-chat-reliability-design.md`

## Global Constraints

- Keep `src/lib/portfolio.ts` as the portfolio content source of truth.
- Keep BM25 + embeddings + RRF and NDJSON streaming.
- Do not add SaaS billing, tenancy, LangGraph, Pinecone, or human-handover infrastructure.
- Do not commit or push; the user did not request commits.
- Preserve existing comments unless a changed implementation makes one inaccurate.

## Review Focus

- Concurrent requests must share one atomic rate-limit bucket and fail closed on limiter errors.
- Provider errors and aborted partial answers must never re-enter model history or shared caches.
- Summary batching must not repeatedly summarize the same rows or drop the verbatim tail.
- Overlapped admin chunks must remain at most 900 characters and empty documents must produce no chunks.
- Off-topic turns must not increment the no-context streak; two no-context turns must expose contact.

---

### Task 1: Pure ingestion, retrieval, and evaluation policies

**Files:**
- Modify: `src/lib/portfolio.ts`
- Modify: `src/lib/kb-docs.test.ts`
- Modify: `src/lib/retrieval.ts`
- Modify: `src/lib/retrieval.test.ts`
- Modify: `src/lib/golden.ts`
- Modify: `src/lib/eval-metrics.ts`
- Modify: `src/lib/eval-metrics.test.ts`
- Modify: `src/routes/api/eval.ts`

**Interfaces:**
- Produces: `mergeSources<T extends { id: string; n: number }>(primary: T[], secondary: T[], topK?: number): T[]`.
- Produces: `retrievalOutcomeScore(retrieved: string[], expected: string[]): number`.
- Extends golden cases with optional `expectNoContext: true`.

- [ ] Write failing tests for adjacent-chunk overlap, 900-character bounds, empty input, source deduplication/renumbering, and empty-expected rejection scoring.
- [ ] Run `npx vitest run src/lib/kb-docs.test.ts src/lib/retrieval.test.ts src/lib/eval-metrics.test.ts` and confirm the new assertions fail.
- [ ] Implement bounded 120-character overlap for admin chunks, generic source merging, rejection scoring, and negative golden cases.
- [ ] Make `/api/eval` use rejection scoring and include `no_reliable_context` in its generated input when no sources survive.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Atomic API rate limits

**Files:**
- Create: `drizzle/migrations/0005_chat_reliability.sql`
- Create: `drizzle/migrations/meta/0005_snapshot.json`
- Modify: `drizzle/migrations/meta/_journal.json`
- Modify: `src/integrations/supabase/types.ts`
- Create: `src/server/rate-limit.server.ts`
- Create: `src/server/rate-limit.test.ts`
- Modify: `src/routes/api/chat.ts`
- Modify: `src/routes/api/speak.ts`
- Modify: `src/routes/api/transcribe.ts`
- Modify: `src/lib/live-relay.server.ts`

**Interfaces:**
- Produces: `enforceRateLimit(request: Request, policies: RatePolicy[]): Promise<Response | null>`.
- `RatePolicy` contains `scope`, `identity?`, `limit`, and `windowSeconds`.
- SQL produces `consume_rate_limit(_key text, _limit integer, _window_seconds integer)` returning `allowed`, `remaining`, and `retry_after`.

- [ ] Write failing mocked-RPC tests for allowed requests, `429`/`Retry-After`, hashed identities, and fail-closed `503` responses.
- [ ] Run `npx vitest run src/server/rate-limit.test.ts` and confirm failure.
- [ ] Add the migration, generated-type updates, and server helper. Use HMAC-SHA256 keys and atomic capped upserts.
- [ ] Enforce chat IP + visitor policies, uncached speech IP limits, transcription IP limits, and production live-upgrade IP limits before paid work.
- [ ] Re-run the rate-limit tests and TypeScript checking.

### Task 3: Bounded rolling chat memory

**Files:**
- Create: `src/lib/chat-memory.ts`
- Create: `src/lib/chat-memory.test.ts`
- Create: `src/server/chat-memory.server.ts`
- Modify: `src/routes/api/chat.ts`

**Interfaces:**
- Produces: `planChatMemory(history, totalCount, priorSummary, priorSummaryCount)` returning recent usable history, older messages to fold, and the new summary count.
- Produces: `prepareChatMemory(...)` using the existing gateway and persisting thread summaries conditionally.
- Consumes: `memory_summary` and `memory_message_count` from Task 2.

- [ ] Write failing tests for short histories, six-message fold batches, summary reuse, failed-turn filtering, bounded content, and no repeated folds.
- [ ] Run `npx vitest run src/lib/chat-memory.test.ts` and confirm failure.
- [ ] Implement the pure planner and gateway-backed folder. Keep at most six recent messages, fold every six messages, cap summary/history content, and preserve the previous summary on failure.
- [ ] Fetch only the latest 24 rows plus exact count in `/api/chat`; prepare memory alongside retrieval and add the summary as clearly labelled conversation data.
- [ ] Re-run memory and chat-related tests.

### Task 4: Turn outcomes, paired follow-ups, and escalation

**Files:**
- Create: `src/lib/chat-turn.ts`
- Create: `src/lib/chat-turn.test.ts`
- Modify: `src/lib/prompt.ts`
- Modify: `src/routes/api/chat.ts`

**Interfaces:**
- Produces: `ChatOutcome = "ok" | "no_reliable_context" | "off_topic" | "aborted" | "provider_error"`.
- Produces: `usableChatHistory(...)`, `unansweredStreak(...)`, and `followupQuery(...)`.
- Consumes: `mergeSources` from Task 1 and memory from Task 3.

- [ ] Write failing tests for failed-history filtering, streak reset/neutral behavior, follow-up expansion, and second-failure escalation.
- [ ] Run `npx vitest run src/lib/chat-turn.test.ts` and confirm failure.
- [ ] Implement pure turn policies and explicit no-context/off-topic prompt instructions.
- [ ] Integrate paired retrieval, outcome debug fields, contact link/action after two failures, and empty-assistant persistence protection.
- [ ] Keep successful-only answer caching and exclude aborted/provider-error rows from later history.
- [ ] Re-run turn, retrieval, cache, and thread-view tests.

### Task 5: Full verification

**Files:**
- Modify only files with demonstrated failures from the preceding tasks.

- [ ] Run `npm test` and confirm every test passes.
- [ ] Run `npm run lint` and resolve introduced findings.
- [ ] Run `npm run build` and confirm production compilation succeeds.
- [ ] Review `git diff --check` and the final diff for accidental content or API-contract changes.
- [ ] Report the migration path and any gateway/database integration checks that remain unrun.
