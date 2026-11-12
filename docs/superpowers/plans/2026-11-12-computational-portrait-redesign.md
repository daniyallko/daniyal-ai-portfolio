# Computational Portrait Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the architectural hero with a responsive generic particle face and refine the homepage around inspectable engineering evidence without changing assistant behavior.

**Architecture:** A local generator converts the CC0 MakeHuman head into interleaved point/normal data and static SVGs. `HeroPortrait` owns eligibility and lifecycle; a dynamically imported Three.js engine owns rendering without React frame updates. The existing homepage and assistant components remain mounted, with presentation-only refinements and data-driven assistant entry points.

**Tech Stack:** React 19, TanStack Start v1, TypeScript, Tailwind CSS 4, Three.js, Vitest, Cloudflare Workers boundaries.

**Spec:** `docs/superpowers/specs/2026-11-12-computational-portrait-redesign-design.md`

## Global Constraints

- Preserve `ThreadView`, `useInlineAssistant`, `/api/chat`, `/api/live`, AudioWorklets, multilingual personas, and all streaming/voice behavior.
- Preserve `src/lib/portfolio.ts` as the content source of truth, existing section order, anchors, project IDs, `data-skill`, and `data-group`.
- Keep WebGL and Three.js out of SSR through `ClientOnly` plus dynamic import.
- Add no GSAP, Framer Motion, Motion, React Spring, or other animation runtime.
- Use 3,000 desktop and 1,500 mobile particles initially; DPR caps are 2 and 1.5 respectively.
- Reduced motion, reduced data, unavailable WebGL, and context loss show the static portrait.
- The generic face is not Daniyal's likeness. Preserve the MakeHuman CC0 notice.
- Do not commit, push, rewrite history, or provision backend credentials.

## Review Focus

- Live preference changes: switching to reduced motion/data must dispose the active renderer; test in Task 2.
- Hidden/offscreen/context-loss transitions: no continuous RAF or orphan canvas remains; test in Task 2.
- Narrow/touch layouts: portrait and decoration must not intercept dock input or create overflow; test in Tasks 3 and 6.
- Animated statistics: suffixes, decimals, SSR values, and screen-reader text must remain exact; test in Task 4.
- Assistant entry points: new project/group actions must call the same `assistant.go` path without remounting `ThreadView`; test in Task 4.

---

### Task 1: Generic face assets and particle math

**Files:**
- Create: `scripts/generate-face-assets.mjs`
- Create: `public/models/generic-face.bin`
- Create: `public/models/generic-face.LICENSE.txt`
- Create: `public/images/generic-face-dark.svg`
- Create: `public/images/generic-face-light.svg`
- Create: `src/lib/particle-face.ts`
- Test: `src/test/particle-face.test.ts`

**Interfaces:**
- Produces: `particleBudget(input: { width: number; coarse: boolean; reducedMotion: boolean; reducedData: boolean }): number` returning 0, 1,500, or 3,000.
- Produces: `springStep(value: number, velocity: number, target: number, dt: number): [number, number]` using stiffness 42 and damping 13.
- Produces: `pointerInfluence(dx: number, dy: number, radius?: number): number` returning a smooth 0–1 weight.
- Generated binary layout: six little-endian float32 values per sample (`x, y, z, nx, ny, nz`), 6,000 samples.

- [ ] **Step 1: Write failing pure-math and asset tests**
  Assert exact desktop/mobile budgets, zero for reduced preferences, finite spring convergence, zero influence outside the radius, binary length `6000 * 6 * 4`, finite normalized positions, and a CC0 notice.
- [ ] **Step 2: Run tests and verify failure**
  Run `bunx vitest run src/test/particle-face.test.ts`; expect missing module/assets failures.
- [ ] **Step 3: Implement math and deterministic asset generator**
  Parse `base.obj`, crop the head, area-sample body/eye geometry with a fixed seed, normalize coordinates, and emit binary plus dark/light SVGs. Accept the OBJ path as a CLI argument; do not vendor the 1.7MB source OBJ.
- [ ] **Step 4: Generate assets from the verified CC0 source**
  Run `node scripts/generate-face-assets.mjs /tmp/portfolio-face-source.h0HQMg/base.obj`; record the source URL and CC0 statement in the license file.
- [ ] **Step 5: Run tests and verify pass**
  Run `bunx vitest run src/test/particle-face.test.ts`; expect PASS.

### Task 2: Client-only portrait lifecycle and Three.js renderer

**Files:**
- Create: `src/components/hero-portrait.tsx`
- Create: `src/components/particle-face-engine.ts`
- Modify: `package.json`
- Modify: `bun.lock`
- Test: `src/test/hero-portrait.test.ts`
- Test: `src/test/particle-face.test.ts`

**Interfaces:**
- Consumes: Task 1 budgets and generated `/models/generic-face.bin`.
- Produces: `HeroPortrait(): ReactElement` with `data-testid="hero-portrait"` and `data-paused`.
- Produces: `mountParticleFace(host: HTMLElement, options: { count: number; onContextLoss: () => void }): () => void` in the client-only engine.

- [ ] **Step 1: Write failing lifecycle/source-contract tests**
  Assert `ClientOnly`, dynamic engine import, live media-query listeners, `IntersectionObserver`, `visibilitychange`, context-loss fallback, renderer disposal, DPR caps, and no Three.js import in `hero-portrait.tsx`.
- [ ] **Step 2: Run tests and verify failure**
  Run `bunx vitest run src/test/hero-portrait.test.ts src/test/particle-face.test.ts`; expect missing component failure.
- [ ] **Step 3: Install Three.js only**
  Run `bun add three @types/three`; retain unrelated existing lockfile/package changes.
- [ ] **Step 4: Implement portrait eligibility and renderer cleanup**
  Always render static SVGs. Enhance only after hydration when eligible. Subscribe to preference changes and pause without continuous React updates. Remove canvas and dispose geometry, material, and renderer on cleanup/context loss.
- [ ] **Step 5: Implement the particle engine**
  Use `BufferGeometry` + `Points`, custom point shaders, spring return, pointer influence, subtle gaze, theme observation, resize handling, and one RAF loop. Keep canvas pointer events disabled.
- [ ] **Step 6: Run tests and verify pass**
  Run `bunx vitest run src/test/hero-portrait.test.ts src/test/particle-face.test.ts`; expect PASS.

### Task 3: Hero composition and recruiter dock

**Files:**
- Modify: `src/components/home-hero.tsx`
- Delete: `src/components/hero-building.tsx`
- Modify: `src/styles.css`
- Modify: `src/test/home-contracts.test.ts`
- Modify: `src/test/noir-motion.test.ts`

**Interfaces:**
- Consumes: `HeroPortrait` from Task 2.
- Preserves: `AssistantRequest`, `HomeHero({ onOpen })`, `send()`, `go()`, `speech.stop()`, `VoiceSwitcher`, dictation, and query chips.

- [ ] **Step 1: Change contracts to portrait requirements**
  Require one `HeroPortrait`, stable prompt copy, preserved dock controls, and static reduced-motion/data fallbacks. Remove building-specific assertions.
- [ ] **Step 2: Run changed tests and verify failure**
  Run `bunx vitest run src/test/home-contracts.test.ts src/test/noir-motion.test.ts`; expect portrait assertion failures.
- [ ] **Step 3: Integrate portrait and refine the hero**
  Reserve calm copy space, use the static/stable prompt, quiet credential styling, retain all controls, and keep assistant opening synchronous.
- [ ] **Step 4: Replace building CSS with portrait/theme CSS**
  Add desktop/tablet/mobile compositions, both-theme static fallbacks, reserved dimensions, and final reduced-motion overrides. Remove obsolete building rules.
- [ ] **Step 5: Run tests and verify pass**
  Run `bunx vitest run src/test/home-contracts.test.ts src/test/noir-motion.test.ts`; expect PASS.

### Task 4: Evidence interactions, statistics, stack, and contact

**Files:**
- Modify: `src/lib/portfolio.ts`
- Create: `src/components/count-up.tsx`
- Create: `src/components/project-flow.tsx`
- Modify: `src/routes/index.tsx`
- Modify: `src/styles.css`
- Test: `src/test/home-contracts.test.ts`
- Create: `src/test/count-up.test.tsx`

**Interfaces:**
- Produces: optional `Project.flow: string[]` derived only from existing facts.
- Produces: `CountUp({ value, reducedMotion }: { value: string; reducedMotion: boolean }): ReactElement`.
- Produces: `ProjectFlow({ steps }: { steps: string[] }): ReactElement`.
- Consumes: existing `assistant.go` for project and skill-group questions.

- [ ] **Step 1: Write failing formatting and action-contract tests**
  Cover `5+`, `1,000+`, `100k+`, `99.9%`, and `10k+`; require final accessible values and reduced-motion output. Require flow rendering, project/group `assistant.go` actions, preserved hooks, and 44px contact hit-area classes.
- [ ] **Step 2: Run tests and verify failure**
  Run `bunx vitest run src/test/count-up.test.tsx src/test/home-contracts.test.ts`; expect missing component/action failures.
- [ ] **Step 3: Implement data-driven components and homepage actions**
  Add only fact-derived flow arrays, neutral spotlight/focus treatments, explicit project questions, group questions, metric animation, and contact hit areas. Do not alter final metric strings or project order.
- [ ] **Step 4: Run tests and verify pass**
  Run `bunx vitest run src/test/count-up.test.tsx src/test/home-contracts.test.ts`; expect PASS.

### Task 5: Remove competing ambient decoration

**Files:**
- Modify: `src/routes/__root.tsx`
- Delete: `src/components/ambient-critters.tsx`
- Modify: `src/styles.css`
- Modify: relevant root/motion tests found by `rg`.

**Interfaces:**
- Preserves: `ThemeProvider`, `Outlet`, authentication subscription, and all route behavior.

- [ ] **Step 1: Write/adjust failing source contracts**
  Require no `AmbientCritters` mount while retaining `Outlet` and theme behavior.
- [ ] **Step 2: Run targeted tests and verify failure**
  Run the affected root and motion tests; expect stale critter assertions/imports to fail where applicable.
- [ ] **Step 3: Remove the critter layer and obsolete styles**
  Keep focus, co-browsing, chat, voice, and reduced-motion safeguards intact.
- [ ] **Step 4: Run targeted tests and verify pass**
  Re-run affected tests; expect PASS.

### Task 6: Full regression and browser verification

**Files:**
- Modify only files required to fix verified regressions.
- Update: `/tmp/portfolio-audit-driver/capture.mjs` for both-theme stable captures.

**Interfaces:**
- Consumes: all previous tasks and the existing dev server on port 8080.

- [ ] **Step 1: Run automated regression**
  Run `bunx vitest run`, `bunx tsc --noEmit`, and `bun run build`; record exact failures and fix redesign regressions.
- [ ] **Step 2: Capture both themes at all required viewports**
  Inspect hero, dock, stats, projects, experience, stack, contact, and assistant state at 1440×900, 1024×768, and 390×844. Assert no horizontal overflow.
- [ ] **Step 3: Exercise fallback and lifecycle paths**
  Verify reduced motion, reduced data, WebGL-disabled/context-loss fallback, offscreen/hidden pausing, live theme switching, and no duplicate RAF after preference changes.
- [ ] **Step 4: Exercise interaction and accessibility paths**
  Check keyboard focus, project/group assistant triggers, dock controls, contact targets, and touch scrolling. Do not claim chat/voice integration if `SUPABASE_SERVICE_ROLE_KEY` remains missing.
- [ ] **Step 5: Report measured outcome**
  Summarize tests, screenshots, remaining backend limitation, and performance observations without a universal 60fps claim.
