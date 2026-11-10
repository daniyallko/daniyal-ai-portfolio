# Noir Signal Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform every portfolio surface into a responsive, dual-theme Noir Signal experience while preserving the existing assistant, voice, retrieval, owner tooling, and content behavior.

**Architecture:** Establish semantic tokens and pre-paint theme state at the root, then build the local architectural media and shared homepage composition. Keep the existing homepage-mounted `ThreadView` alive through a tested overlay state layer; refactor only presentational chat components. Finish owner/public surfaces with the same tokens, then validate the real app across the complete browser matrix.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, Tailwind CSS v4, semantic CSS custom properties, inline SVG, Vitest, Testing Library, Playwright browser QA. No new runtime animation library.

**Spec:** `docs/superpowers/specs/2026-11-09-noir-signal-frontend-redesign-design.md`

## Global Constraints

- Do not change backend, database, API, retrieval, prompt, model, authorization, visitor identity, or content strategy.
- Do not edit `src/lib/portfolio.ts` for visual purposes; preserve all portfolio content and ordering.
- Preserve NDJSON streaming, citations and `#cite-n`, debug shapes, RAG cache/warm behavior, `/api/live`, `/api/transcribe`, `/api/speak`, worklet contracts, WebRTC, barge-in, turn IDs, telemetry refs, and single-answer read-aloud.
- Preserve `?hl=<id>`, `?skill=<tech>`, `#work`, `#log`, `#stack`, `#contact`, every `proj-${project.id}`, `data-skill`, `data-group`, and `document.documentElement.dataset.cobrowseHit`.
- Keep the hero composer’s current copy, role, suggestions, voice controls, Enter/Shift+Enter behavior, autosize, dictation, persona/language selection, and speech stopping.
- Never remount `ThreadView` for homepage opening, closing, theme changes, or animation. Send/network and voice initialization must begin immediately.
- Use one local copy of Unsplash photo `1486406146926-c627a92ad1ab` for both themes; no runtime third-party image dependency and no substitute building.
- Base image and all window overlays share a `1800×1200` intrinsic coordinate system, media box, centered cover crop, and parent transforms. Window lights must be actual source-image polygons, never independent viewport-percentage spans.
- Use Geist, Instrument Serif, and JetBrains Mono only. Dark canvas/text/accent are `#0B0C0C`/`#F2F2EB`/`#CFFF62`; light canvas/text/accent surface are `#F2F0E9`/`#141510`/`#C6EC5B`.
- Theme uses root `data-theme="dark" | "light"`, matching `color-scheme`, system default, and versioned persistence under `daniyal.theme.v1`.
- Hero message/suggestion transition: approximately 900ms. Empty-header opening: 300ms. Voice: shortest safe opening, with no choreography delay. Reduced motion: immediate state change.
- Continuous motion is limited to compositor-friendly transform/opacity; no continuous React renders, WebGL, background video, or heavy animation dependency.
- Pause nonessential ambient motion offscreen and while the document is hidden. Coarse pointers get no cursor-following effect.
- Design at 360, 390, 768, 1024, 1440, and 1920px. No horizontal page scroll; touch targets are at least 44px on touch layouts.
- WCAG AA text/control/focus contrast in both themes; never use bright chartreuse for small text on ivory.
- Theme plus hero-motion JavaScript target: approximately ≤15KB gzip, preferably much less. Active hero image targets: ≤180KB mobile and ≤300KB desktop. Public-shell CLS target: <0.05.
- No additional mockup checkpoint for non-hero surfaces. User reviews the complete running frontend at the end.
- Invoke `ui-ux-pro-max` for implementation design guidance when execution begins, as requested. The unavailable `taste` skill is not a dependency.
- Work stays local and uncommitted. Do not commit, push, merge, rebase, amend, squash, or force-push. If the user later requests a commit, create a feature branch before the first commit and follow repository Lovable protections.
- Current local backend lacks `SUPABASE_SERVICE_ROLE_KEY`; `/api/public/rag-warm` returns 503. Do not inspect secrets or provision configuration. Mark credential-dependent chat/voice/admin checks blocked rather than passed.

## Review Focus

1. **Rapid repeat entry before thread creation resolves:** two hero sends/clicks must create at most one thread and dispatch the accepted pending request exactly once. Owned by Task 4’s deferred-creation and ready-control tests.
2. **Close/reopen during an active conversation:** the same mounted instance, stream, audio element, captions, and telemetry refs must survive; closing must not be implemented as unmounting. Owned by Task 4’s mount-identity test and Task 9’s credentialed/blocked integration check.
3. **Broken storage, system-theme changes, and theme switching mid-stream:** invalid/denied storage must fall back safely; only system-following sessions react to OS changes; theme changes must not reset chat. Owned by Tasks 1 and 4 tests plus Task 9 browser QA.
4. **Long multilingual content at 360px and 200% zoom:** names, citations, code, voice labels, and tables must wrap or scroll in labelled containers without page overflow. Owned by Task 5’s long-content test, Task 8’s responsive work, and Task 9’s viewport/zoom matrix.
5. **Crop changes during window animation or reduced-data/reduced-motion use:** lights must remain on real windows at every required width, decorative work must stop when requested, and content/actions must remain available. Owned by Task 2’s geometry/component tests and Task 9’s screenshot/motion checks.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/theme.ts` | Pure theme type, storage key, saved/system resolution, static pre-paint script. |
| `src/components/theme-provider.tsx` | Shared root theme state, persistence, system subscription, root/meta synchronization. |
| `src/components/theme-toggle.tsx` | Accessible shared sun/moon switch; no independent persistence logic. |
| `src/lib/hero-media.ts` | Building dimensions and traced window polygon groups in source coordinates. |
| `src/components/hero-building.tsx` | Responsive local picture, aligned SVG light groups, scrims, sunlight, ambient pause hooks. |
| `public/images/noir-building-*` | Optimized 900/1800px AVIF/WebP plus fallback and source/license notes. |
| `src/components/home-hero.tsx` | Existing hero composer behavior and Noir Signal presentation behind one `onOpen` prop. |
| `src/hooks/use-inline-assistant.tsx` | Persistent thread node, entry mode, creation retry, pending handoff, overlay lifecycle. |
| `src/lib/overlay-motion.ts` | Pure entry-mode timing decisions. |
| `src/lib/focus-trap.ts` | Focusable-element query and Tab wrapping for the mounted overlay. |
| `src/components/chat-types.ts` | Shared UI-only message/source/debug types. |
| `src/components/chat-message.tsx` | Presentational assistant message, citations, listen, error and source actions. |
| `src/components/chat-inspector.tsx` | Responsive sources/debug inspector; no retrieval logic. |
| `src/components/thread-view.tsx` | Existing text/voice state and contracts, loading/error recovery, composed redesigned UI. |
| `src/routes/index.tsx` | Homepage shell, full-bleed hero, editorial sections, preserved co-browsing and anchors. |
| `src/routes/chat.tsx` | Standalone chat navigation/sidebar and mobile thread access. |
| `src/components/voice-switcher.tsx` | Voice/language popover presentation and keyboard behavior. |
| `src/components/voice-diagnostics.tsx` | Voice orb, reduced-motion behavior, responsive diagnostics and production gating. |
| `src/routes/eval.tsx`, `src/routes/auth.tsx`, `src/routes/__root.tsx` | Eval/auth/error visual states and shared theme access. |
| `src/routes/_authenticated/admin.tsx`, `src/components/admin-kb.tsx` | Responsive owner sessions and KB editor with unchanged operations. |
| `src/styles.css` | Dual-theme tokens, shared surfaces/focus/motion, responsive and reduced-data/motion rules. |
| `docs/superpowers/noir-signal-validation.md` | Recorded browser matrix, asset/performance results, and explicit environment blockers. |

---

### Task 1: Dual-Theme Foundation and Shared Switch

**Files:**
- Create: `src/lib/theme.ts`, `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`
- Modify: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/styles.css`
- Test: `src/lib/theme.test.ts`, `src/components/theme-toggle.test.tsx`, `src/test/design-tokens.test.ts`

**Interfaces:**
- Produces: `type Theme = "dark" | "light"`, `THEME_STORAGE_KEY = "daniyal.theme.v1"`.
- Produces: `resolveTheme(stored: string | null, systemDark: boolean): Theme` and `themeInitScript(): string`.
- Produces: `<ThemeProvider>{children}</ThemeProvider>` and `useTheme(): { theme: Theme; setTheme: (theme: Theme) => void }`.
- Produces: `<ThemeToggle className?: string />`; later tasks reuse this component without reading storage themselves.

- [ ] **Step 0: Record the pre-change public-shell baseline**

Before editing product code, record current homepage transferred hero-related assets/JavaScript, public-shell CLS, browser/machine/network conditions, and a homepage screenshot in `docs/superpowers/noir-signal-validation.md`. This is the comparison baseline for Task 9; do not claim a Lighthouse score unless it was actually measured.

- [ ] **Step 1: Write failing pure-theme tests**

Cover `dark`/`light` saved values, invalid and absent values, both system preferences, and script execution. Execute the returned script in a DOM sandbox with mocked `localStorage`/`matchMedia`; assert it sets `documentElement.dataset.theme` and `style.colorScheme` before React, and that denied storage does not throw.

```ts
expect(resolveTheme("light", true)).toBe("light");
expect(resolveTheme("garbage", true)).toBe("dark");
expect(THEME_STORAGE_KEY).toBe("daniyal.theme.v1");
```

- [ ] **Step 2: Run pure-theme tests and verify failure**

Run: `npm test -- src/lib/theme.test.ts`
Expected: FAIL because `src/lib/theme.ts` does not exist.

- [ ] **Step 3: Implement pure theme resolution and pre-paint script**

Implement only the signatures above. Accept exactly `light` and `dark`; otherwise follow `systemDark`. Return a static try/catch script that reads the versioned key and `prefers-color-scheme: dark`, then applies `data-theme` and `color-scheme`. Do not read cookies or add runtime dependencies.

- [ ] **Step 4: Run pure-theme tests and verify pass**

Run: `npm test -- src/lib/theme.test.ts`
Expected: all theme resolution/script tests PASS.

- [ ] **Step 5: Write failing provider/switch and token tests**

Provider tests use a controllable `MediaQueryList` mock. Assert toggle accessible name, root dataset, `color-scheme`, saved preference, and 44px mobile class. Assert OS changes apply only when no explicit preference exists and an explicit choice survives a later OS event. Add invalid/denied storage cases. Token tests read `src/styles.css` and require both selectors and definitions for every currently referenced property: `signal`, `hairline`, `specular`, `ease-out-expo`, `glow-a`, and `glow-b`.

- [ ] **Step 6: Run component/token tests and verify failure**

Run: `npm test -- src/components/theme-toggle.test.tsx src/test/design-tokens.test.ts`
Expected: FAIL on missing provider/toggle and absent dual-theme token definitions.

- [ ] **Step 7: Implement provider, toggle, root integration, and semantic tokens**

Mount `ThemeProvider` around `AmbientCursorGlow` and `<Outlet />`; insert `themeInitScript()` in the document head before paint-dependent content. Keep `<Outlet />`, tracking, warm-up, and auth subscription intact. Toggle uses Lucide Sun/Moon, visible focus, an accessible action name, and a fixed-size hydration-safe placeholder until mounted.

In `src/styles.css`, use `:root` for shared non-color values, `[data-theme="light"]` for Warm Ivory defaults, and `[data-theme="dark"]` for Noir. Update the dark custom variant to the data attribute. Map existing shadcn/Tailwind tokens plus `--signal`, `--hairline`, `--specular`, `--ease-out-expo`, `--glow-a`, `--glow-b`, sidebar/chart/state colors, and readable light accent text `#506C00`. Use the exact spec canvas/text/accent colors. Keep status colors distinguishable from brand accent.

- [ ] **Step 8: Add homepage switch and verify focused tests**

Place `ThemeToggle` beside the existing assistant action without changing hero logic. Run: `npm test -- src/lib/theme.test.ts src/components/theme-toggle.test.tsx src/test/design-tokens.test.ts`
Expected: PASS.

- [ ] **Step 9: Verify real theme behavior and local checkpoint**

In the running app, verify first-visit system default, both toggle states, reload persistence, OS change with no override, no light/dark flash on reload, and no console errors. Run `npx tsc --noEmit`. Record results and leave all files uncommitted.

---

### Task 2: Local Building Media and Geometrically Aligned Lighting

**Files:**
- Create: `src/lib/hero-media.ts`, `src/components/hero-building.tsx`
- Create: `public/images/noir-building-900.avif`, `public/images/noir-building-900.webp`, `public/images/noir-building-1800.avif`, `public/images/noir-building-1800.webp`, `public/images/noir-building-1800.jpg`, `public/images/noir-building-SOURCE.md`
- Modify: `src/styles.css`
- Test: `src/lib/hero-media.test.ts`, `src/components/hero-building.test.tsx`, `src/test/noir-assets.test.ts`

**Interfaces:**
- Produces: `BUILDING_VIEW_BOX = "0 0 1800 1200"`.
- Produces: `type WindowPoint = readonly [number, number]` and `WINDOW_LIGHT_GROUPS: readonly { id: string; polygons: readonly (readonly WindowPoint[])[] }[]`.
- Produces: `<HeroBuilding />`, a decorative `aria-hidden` layer with no props and no continuous React state.

- [ ] **Step 1: Write failing geometry and asset-budget tests**

Require two or three light groups, at least twelve traced windows total, at least four points per polygon, finite coordinates inside `0≤x≤1800`, `0≤y≤1200`, and no string percentages. Asset tests require all local files and enforce ≤180KB for each 900px source and ≤300KB for each 1800px source/fallback.

- [ ] **Step 2: Run geometry/asset tests and verify failure**

Run: `npm test -- src/lib/hero-media.test.ts src/test/noir-assets.test.ts`
Expected: FAIL because geometry and production assets are absent.

- [ ] **Step 3: Produce licensed local image derivatives**

Use the approved 1800×1200 source already downloaded for design reconnaissance, or re-download the exact URL in the spec if absent. Create centered, same-crop 900×600 and 1800×1200 AVIF/WebP derivatives and an 1800×1200 JPEG fallback using an isolated one-off `sharp` invocation; do not add a runtime dependency. Iterate quality, not crop, until the asset tests pass without visible façade destruction. Record source URL, photo ID, modification/crop details, and `https://unsplash.com/license` in `noir-building-SOURCE.md`.

- [ ] **Step 4: Trace actual window polygons**

Inspect the 1800×1200 source at high zoom. Record at least twelve four-or-more-point polygons that follow real visible window boundaries, distributed across three opacity groups. Keep all coordinates in `src/lib/hero-media.ts`; do not copy the mockup’s floating percentages. Choose windows that remain visible in the centered desktop and mobile cover crops.

- [ ] **Step 5: Run geometry/asset tests and verify pass**

Run: `npm test -- src/lib/hero-media.test.ts src/test/noir-assets.test.ts`
Expected: PASS with all traced coordinates and size budgets valid.

- [ ] **Step 6: Write failing component/ambient tests**

Render `HeroBuilding`; assert one eager, high-priority local `<img>` with `width="1800"`, `height="1200"`, AVIF/WebP sources, shared centered cover styling, and SVG `viewBox="0 0 1800 1200"`. Assert every light polygon uses the same SVG frame, sunlight/window layers are pointer-inert and decorative, and no Unsplash URL appears. Mock IntersectionObserver/document visibility and assert the media root receives paused state offscreen/hidden.

- [ ] **Step 7: Run component tests and verify failure**

Run: `npm test -- src/components/hero-building.test.tsx`
Expected: FAIL because `HeroBuilding` is absent.

- [ ] **Step 8: Implement the shared media frame and CSS-only effects**

Use one absolutely positioned media box. Set image `object-fit: cover; object-position: 50% 50%`; set each SVG to the identical box with `preserveAspectRatio="xMidYMid slice"`. Apply ambient scale/translate to a common parent so image and polygons cannot drift. Use dark CSS grade/scrims and staggered polygon opacity; hide windows in light mode and move a soft sunlight layer with transform/opacity. Keep overlays pointer-inert. Pause via root data attributes driven by IntersectionObserver/`visibilitychange`; add reduced-motion and reduced-data static fallbacks, including a 900px source preference under `prefers-reduced-data` where supported.

- [ ] **Step 9: Verify component tests and all required crops**

Run: `npm test -- src/lib/hero-media.test.ts src/components/hero-building.test.tsx src/test/noir-assets.test.ts`
Expected: PASS. Temporarily mount the component in the hero only after Task 3 begins, or use a local component harness; screenshot both themes at 360/390/768/1024/1440/1920 and confirm each lit polygon remains inside its source window. Leave files uncommitted.

---

### Task 3: Full-Bleed Homepage Hero and Editorial Sections

**Files:**
- Create: `src/components/home-hero.tsx`
- Modify: `src/routes/index.tsx`, `src/styles.css`, `src/components/ambient-cursor-glow.tsx`
- Test: `src/components/home-hero.test.tsx`, `src/test/home-contracts.test.ts`

**Interfaces:**
- Consumes: `<HeroBuilding />` and `<ThemeToggle />` from Tasks 1–2.
- Produces: `type AssistantRequest = { q?: string; call?: boolean }`.
- Produces: `<HomeHero onOpen={(request?: AssistantRequest) => void} />`; it owns the existing composer/dictation/speech state but no thread lifecycle.

- [ ] **Step 1: Write failing hero interaction tests**

Mock voice preferences, speech, typewriter, and media. Render `HomeHero` with an `onOpen` spy. Assert trimmed Enter sends `{q}`, Shift+Enter does not send, empty input is disabled, each suggestion sends its existing query/call, live voice sends `{call:true}`, speech stops before opening, and the building is decorative. Add a recording-insertion test with mocked `MediaRecorder`, `/api/transcribe`, and stream cleanup.

- [ ] **Step 2: Run hero tests and verify failure**

Run: `npm test -- src/components/home-hero.test.tsx`
Expected: FAIL because the extracted component is absent.

- [ ] **Step 3: Extract the existing hero without changing behavior**

Move the current `Hero` implementation to `HomeHero`, replacing context consumption with the `onOpen` prop. Preserve exact copy, `PROMPTS`, `CREDS`, `CHIPS`, refs, autosize, dictation insertion, persona preview, error roles, and control labels. Pass `assistant.go` from `src/routes/index.tsx`; remove only the now-unneeded local hero/context code.

- [ ] **Step 4: Run hero behavior tests before visual changes**

Run: `npm test -- src/components/home-hero.test.tsx`
Expected: PASS, establishing a behavior baseline before styling.

- [ ] **Step 5: Write failing homepage contract tests**

Assert the homepage source retains all static section/footer anchors and dynamic `proj-${...}`, `data-skill`, `data-group`, `cobrowseHit`, and current project order. Assert `HeroBuilding` appears once and the hero is outside the constrained editorial content wrapper so its background can be full bleed.

- [ ] **Step 6: Run homepage contract tests and verify failure**

Run: `npm test -- src/test/home-contracts.test.ts`
Expected: FAIL because `HeroBuilding` is not mounted and the hero remains inside the constrained wrapper; any missing preservation contract must also fail here.

- [ ] **Step 7: Implement Noir Signal homepage composition**

Restructure `<main id="top">` into a full-width hero followed by a constrained sections wrapper. Mount `HeroBuilding` behind hero content with readable scrims; keep header sticky/safe-area-aware and mobile navigation uncramped. Use oversized responsive Geist, Instrument Serif only for “talks back.”, mono metadata, prominent left-aligned composer, and restrained technical indexing.

Restyle stats as an editorial index, Selected Work as an asymmetric grid with AI BotKit featured and other projects in existing order, Experience as a timeline, Stack as grouped technical columns/chips, and Footer as a strong contact close. Keep reveal-on-scroll, pointer spotlights, IDs/data attributes, and content unchanged. Grain must not overlay conversation text.

- [ ] **Step 8: Add static/motion safeguards**

Make reveal content visible by default and apply hidden-before-reveal styling only after JS enhancement. Keep reveals one-shot transform/opacity. Disable typewriter/caret/ambient motion under reduced motion; retain the existing RAF pointer approach and disable it for coarse pointers/reduced motion. No continuous React state updates.

- [ ] **Step 9: Verify homepage tests and responsive visuals**

Run: `npm test -- src/components/home-hero.test.tsx src/test/home-contracts.test.ts src/components/hero-building.test.tsx`
Expected: PASS. Browser-check hero and every section in both themes at all six widths; check composer at 360px, no horizontal overflow, and `?hl=proj-ai-botkit` plus a real `?skill=` target. Leave files uncommitted.

---

### Task 4: Cinematic Persistent Assistant Overlay

**Files:**
- Create: `src/hooks/use-inline-assistant.tsx`, `src/lib/overlay-motion.ts`, `src/lib/focus-trap.ts`
- Modify: `src/routes/index.tsx`, `src/components/thread-view.tsx`, `src/styles.css`
- Test: `src/lib/overlay-motion.test.ts`, `src/lib/focus-trap.test.ts`, `src/hooks/use-inline-assistant.test.tsx`

**Interfaces:**
- Consumes: `AssistantRequest`, `ThreadControl`, `EmbedOptions`, `createThread`, `listThreads`, and lazy `ThreadView`.
- Produces: `type OverlayEntry = "message" | "empty" | "voice"` and `overlayDurationMs(entry: OverlayEntry, reducedMotion: boolean): 0 | 300 | 900`.
- Produces: `getFocusable(container: HTMLElement): HTMLElement[]` and `wrapTabFocus(event: KeyboardEvent, container: HTMLElement): void`.
- Produces: `useInlineAssistant(): { go: (request?: AssistantRequest) => void; node: ReactNode; open: boolean }`.

- [ ] **Step 1: Write failing timing and focus tests**

Assert message=900ms, empty=300ms, voice=0ms, and every mode=0ms with reduced motion. Focus tests include disabled/hidden elements, empty containers, forward wrap, backward wrap, and no interference with non-Tab keys.

- [ ] **Step 2: Run timing/focus tests and verify failure**

Run: `npm test -- src/lib/overlay-motion.test.ts src/lib/focus-trap.test.ts`
Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement minimal motion/focus helpers**

Implement exact signatures above. `wrapTabFocus` acts only for Tab when focus would leave the container; use standard focusable selectors and filter hidden/disabled/inert descendants. No dependency or animation timer is needed.

- [ ] **Step 4: Write failing overlay lifecycle tests**

Mock `ThreadView` with mount IDs and a controllable `controlRef`; defer `createThread`. Cover: ready message dispatch synchronously before animation timers; header and voice entry modes; two rapid requests share one creation promise; pending handoff occurs once when ready; creation rejection shows a designed error with working Retry/Close; same mock instance survives open→close→reopen and theme change; background becomes inert; previous body overflow is restored; focus is trapped/restored; Escape uses the existing close path.

- [ ] **Step 5: Run lifecycle tests and verify current failures**

Run: `npm test -- src/hooks/use-inline-assistant.test.tsx`
Expected: FAIL on missing hook; after scaffolding against the old implementation, retain failures for retry, focus/inert, and mount identity until fixed.

- [ ] **Step 6: Extract and harden the persistent hook**

Move existing idle preload, existing-thread lookup, pending ref, creation promise, and `ThreadView` node into `use-inline-assistant.tsx`. Keep one lazy component type and one thread ID. `go` records entry mode, stores the triggering element, opens immediately, and attempts `flush()` without waiting for CSS. On creation failure retain the pending request and expose an accessible retry panel instead of indefinite `booting assistant…`.

Return `open` so the homepage shell can be `inert`/`aria-hidden` while the sibling overlay is active. The overlay remains mounted when closed, uses `role="dialog"`, `aria-modal`, labelled loading/failure states, scroll-lock restoration, Tab trapping, Escape, and focus restoration. Do not alter `ThreadControl` or voice/audio internals.

- [ ] **Step 7: Implement cinematic visual states**

Use overlay data attributes for open/entry state. Message/suggestion: 900ms hero recede plus composer-origin clip/scale expansion and subtle building deepening. Empty: 300ms fade/scale. Voice: immediate visibility with audio start never gated. Closing reverses the relationship without removing the node. Clip-path is limited to this short transition; reduced motion disables interpolation and smooth scrolling.

- [ ] **Step 8: Verify lifecycle and preservation tests**

Run: `npm test -- src/lib/overlay-motion.test.ts src/lib/focus-trap.test.ts src/hooks/use-inline-assistant.test.tsx src/components/home-hero.test.tsx`
Expected: PASS, including synchronous send and stable mount identity. Run `npx tsc --noEmit`.

- [ ] **Step 9: Browser-check entry/exit without claiming backend success**

Verify visual open/close/reopen, keyboard trap, focus return, scroll restoration, reduced motion, and theme switch while open. With current missing backend config, record message/voice integration as blocked; do not report successful streaming or live calls. Leave files uncommitted.

---

### Task 5: Shared and Standalone Chat Presentation

**Files:**
- Create: `src/components/chat-types.ts`, `src/components/chat-message.tsx`, `src/components/chat-inspector.tsx`
- Modify: `src/components/thread-view.tsx`, `src/routes/chat.tsx`, `src/routes/chat.$threadId.tsx`, `src/styles.css`
- Test: `src/components/thread-view.test.tsx`, `src/components/chat-message.test.tsx`, `src/components/chat-inspector.test.tsx`

**Interfaces:**
- Produces: shared UI types `Source`, `Debug`, and `Msg` matching current shapes exactly.
- Produces: `<AssistantMessage m={Msg} onCite={(n:number)=>void} onDev={()=>void} onSpeak={()=>void} speakState={"idle"|"loading"|"playing"} speakDisabled={boolean} />`.
- Produces: `<InspectPanel m={Msg} tab={"sources"|"dev"} focus?: number setTab={(tab)=>void} onClose={()=>void} />`.
- Preserves: `ThreadView({threadId, embed})`, `ThreadControl`, `EmbedOptions`, and standalone route navigation.

- [ ] **Step 1: Write failing loading-failure and long-content tests**

Mock voice/speech/preferences and `getThread`. Assert a rejected initial thread load shows an accessible error and Retry, and Retry reloads without changing thread ID. Message tests use a very long unbroken string, multiple citations, external links, listen states, and source titles; assert `overflow-wrap:anywhere` protection and exact `#cite-n` callback behavior. Inspector tests assert mobile full-screen semantics, source focus, tabs, empty sources, and close action.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/components/thread-view.test.tsx src/components/chat-message.test.tsx src/components/chat-inspector.test.tsx`
Expected: FAIL on missing recovery/components and missing overflow safeguards.

- [ ] **Step 3: Add thread recovery and characterize streaming before refactor**

Change loading state to include `error`, catch `getThread` rejection, and provide Retry that reruns the same visitor/thread request. Add a regression test feeding `sources → delta → done` NDJSON through mocked `/api/chat`; assert user/assistant text, source buttons, final status, and one answer-only listen control. Confirm this behavior before presentation extraction.

- [ ] **Step 4: Extract presentational message and inspector components**

Move only current markup/types into the new files. Keep ReactMarkdown citation conversion, `m.debug` shapes, source focus, `speech.speak(m.id,m.content)`, disabled rules, and all callbacks unchanged. `ThreadView` retains all network, recorder, voice, cache, telemetry, and co-browsing logic.

- [ ] **Step 5: Apply complete chat visual states**

Restyle header, identity, persona control, back/close, empty suggestions, user/assistant messages, retrieval/streaming/stop states, errors, citations, listen, source links, composer, active-call console, captions, and dispatch links using Noir tokens. Assistant text remains highly readable; user bubbles are restrained rather than oversized. Use mono only for metadata/citations. Keep the existing `<audio ref={voice.audioRef}>` and telemetry component in the same lifecycle.

- [ ] **Step 6: Redesign standalone chat navigation responsively**

Retain `/chat`, `/chat/$threadId`, thread query keys, create/delete/navigate operations. Restyle the desktop sidebar and expose an accessible mobile thread chooser/new-chat path instead of hiding all thread access below `md`. Add `ThemeToggle` to the shared chat chrome. Do not add a `key` or conditional remount to homepage `ThreadView`; the existing standalone `key={threadId}` remains route-specific.

- [ ] **Step 7: Verify chat unit/regression tests**

Run: `npm test -- src/components/thread-view.test.tsx src/components/chat-message.test.tsx src/components/chat-inspector.test.tsx src/hooks/use-inline-assistant.test.tsx`
Expected: PASS, including NDJSON/citation preservation and overlay mount identity.

- [ ] **Step 8: Browser-check chat states at 360/768/1440**

Use mocked unit states for unavailable backend paths and real browser rendering for available shells. Check mobile inspector, thread chooser, composer controls, long messages/citations, active-call layout fixtures where available, and both themes. Record credential-dependent streaming/voice checks separately and leave files uncommitted.

---

### Task 6: Voice Switcher, Active Feedback, and Diagnostics

**Files:**
- Modify: `src/components/voice-switcher.tsx`, `src/components/voice-diagnostics.tsx`, `src/components/thread-view.tsx`, `src/styles.css`
- Test: `src/components/voice-switcher.test.tsx`, `src/components/voice-diagnostics.test.tsx`

**Interfaces:**
- Preserves: `VoiceSwitcher` props, `useVoicePrefs`, `TelemetryPanel` props, `VoiceOrb` props, telemetry refs, keyboard shortcut, worklet/WebRTC behavior, and all callbacks.
- Adds no new voice service or voice preference key.

- [ ] **Step 1: Write failing keyboard and production-gating tests**

Voice tests render the real personas/languages with preview/selection spies. Assert `aria-expanded`, selection, preview, language lock, outside dismissal, Escape closes and restores trigger focus, and long language/persona labels stay within a viewport-bounded popover. Diagnostics tests stub `import.meta.env.DEV`; assert production renders no telemetry/dev-only controls while development retains the Ctrl+Shift+D entry and check suites.

- [ ] **Step 2: Run voice tests and verify failure**

Run: `npm test -- src/components/voice-switcher.test.tsx src/components/voice-diagnostics.test.tsx`
Expected: FAIL on focus restoration and production gating.

- [ ] **Step 3: Implement accessible Noir voice controls**

Restyle trigger/popover, selected persona, preview states, language selector, active-call status, captions, mute/output/end controls, playback-blocked action, and end-reason resume state. Use text/icon semantics in addition to color, visible focus, 44px touch targets, and wrapping for French/Hindi labels. Return focus on Escape; do not change mid-call persona reconnect or read-aloud hot-swap logic.

- [ ] **Step 4: Harden and restyle diagnostics without changing telemetry**

Keep the existing refs and 100ms updates only while the HUD is open. Gate development-only telemetry/debug UI in production; keep functional voice status visible. Bound HUD/system-check layouts to mobile viewports with internal scrolling. Respect reduced motion in `VoiceOrb` while retaining static state feedback; do not change audio worklets or telemetry mutation.

- [ ] **Step 5: Verify voice tests and existing voice logic suite**

Run: `npm test -- src/components/voice-switcher.test.tsx src/components/voice-diagnostics.test.tsx src/lib/voice-logic.test.ts src/lib/language.test.ts src/lib/speech.test.ts src/hooks/use-inline-assistant.test.tsx`
Expected: PASS. Report actual microphone/live-call verification as blocked unless valid configuration and browser permissions exist. Leave files uncommitted.

---

### Task 7: Eval, Auth, Errors, and Shared Primitives

**Files:**
- Modify: `src/routes/eval.tsx`, `src/routes/auth.tsx`, `src/routes/__root.tsx`, `src/styles.css`
- Modify as needed for used primitives only: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/table.tsx`, `src/components/ui/sonner.tsx`
- Test: `src/routes/auth.test.tsx`, `src/routes/eval.test.tsx`, `src/test/root-error-contracts.test.ts`

**Interfaces:**
- Consumes: semantic tokens and `ThemeToggle`.
- Preserves: eval streaming/cancellation/run comparison, auth mode/sign-in/sign-up/navigation, root error reporting/reset, and all primitive prop APIs.

- [ ] **Step 1: Write failing auth/eval accessibility tests**

Auth tests require associated email/password labels, `role="alert"` for failures, busy state, and unchanged Supabase calls. Eval tests require keyboard-operable case detail controls with `aria-expanded`, labelled horizontal table scrolling, preserved run/stop actions, and error status. Root contract tests require a main landmark, useful recovery actions, and retained `reportLovableError` behavior. Render route components through `Route.options.component`/`Route.options.errorComponent`; do not add public exports solely for tests.

- [ ] **Step 2: Run surface tests and verify failure**

Run: `npm test -- src/routes/auth.test.tsx src/routes/eval.test.tsx src/test/root-error-contracts.test.ts`
Expected: FAIL on labels, keyboard detail controls, and/or accessible error structure.

- [ ] **Step 3: Implement Noir auth and root recovery surfaces**

Build a restrained editorial auth panel with labelled inputs, validation, loading, success/error text, mode switch, home route, and theme switch. Restyle 404/error with brand mark, clear heading/copy, Try again/Go home actions, and preserved error reporting/reset. Use existing primitives where useful without broad rewrites of all 46 UI files.

- [ ] **Step 4: Implement responsive eval presentation**

Restyle header, metric tiles, deltas, run/stop/error/empty states, expanded answers, chips, and tables. Keep exact metric parsing, golden ordering, NDJSON handling, abort behavior, and previous-run comparison. Make rows keyboard accessible and contain intentional table/code scrolling with a labelled region. Add `ThemeToggle` and mobile metric reflow.

- [ ] **Step 5: Normalize feature-visible primitives and states**

Ensure used buttons/inputs/dialogs/tables/toasts inherit corrected semantic tokens, restrained radii, visible focus, disabled/busy/error states, and both-theme chart/status colors. Do not rewrite unused primitives; they inherit the global token system automatically.

- [ ] **Step 6: Verify tests and browser states**

Run: `npm test -- src/routes/auth.test.tsx src/routes/eval.test.tsx src/test/root-error-contracts.test.ts src/test/app-routing.test.tsx`
Expected: PASS. Browser-check `/eval`, `/auth`, and an unknown route in both themes at 360/768/1440, including keyboard case expansion and contained wide data. Leave files uncommitted.

---

### Task 8: Responsive Admin Console and Knowledge-Base Editor

**Files:**
- Modify: `src/routes/_authenticated/admin.tsx`, `src/components/admin-kb.tsx`, `src/styles.css`
- Test: `src/routes/admin.test.tsx`, `src/components/admin-kb.test.tsx`

**Interfaces:**
- Preserves: `amIAdmin`, visitor polling, thread selection, sign-out/query clearing, all admin server calls, KB draft shape, PDF extraction/review, save/delete/reindex operations, and cache-warm status messages.
- Consumes: shared tokens and `ThemeToggle`; no new admin data contract.

- [ ] **Step 1: Write failing admin/KB state tests**

Mock admin functions and Supabase. Assert access loading/denied states have landmarks/status, sessions/KB tabs remain operable, selecting a visitor retains first-thread behavior, and empty states are useful. KB tests require associated title/section/content labels, upload control name, disabled save rules, PDF extraction failure/success status, delete confirmation, and reindex status.

- [ ] **Step 2: Run owner-surface tests and verify failure**

Run: `npm test -- src/routes/admin.test.tsx src/components/admin-kb.test.tsx`
Expected: FAIL on missing labels/landmarks and incomplete state presentation.

- [ ] **Step 3: Redesign admin session console responsively**

Restyle access states, header/tabs/sign-out, visitor list, metadata, thread list, messages, loading/error/empty states. Replace desktop-only `grid-cols-[300px_260px_1fr]` with a usable mobile stacked/scrollable layout and a three-column wide layout; keep visitor/thread selection and 30-second polling unchanged. Contain long user agents/referrers/messages without page overflow. Add `ThemeToggle`.

- [ ] **Step 4: Redesign KB editor and dialogs responsively**

Replace fixed `grid-cols-[1fr_420px]` with single-column mobile/tablet and split wide layout. Style source list, built-in disclosure, PDF upload/review, extracted text, form labels, save/cancel/delete/reindex busy states, status messages, and native/existing confirmation presentation. Keep all extraction and server calls unchanged.

- [ ] **Step 5: Verify owner tests and available browser states**

Run: `npm test -- src/routes/admin.test.tsx src/components/admin-kb.test.tsx`
Expected: PASS. Browser-check access-denied/loading and any locally available fixtures at 360/768/1024/1440. Mark authenticated visitor/KB operations blocked if credentials are unavailable. Leave files uncommitted.

---

### Task 9: Full Regression, Accessibility, Responsive, and Performance Gate

**Files:**
- Modify only to fix verified issues: files from Tasks 1–8
- Create at Task 1 and update throughout: `docs/superpowers/noir-signal-validation.md`
- Test: `src/test/noir-motion.test.ts`; local screenshots under `.playwright-mcp/noir-signal/`

**Interfaces:**
- Consumes every prior public interface and preservation contract.
- Produces a recorded validation matrix, measured asset/bundle/CLS results, and explicit blocked checks; no release/commit action.

- [ ] **Step 1: Write final motion/contract audit**

Read production CSS/source and assert reduced-motion handling covers building, windows, sunlight, reveal, caret/typewriter, voice orb, smooth scrolling, and cinematic transitions; reduced-data removes decorative overlays and prefers the smaller image; continuous keyframes animate only transform/opacity. Include co-browse/static contracts and asset budgets in the final audit command.

- [ ] **Step 2: Run final audit and record any failure**

Run: `npm test -- src/test/noir-motion.test.ts src/test/home-contracts.test.ts src/test/noir-assets.test.ts`
Expected: PASS if earlier tasks are complete; otherwise FAIL on each missing safeguard. Do not weaken assertions to obtain a pass.

- [ ] **Step 3: Fix every audit failure and rerun**

Modify only the owning Task 1–8 file for each verified failure. Rerun the Step 2 command until all motion, reduced-data, contract, and asset checks PASS.

- [ ] **Step 4: Run complete automated validation**

Run, separately and record exact results:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: PASS. Investigate any failure; identify pre-existing failures with baseline evidence instead of attributing them to the redesign.

- [ ] **Step 5: Verify theme and public homepage browser matrix**

At 360, 390, 768, 1024, 1440, and 1920px, capture both themes of hero, work, experience/stack/footer, and open chat. Verify no horizontal overflow, header/composer usability, sticky/safe-area behavior, no-flash reload, system/manual theme behavior, and switch during an open conversation. Screenshot-check every window light after resize and theme changes.

- [ ] **Step 6: Verify all interaction and accessibility paths**

Keyboard-only: navigation, theme, Enter/Shift+Enter, suggestions, overlay focus trap/Escape/focus return, composer controls, citations/inspector, eval details, auth, admin tabs, and dialogs. Check 200% zoom, coarse pointer, reduced motion, reduced data where supported, visible focus, 44px touch targets, long names/messages/citations, and French/Hindi voice text. Run an AA contrast audit for representative text, muted text, controls, focus, error/success/voice/chart states in both themes; adjust tokens if needed.

- [ ] **Step 7: Verify preservation contracts with clear environment boundaries**

Exercise `?hl=<id>`, `?skill=<tech>`, project anchors, source `#cite-n`, co-browse hit marker, anonymous thread identity, read-aloud exclusion during recording/calls, and existing route behavior using available mocks/configuration. With valid backend configuration, additionally verify immediate NDJSON dispatch before 900ms completion, active-stream close/reopen, live voice/barge-in/captions/telemetry, and no `ThreadView` remount. With current missing configuration, mark each such check **BLOCKED** with the exact environment reason.

- [ ] **Step 8: Measure performance against the recorded baseline**

Record local transferred hero image sizes by viewport, theme/hero-related JavaScript gzip size, production build output, and public-shell CLS from browser Performance APIs/Lighthouse if available. Confirm ≤180KB mobile/≤300KB desktop images, approximately ≤15KB theme/hero JS, CLS<0.05, no new animation dependency, no continuous React updates, and paused hidden/offscreen ambient work. Record machine/browser/network and do not invent a Lighthouse score.

- [ ] **Step 9: Complete final whole-diff review and handoff**

Review the complete diff for accidental backend/content changes, runtime external image URLs, development-data production leakage, generated `routeTree` edits, unowned artifacts, and unfinished surfaces. Put commands/results, screenshot paths, performance numbers, fixed issues, and blocked checks in `docs/superpowers/noir-signal-validation.md`. Present the running frontend for user review. Leave everything local and uncommitted; do not push to Lovable.
