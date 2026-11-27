# Chat speed plan

Done already: the chat message limit check (3 database calls per message) is removed from text chat. Voice, transcription and read-aloud limits are unchanged.

## Goal
- Greetings and cached answers: first words in under 300 ms.
- New questions: first words in about 1 s.

## 1. Start the answer stream right away
Today the server waits for the thread check, history, cache read, and then saving the user's message before sending anything back.
- Open the response stream right after the thread check.
- Save the user message, update the thread title and send the Telegram alert in the background (`defer`) while the answer streams.
- Save the assistant message after the stream ends, as now.

## 2. Instant greetings
- Check `smallTalkReply()` before any database call; for greetings stream the reply at once, then verify the thread and save both messages in the background.

## 3. Cache standalone follow-ups
- `canShareAnswer` currently refuses the cache whenever the chat has history.
- New rule: allow the cache when the question stands on its own (no "it / that / he / this project / more" style references, not a short follow-up), still never for sensitive questions.
- Add tests for both cases.

## 4. Move imports to module scope
- Replace the ~10 `await import()` calls inside the handler with top-level imports (server-only modules stay in `.server.ts` files).

## 5. Faster cold questions
- Start embedding the query in parallel with the database reads instead of after them.
- Keep the corpus embeddings in isolate memory (already), and skip embedding entirely when BM25 alone is confident.
- Load chat memory (`prepareChatMemory`) in parallel with retrieval (already partly) and skip it for short histories.

## 6. Browser side
- Show the cached answer instantly from the browser cache before the server replies.
- Warm retrieval while the visitor types (already), extended to the question chips.

## Technical details
- File: `src/routes/api/chat.ts` (stream ordering, imports, parallel embedding).
- File: `src/lib/rag-cache.ts` (`canShareAnswer` standalone rule) + tests.
- File: `src/server/rag.server.ts` (BM25 confidence shortcut).
- Measure with the existing HUD numbers (TTFT, total time, cache tier) before and after.

## Risk
- Saving messages in the background: if the save fails, the answer still shows but may be missing from history; failures are logged.
- With no chat limit, heavy abuse would cost AI credits.
