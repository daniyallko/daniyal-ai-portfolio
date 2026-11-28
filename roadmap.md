# Roadmap

- [x] Consolidate visit, chat, and voice alerts into one editable Telegram message per visitor UUID; database leases serialize concurrent updates.
- [x] Add clickable IPinfo IP details and bounded recent questions. Verified the same Telegram message across 13 update revisions, concurrent saved voice turns and chat history in the browser; all 291 tests pass.

- [x] Compact source pills to 20px on phones; play all read-aloud clauses in a tap-unlocked AudioContext; fix invalid orb colors. Verified real two-clause audio and mobile layout in Chromium; physical iPhone playback remains unverified.

- [x] Switch chat and live-call RAG delegation to `openai/gpt-6-luna`; switch read-aloud to `google/gemini-2.5-flash-tts`; regenerate gateway types.
- [x] Add 17 knowledge-base-grounded golden cases (31 total) and 19 warm-up questions (58 Tier 1/2 total), preserving sensitive-topic exclusions.
- [x] Verify: 271 tests pass; final golden run has 100% required facts and retrieval, 92.7% quality, 85.5% citation coverage; all 58 warm answers persisted; real speech and warmed homepage chat verified.
