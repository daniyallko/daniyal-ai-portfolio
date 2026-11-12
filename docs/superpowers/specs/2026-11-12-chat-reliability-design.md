# Portfolio Chat Reliability Design

**Date:** 2026-11-12
**Status:** Approved by the user's request to implement the preceding recommendations.

## Intent

Make the existing recruiter chatbot safer and more reliable without replacing its TanStack Start, Supabase, BM25 + embeddings + RRF, or NDJSON architecture.

## Goals

- Apply atomic server-side rate limits before paid chat, speech, transcription, and production live-voice work.
- Keep LLM history bounded with an incremental summary and recent verbatim messages.
- Add explicit `ok`, `no_reliable_context`, `off_topic`, `aborted`, and `provider_error` outcomes; exclude failed turns from future model context.
- Add negative golden cases and rejection scoring before considering a cross-encoder.
- Add bounded overlap to admin-document chunks only.
- Search raw and context-expanded follow-ups in parallel and merge their sources.
- Offer contact after two consecutive no-context outcomes; keep off-topic turns neutral.

## Non-goals

No Pinecone, LangGraph, PostgresSaver, SSE migration, billing, credits, human dashboard, SES integration, or crawler. No cross-encoder until evaluation demonstrates a ranking problem. No changes to structured portfolio chunks beyond their existing derivation.

## Implementation choices

- Store thread summary fields and rate-limit buckets in a new Drizzle SQL migration. Keep turn outcomes in existing `chat_messages.debug` JSON.
- Use an atomic Postgres RPC for fixed-window limits. Hash rate-limit identities with the server-only Supabase key. Fail closed with `503` if limiting is unavailable and return `429` with `Retry-After` when exhausted.
- Fetch a bounded recent database window plus an exact count. Summarize every six eligible messages, keep at most six recent messages, clip long history content, and preserve prior summaries on failure.
- Keep answer sharing restricted to standalone sourced answers. No-context and failed turns remain uncached.
- Preserve multilingual generation; contact escalation adds the existing `/?hl=contact` link rather than an English-only canned answer.
- Do not commit or push unless the user separately requests it.

## Verification

Run focused Vitest files during each task, then the complete test suite, ESLint, and production build. Report any live gateway evaluation or database migration that cannot be exercised locally.
