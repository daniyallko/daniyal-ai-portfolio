# AXON Hero Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the generic face with an interactive AXON GPU ring behind the complete first-fold portfolio hero in both themes.

**Architecture:** Keep the existing client-only lifecycle wrapper, but rename it to `AxonHero` and replace the face engine with a Three.js GPU computation and fluid pipeline. A deterministic monochrome SVG mask supplies the static fallback; CSS supplies exact theme colors. Existing portfolio content and assistant ownership remain unchanged.

**Tech Stack:** React 19, TypeScript, Three.js 0.187, GPUComputationRenderer, WebGL2 half-float render targets, Vitest, CDP.

**Spec:** `docs/superpowers/specs/2026-11-13-axon-hero-background-design.md`

## Global Constraints

- Desktop 262,144 particles; mobile/coarse pointer 16,384; reduced motion/data 0.
- Fluid simulation 256×256; dye 512×512; five pressure iterations.
- Dark cloud white-grey with sparse lavender; light cloud `#506c00`.
- Full hero background, behind content and visible in the first fold.
- Preserve assistant, voice, RAG, anchors, co-browsing, and all portfolio content.
- No AXON UI, videos, external media, UMD script, or animation dependency.
- No per-frame React state and no WebGL in SSR.
- No commits or pushes unless separately requested.

## Review Focus

- Mobile GPU cost: full fluid pipeline must pause offscreen and remain below the mobile particle budget.
- Pointer input over the dock: passive listeners must not block typing, scrolling, or controls.
- First-frame and context-loss behavior: static ring must remain until a real render completes.
- Theme changes: renderer must switch to exact `#506c00` without remounting or losing simulation state.
- Disposal: all compute variables, fluid targets, passes, textures, and renderer resources must be released.

---

### Task 1: AXON configuration and static ring

**Files:**
- Create: `src/lib/axon-field.ts`
- Create: `src/test/axon-field.test.ts`
- Create: `scripts/generate-axon-fallback.mjs`
- Create: `public/images/axon-ring.svg`

**Interfaces:**
- Produces: `axonBudget({ width, coarse, reducedMotion, reducedData }): number`, `AXON_LIGHT_COLOR = "#506c00"`, fluid and scene constants.

- [x] **Step 1: Write failing configuration tests**

Assert exact particle budgets, fluid sizes, pressure iterations, light color, and a deterministic SVG containing 1,400 circles and the generic-ring title.

- [x] **Step 2: Run tests and verify RED**

Run `bunx vitest run src/test/axon-field.test.ts`. Expected: module and SVG missing.

- [x] **Step 3: Implement configuration and generator**

Use deterministic torus sampling with the reference major/minor proportions and twist. Generate one monochrome SVG mask with no theme-specific duplicate.

- [x] **Step 4: Generate the asset and verify GREEN**

Run the generator and the focused test. Expected: all assertions pass; repeated generation produces identical bytes.

### Task 2: GPU fluid and particle engines

**Files:**
- Create: `src/components/axon-shaders.ts`
- Create: `src/components/axon-fluid.ts`
- Create: `src/components/axon-field-engine.ts`
- Test: `src/test/axon-engine.test.ts`

**Interfaces:**
- Consumes: Task 1 constants.
- Produces: `mountAxonField(host, { count, onReady, onContextLoss, simulationSize?, dyeSize? }): () => void`.

- [x] **Step 1: Write failing engine contracts**

Assert the twisted SDF depth mirror and quaternion, analytic curl derivatives, origin spring, fluid projection, 262,144/16,384 texture sizing, all fluid passes, five pressure iterations, passive pointer input, exact light uniform, first-frame callback, pause observer, and complete disposal.

- [x] **Step 2: Run contracts and verify RED**

Run `bunx vitest run src/test/axon-engine.test.ts`. Expected: modules missing.

- [x] **Step 3: Implement fluid passes**

Create half-float ping-pong targets and shaders for segment splats, curl, vorticity, divergence, pressure, gradient subtraction, velocity advection, and density advection. Expose `update(dt)`, `splat(...)`, `velocity`, `density`, `resize()`, and `dispose()`.

- [x] **Step 4: Implement particle computation and rendering**

Use GPUComputationRenderer, a 64×64 locally generated matcap, the approved scene transforms, camera gaze, exact particle shader behavior, normal blending in light mode, and additive blending in dark mode. Pause through wrapper `data-paused`; call `onReady` only after `renderer.render()`.

- [x] **Step 5: Verify GREEN**

Run the focused engine tests and TypeScript. Expected: contracts pass without WebGL in the test environment.

### Task 3: Hero replacement and lifecycle preservation

**Files:**
- Create: `src/components/axon-hero.tsx`
- Delete after replacement: `src/components/hero-portrait.tsx`, `src/components/particle-face-engine.ts`, `src/lib/particle-face.ts`, `src/test/particle-face.test.ts`, `src/test/hero-portrait.test.ts`, `scripts/generate-face-assets.mjs`, `public/images/generic-face.svg`, `public/models/generic-face.bin`, `public/models/generic-face.LICENSE.txt`
- Modify: `src/components/home-hero.tsx`, `src/components/home-hero.test.tsx`, `src/styles.css`, `src/test/home-contracts.test.ts`, `src/test/noir-motion.test.ts`
- Create: `src/test/axon-hero.test.ts`

**Interfaces:**
- Consumes: `mountAxonField` and `axonBudget`.
- Produces: `<AxonHero paused={assistantOpen} />` behind hero content.

- [x] **Step 1: Write failing wrapper and homepage tests**

Port the lifecycle cases to `AxonHero`; require one static mask, live preference changes, first-frame readiness, external pause, offscreen/hidden pause, and context-loss fallback. Require `.axon-hero` absolute inset behind `.hero-copy`, exact light mask color, and no generic-face references.

- [x] **Step 2: Run affected tests and verify RED**

Run `bunx vitest run src/test/axon-hero.test.ts src/components/home-hero.test.tsx src/test/home-contracts.test.ts src/test/noir-motion.test.ts`. Expected: `AxonHero` missing and old face contracts failing.

- [x] **Step 3: Implement the replacement**

Move the AXON canvas to a full-hero absolute layer before the content grid. Preserve all dock and assistant code. Rename CSS hooks and remove the old face implementation and assets only after the new mount is wired.

- [x] **Step 4: Verify GREEN and full suite**

Run affected tests, then `bunx vitest run` and `bunx tsc --noEmit`. Expected: all tests and typecheck pass.

### Task 4: Browser and production verification

**Files:**
- Update only test evidence under `/tmp/portfolio-audit-*`; no product deliverable.

- [x] **Step 1: Build**

Run `bun run build`. Expected: successful production build with no new warnings beyond the existing baseline.

- [x] **Step 2: Verify lifecycle and interaction in Chrome**

At desktop and mobile sizes, verify first-fold ring visibility, exact light/dark rendering, pointer/touch splats, gaze, one RAF while active, zero while paused, live preference changes, delayed setup fallback, context loss, and unavailable-WebGL fallback. Use explicit reduced GPU overrides for SwiftShader lifecycle checks and separately smoke-test production defaults.

- [x] **Step 3: Capture both themes**

Capture 1440×900, 1024×768, and 390×844. Check hero readability, no horizontal overflow, working dock/navigation, no unexpected console errors or failed responses.

- [x] **Step 4: Report measured limits**

Report tests, build, browser checks, evidence paths, any reduced-resolution test settings, and the absence of physical-device GPU/frame-rate claims.
