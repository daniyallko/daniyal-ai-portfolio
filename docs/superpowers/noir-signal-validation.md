# Noir Signal validation

## Pre-change baseline — 2026-11-09

Measured before product edits on the existing Vite development server at `http://127.0.0.1:8080/`.

- Environment: Linux WSL2, headless Chromium `Chrome/157.0.0.0`, Playwright MCP, viewport `1440×1000`, DPR 1.
- Browser connection report: `effectiveType=4g`, `downlink=1.5`, `saveData=false`; local loopback server, no added throttling. Development-module responses are not production bundle measurements.
- Screenshot: `.playwright-mcp/noir-signal/baseline-desktop.png`.
- Public-shell CLS: `0` from buffered `layout-shift` PerformanceObserver entries on this load. No Lighthouse run or score claimed.
- Hero-related raster image requests: none in the pre-change homepage.
- Document transfer: `39,459` bytes (`39,159` encoded body bytes).
- Development resource aggregate: 132 script requests, `12,300` transfer bytes reported for uncached dev modules, `14,328,127` total encoded script bytes (includes large unbundled dependencies), `819,923` encoded bytes from `/src/` modules. These are diagnostic dev-module figures, not transfer-equivalent production assets.
- Existing environment blocker: `SUPABASE_SERVICE_ROLE_KEY` is absent; `/api/public/rag-warm` returns `503`. Streaming chat, live voice, and authenticated admin verification remain blocked unless configuration becomes available.

## Execution log

- Task 1 started; baseline captured before product-code edits.
- Theme unit/component/token tests: `20/20` passed; `npx tsc --noEmit` passed.
- Browser theme checks passed: dark system first visit; manual light saved as `daniyal.theme.v1=light`; reload retained light; later OS change did not override explicit choice; clearing override restored OS following (light → dark).
- Fresh-load console contained only the known `503 /api/public/rag-warm` resource error. Earlier HMR `useTheme` errors came from intermediate edits before root integration completed and were absent after fresh navigation.
- Task 2: geometry, component, and local asset tests `12/12` passed. AVIF assets are valid ISO Media AVIF; JPEG is 1800×1200. Sizes: 900 AVIF 44,498 B; 900 WebP 73,976 B; 1800 AVIF 131,901 B; 1800 WebP 206,962 B; 1800 JPEG 292,776 B.
- Building browser harness rendered the real `HeroBuilding` in both themes at 360, 390, 768, 1024, 1440, and 1920px. Screenshots are `.playwright-mcp/noir-signal/building-{theme}-{width}.png`. All 15 lights remain registered to central-tower window panes; shared visible image/SVG rects match; no horizontal overflow. Light mode intentionally hides the window SVG.
- Asset encoder ruling: denied isolated Sharp installation was not retried. Existing Chromium generated same-crop WebP/JPEG/raw RGBA; native `libheif` 1.17.6 + AOM generated AVIF locally. No app dependency or external conversion service was added.
- Task 4: persistent-overlay tests passed. Initial scripted click timed out while waiting for hydration; subsequent real-browser clicks opened the mounted overlay. Assistant load-failure recovery was checked at 360 and 1440px in both themes. Screenshots: `.playwright-mcp/noir-signal/assistant-failure-{dark,light}-1440.png` and `.playwright-mcp/noir-signal/assistant-failure-light-360.png`.
- Task 5: focused chat/overlay suite passed `16/16`; full regression passed `123/123`; `npx tsc --noEmit` exited 0.
- Task 5 browser fixtures rendered saved threads and conversations without changing application backend behavior. Mobile drawer trapped focus, Escape restored focus to `Open conversations`, and body overflow returned to its previous value. Standalone sidebar was visible at 768px; inspector docked at 420px on 1440px desktop. No horizontal overflow was observed at 360, 768, or 1440px. Theme switching persisted `daniyal.theme.v1=light`.
- Task 5 screenshots: `.playwright-mcp/noir-signal/chat-mobile-drawer-dark-360.png`, `chat-conversation-dark-360.png`, `chat-inspector-dark-360.png`, `chat-conversation-light-360.png`, `chat-conversation-light-768.png`, and `chat-inspector-dark-1440.png` under `.playwright-mcp/noir-signal/`.
- Task 5 limitation: browser conversation data and NDJSON behavior were fixture/unit verified, not live backend verification. Actual streaming, live voice, and authenticated admin checks remain blocked because local `SUPABASE_SERVICE_ROLE_KEY` is absent; `/api/public/rag-warm` continues to return `503`. No credential-dependent success is claimed.
- Task 6: voice switcher/diagnostics tests initially failed on Escape focus restoration, production telemetry gating, and reduced-motion RAF looping; fixes passed. Browser-driven fixes added observed RED→GREEN coverage for 44px preview targets and telemetry HUD/trigger spacing. Full regression passed `129/129`; `npx tsc --noEmit` exited 0.
- Task 6 browser checks: popover stayed within a 360px viewport with no horizontal overflow, all preview controls measured 44×44px after the fix, and Escape restored trigger focus. At 768px the telemetry trigger did not intersect the composer. Telemetry HUD used bounded internal scrolling and a 44×44px close control; after the spacing fix its bottom edge was 4px above the trigger with no overlap. Screenshots: `.playwright-mcp/noir-signal/voice-switcher-dark-360.png`, `voice-switcher-light-768.png`, `voice-telemetry-dark-360-fixed.png`, and pre-fix defect evidence `voice-telemetry-dark-360.png`.
- Task 6 limitation: voice preferences, selection callbacks, preview callbacks, development gating, and layout were verified. Actual microphone capture, preview audio output, and live WebRTC calls remain blocked by local credentials/browser permissions; no live audio success is claimed.
- Task 7: initial RED covered missing auth labels/error alerts/busy status, root main landmarks, eval case keyboard controls, and the labelled table scroll region. Final focused suite passed `9/9`; required suite with app routing passed `10/10`; full regression passed `138/138`; `npx tsc --noEmit` exited 0.
- Task 7 browser checks covered `/auth`, `/eval`, and an unknown route in dark and light themes at 360, 768, and 1440px. No horizontal document overflow was observed. Auth inputs had associated labels; eval results used a keyboard-focusable labelled region with internal horizontal scrolling (960px table inside 311px and 703px regions at 360 and 768px). Enter and Space expanded/collapsed a completed case and retained trigger focus. Unknown routes returned HTTP 404 with main landmark plus home/chat recovery actions.
- Task 7 screenshots: `.playwright-mcp/noir-signal/auth-dark-1440.png`, `auth-light-1440.png`, `auth-light-360.png`, `eval-light-360-expanded.png`, `eval-light-1440.png`, `eval-dark-1440.png`, `not-found-light-1440.png`, and `not-found-dark-360.png` under `.playwright-mcp/noir-signal/`.
- Task 7 limitation: browser eval metrics/case details used a request-intercepted `listEvalRuns` module fixture, not live backend data. The real local function still reports missing `SUPABASE_SERVICE_ROLE_KEY`; no live evaluation, authenticated sign-in, streaming, voice, or admin success is claimed. Unit tests separately verify unchanged Supabase payloads, eval NDJSON request/cancellation, error alerts, and root error reporting/reset.
- Task 8: initial RED was `9/9` failing on access landmarks/status, tabs, associated labels, named controls, and empty-state guidance. PDF success then exposed an incorrect test fixture returning a raw array instead of `unpdf.extractText()`'s `{ text }`; fixture corrected without changing production extraction. Focused owner suite passed `9/9`; full regression passed `147/147`; `npx tsc --noEmit` exited 0.
- Task 8 browser checks used request-intercepted Supabase/admin-function fixtures. Access denied/loading rendered at 360 and 1440px; sessions and KB editor rendered in dark and light at 360, 768, 1024, and 1440px. All 20 checked states had no horizontal document overflow. Visitor selection loaded the first thread, long referrer/user-agent content wrapped, and the three-column console appeared from 1024px. Fixture reindex, valid-draft save, confirmed delete, and empty-session states completed with their required status messages. A missing `onAuthStateChange` fixture method caused one intermediate console error; fixture corrected and a fresh session/visitor/thread load completed without that error.
- Task 8 screenshots: `.playwright-mcp/noir-signal/admin-{denied,loading}-{dark,light}-{360,1440}.png` (existing combinations only), `admin-sessions-{dark,light}-{360,768,1024,1440}.png`, `admin-kb-{dark,light}-{360,768,1024,1440}.png`, and `admin-empty-dark-360.png` under `.playwright-mcp/noir-signal/`.
- Task 8 limitation: authenticated visitor/KB operations were fixture-verified only. Real owner authentication, visitor data, PDF backend writes, reindex, streaming, and live voice remain blocked because local credentials are unavailable; no credential-dependent success is claimed. Unit tests verify unchanged admin server payloads, PDF extraction/review, delete confirmation, and cache-warm status contracts.

## Task 9 — final regression and review fixes, 2026-11-10

### Automated gate

- Final motion/asset/contract audit: `npm test -- src/test/noir-motion.test.ts src/test/home-contracts.test.ts src/test/noir-assets.test.ts` → **3 files, 18 tests passed**.
- Focused review-fix suite → **8 files, 53 tests passed**.
- Complete post-fix suite: `npm test` → **34 files, 172 tests passed**; initial post-fix duration 15.76s. Final Task 9 completion run also passed **34 files, 172 tests**, duration 7.51s.
- `npx tsc --noEmit` → **exit 0**, no diagnostics.
- `git diff --check` → **exit 0**, no whitespace errors.
- `npm run build` → **exit 0**; client, SSR, and Nitro builds completed. Fresh log: `.superpowers/sdd/2026-11-09-noir-signal-frontend-redesign/final-build.log`.
- Build warnings remain: route tests under `src/routes/` do not export routes; existing `createServerFn().inputValidator()` deprecations; ineffective dynamic imports; large `index` chunk 515.00kB and `pdfjs` chunk 1,620.32kB. These warnings were not hidden or converted into a clean-warning claim.
- `npm run lint` → **exit 1: 2,499 errors, 13 warnings**. Fresh log: `.superpowers/sdd/2026-11-09-noir-signal-frontend-redesign/final-lint.log`. Errors span generated scratch output, redesign-owned files, and untouched legacy/backend files; redesign files also have formatting violations. No broad auto-fix was applied, lint is not claimed to pass, and a clean pre-change lint baseline is not asserted.

### Whole-diff review disposition

One fresh-context whole-diff reviewer returned **“Ready to merge? With fixes.”** No Critical findings; seven Important findings; six Minor findings. All Important findings were re-graded by user effect and fixed in one RED→GREEN pass. No second reviewer was dispatched.

1. **Initialization race — fixed.** One shared `initialize()` promise now serializes lookup before creation and adopts an existing thread. RED: deferred lookup allowed `createThread()` before list completion. GREEN: `adopts an existing thread before considering creation during rapid entry` and `creates only after the shared lookup completes empty`. The older rapid-creation test now awaits the required lookup boundary; latest-request dispatch remains separately covered.
2. **Denied voice-preference storage — fixed.** Writes are guarded and in-memory preferences survive denied storage. RED: `SecurityError: Denied` from `voice-switcher.tsx`. GREEN: `retains in-memory preferences when storage reads and writes are denied`.
3. **Nested voice/telemetry Escape — fixed.** Popovers consume Escape in capture phase and restore trigger focus; the outer overlay yields to nested dialogs. RED: voice Escape closed the assistant and telemetry Escape did nothing. GREEN: `closes only the voice popover when Escape originates on its trigger`, `closes only telemetry on nested Escape`, and `closes telemetry on Escape without closing its parent surface`.
4. **Reduced-motion cascade — fixed.** Complete override moved after all motion declarations and now covers homepage, building filter, chat/popovers, highlights, and breathe/caret/pulse effects. RED: source-order test found later declarations re-enabled motion. GREEN: `places the complete reduced-motion override after every motion declaration`, plus computed browser verification below.
5. **Production retrieval internals — fixed.** Inspect action and dev-only panel content are gated with `import.meta.env.DEV`; production always resolves to sources. RED: production rendered `inspect`, `test-model`, and hybrid ranking. GREEN: `hides development inspection in production while preserving sources` and `keeps production inspection on sources without retrieval internals`.
6. **Light bold Markdown contrast — fixed.** `.prose-chat strong` now uses `var(--signal)`. RED: token test found bright `var(--primary)`. GREEN: `uses readable signal text for bold Markdown in both themes`, plus rendered contrast verification below.
7. **Hero recorder cleanup — fixed.** Unmount detaches recorder callbacks, stops active capture, and stops every track. RED: recorder `stop` had zero calls after unmount. GREEN: `stops capture and detaches recorder callbacks when unmounted while recording`.

The full post-fix suite passed **172/172** after these changes.

### Final computed browser verification

- Real overlay with fixture thread: voice Escape closed only `Voice and language`, left outer `data-open="true"`, and restored trigger focus. Telemetry Escape closed only `Voice and RAG telemetry`, left outer assistant open, and restored trigger focus.
- With emulated `prefers-reduced-motion: reduce`, computed `animationName` was `none` and `transitionDuration` was `0s` for `.hero-enter`, `.home-hero`, `.hero-building__image`, `.hero-building__frame`, `.hero-building__window`, `.hero-building__sunlight`, `.assistant-overlay`, `.chat-empty`, `.hl-pulse`, `.breathe`, `.chat-message-in`, `.chat-drawer`, `.voice-popover`, `.telemetry-popover`, `.voice-console`, `.caret`, `.signal-pulse`, `.hero-exit`, and `.spot`. `.breathe::after` also computed to `animationName: none`.
- Rendered Markdown bold computed to `rgb(80, 108, 0)` on light ivory, contrast **5.2827:1**, and `rgb(207, 255, 98)` on dark canvas, contrast **16.9135:1**. Both exceed 4.5:1.
- The only error on the fresh public homepage console was the known `503 /api/public/rag-warm` resource error. Fixture-induced failures during negative-path QA are not counted as public homepage errors.

### Remaining 200%-zoom and long-content checks

A `720×500` CSS viewport was used as the 200%-zoom equivalent of a `1440×1000` layout.

- Standalone fixture conversation with long Hindi and French text passed in both themes: document/body width 720px; chat client/scroll width 710/710px; assistant article client/scroll width 637/637px. No document or chat horizontal overflow.
- Mobile inspector at the same zoom had document/body width 720px; citation Escape closed the inspector. Screenshot: `.playwright-mcp/noir-signal/chat-inspector-light-200pct.png`.
- Standalone dark conversation screenshot: `.playwright-mcp/noir-signal/chat-standalone-dark-200pct.png`.
- Thread-load failure rendered `Chat unavailable` and a visible `Retry` control with document/body width 720px. Screenshot: `.playwright-mcp/noir-signal/chat-error-dark-200pct.png`.
- Browser-only denied-microphone fixture rendered the voice error `Microphone access blocked for layout QA` with document/body width 720px. Screenshot: `.playwright-mcp/noir-signal/voice-error-dark-200pct.png`. This verifies error-state layout only, not microphone/WebRTC success.
- Earlier 200% checks also passed for homepage, inline assistant, auth, eval, and fixture admin. Eval overflow remains inside its labelled `Golden case results` keyboard-focusable region.

### Final performance record

Environment: Linux WSL2, headless Chromium `Chrome/157.0.0.0`, DPR 1, local loopback development server, no added network throttling; browser connection reported `effectiveType=4g`, `downlink=1.5`, `saveData=false`. CLS values below are buffered `layout-shift` PerformanceObserver measurements, not a Lighthouse score or production-field data.

| Viewport | Active hero image | Transfer / encoded bytes | CLS |
| --- | --- | ---: | ---: |
| 360 | 900 AVIF | 44,798 / 44,498 | 0.0470130 |
| 390 | 900 AVIF | 44,798 / 44,498 | 0.0250160 |
| 768 | 900 AVIF | 44,798 / 44,498 | 0.0004999 |
| 1024 | 1800 AVIF | 132,201 / 131,901 | 0 |
| 1440 | 1800 AVIF | 132,201 / 131,901 | 0.000000126 |
| 1920 | 1800 AVIF | 132,201 / 131,901 | 0 |

- Every measured CLS is below 0.05; 360px is close to the limit and should be rechecked on real devices/staging.
- Image budgets pass: mobile 44,498 encoded bytes ≤180KB; desktop 131,901 encoded bytes ≤300KB. Local fallback assets remain 900 WebP 73,976B, 1800 WebP 206,962B, and 1800 JPEG 292,776B.
- Feature theme/hero modules measured **6,080 bytes minified / 2,553 bytes gzip**, below the approximately 15KB gzip budget. No animation dependency or package-manifest/lockfile change was introduced.
- Offscreen building animation paused and visible hero animation resumed in browser checks. Continuous keyframes are restricted to transform/opacity by source audit; no continuous React render loop was added.
- Fresh production bundle output is recorded above. No production Lighthouse run, real-device performance claim, or reduced-data emulation success is claimed.

### Preservation and environment boundaries

- Protected tracked files remain unchanged: `src/lib/portfolio.ts`, `src/routeTree.gen.ts`, `package.json`, and lockfiles. The fresh reviewer also found no backend, retrieval, prompt, model, API/server, authentication, or visitor-logic edits.
- Existing anonymous visitor UUID and mounted fixture-thread DOM identity survived theme changes and close/reopen. Co-browse project/skill targets, homepage anchors, citations, source inspection, and read-aloud exclusion contracts remain covered by earlier browser/unit evidence.
- **BLOCKED:** immediate real NDJSON dispatch and active-stream close/reopen without remount.
- **BLOCKED:** real microphone/WebRTC voice, barge-in, captions, telemetry, preview/read-aloud audio, and credentialed no-remount verification.
- **BLOCKED:** authenticated admin/KB writes and live evaluation.
- **BLOCKED:** reduced-data browser emulation; CDP emulation did not apply. Static CSS/asset contracts pass, with fallback coverage deferred below.
- Exact local reason: `SUPABASE_SERVICE_ROLE_KEY` is absent and actual `POST /api/public/rag-warm` returns HTTP 503 `{"entries":[],"error":"Warm-up unavailable"}`. No secrets were inspected or provisioned. Fixtures verify UI behavior only and do not prove these integrations.
- Subjective visual/art-direction quality remains for the user's running-frontend review; tests do not prove the “$20,000 bespoke” subjective target.

### Deferred Minor findings

1. Mobile inspection lacks complete modal semantics/background inerting and a labelled keyboard-focusable ranking-table horizontal scroller.
2. Fenced code lacks its own bounded, labelled, keyboard-focusable horizontal scroller.
3. `VoiceOrb` does not react to live theme/reduced-motion changes during an active call.
4. Reduced-data sizing covers AVIF-capable browsers but not WebP/JPEG fallback selection.
5. Standalone `/chat` startup lacks a failure/retry state.
6. `.playwright-mcp/` and `.superpowers/` are not ignored and could contaminate a broad delivery add.

These six findings were intentionally deferred, not silently fixed.

### Handoff

Running frontend remains available at `http://127.0.0.1:8080/`. Work is local and uncommitted at HEAD `f81446b`; no branch, commit, push, history rewrite, or Lovable sync was performed.
