# Roadmap

- [ ] Make answer sources compact, fix complete phone read-aloud playback, and brighten the dark-mode voice orb; verify playback and mobile layout.

- [x] Switch chat and live-call RAG delegation to `openai/gpt-6-luna`; switch read-aloud to `google/gemini-2.5-flash-tts`; regenerate gateway types.
- [x] Add 17 knowledge-base-grounded golden cases (31 total) and 19 warm-up questions (58 Tier 1/2 total), preserving sensitive-topic exclusions.
- [x] Verify: 271 tests pass; final golden run has 100% required facts and retrieval, 92.7% quality, 85.5% citation coverage; all 58 warm answers persisted; real speech and warmed homepage chat verified.
