# Noir Signal Frontend Redesign — Design

**Date:** 2026-11-09
**Status:** Approved by user; implementation plan complete, awaiting execution review
**Size:** Project; requires a full implementation plan before implementation

## Intent

Rebuild the portfolio’s complete visual language so a recruiter’s first reaction is that the site is exceptionally well art-directed and engineered. The target is a bespoke, premium “Noir Signal” experience: cinematic architecture, editorial typography, disciplined spacing, one electric accent, and continuous ambient motion that does not compromise page speed or usability.

The portfolio’s AI conversation remains the centerpiece. The redesign must improve presentation without breaking text chat, live voice, dictation, read-aloud, RAG, citations, co-browsing, telemetry, anonymous persistence, owner tooling, or existing routes.

## User-approved direction

The user approved the interactive Noir Signal hero concept and requested a full-frontend redesign using it, with one correction: dark-mode window lights must align with the actual building windows.

Decisions explicitly made by the user:

- Use **Noir Signal**, not the Kinetic Precision or Liquid Interface directions.
- Provide complete **dark and light themes** with a visible switch.
- Keep the existing **hero chatbox in the hero**, preserving its current role and behavior.
- Sending from the hero must produce a **cinematic transition without navigation, reload, or loss of chat state**.
- Use a **full-background building image**.
- In dark mode, building windows illuminate; in light mode, sunlight moves across the building.
- Redesign the **entire frontend and every element**, with continuous animations, strong page speed, and responsive behavior on every device.
- Avoid a generic AI-generated/template appearance.
- Correct the mockup’s floating/misaligned window lights; final lights must follow real building geometry.
- Apply Noir Signal across all non-hero surfaces without another mockup-review phase; the user will review the complete running frontend at the end.

## Goals

1. Establish one coherent, bespoke design system across public and owner-facing surfaces.
2. Make dark and light modes feel like two art-directed expressions of the same identity, not color inversion.
3. Preserve all existing product behavior and content sources while transforming presentation.
4. Add a memorable hero-to-chat cinematic sequence using the existing mounted `ThreadView`.
5. Use subtle continuous motion with strict rendering and asset budgets.
6. Deliver polished layouts at mobile, tablet, laptop, and wide-desktop sizes.
7. Meet WCAG AA contrast and keyboard/focus expectations, including reduced-motion support.
8. Keep all co-browsing anchors and telemetry hooks intact.

## Non-goals

- No backend, database, API, retrieval, prompt, model, or content-strategy redesign.
- No changes to `src/lib/portfolio.ts` content merely to support the visual design.
- No new routing structure or replacement of TanStack Start, React, Tailwind, or existing voice infrastructure.
- No new heavy animation framework, WebGL scene, continuous background video, or large carousel library.
- No rewrite of published git history.
- No migration of anonymous visitor identity or thread persistence.
- No new accounts or changes to admin authorization.
- No attempt to provision missing backend environment variables as part of the visual redesign.

## Anti-goals

The result must not:

- Look like a generic bento-grid AI template or a collection of unrelated effects.
- Trade readability for visual spectacle.
- Delay the first chat request while an animation completes.
- Remount `ThreadView` to create a transition.
- Use different buildings for day and night.
- Place lights using independent viewport percentages that drift away from windows.
- Cause layout shifts, continuous React renders, scroll jank, or large new JavaScript bundles.
- Leave admin, auth, eval, standalone chat, dialogs, inspectors, errors, or forms visually unfinished.
- Hide essential content when JavaScript or motion is unavailable.

## Current architecture and constraints

### Homepage and assistant

- Homepage sections and hero live in `src/routes/index.tsx`.
- The homepage lazy-loads and preloads `ThreadView`, retains an existing thread, and keeps the component mounted after opening.
- The current overlay is fixed and `100dvh`; closed state is hidden with opacity/pointer events. Opening does not navigate.
- `openAssistant({q})` queues a pending message or call and flushes through the existing control ref.
- Current visible overlay motion is only a 300ms opacity transition. A dormant `.hero-exit.leaving` style exists but is not activated.
- The hero composer owns its textarea, dictation, voice preferences, read-aloud preview, suggestions, and send behavior. These behaviors remain intact.
- The same `ThreadView` is reused by standalone chat.

### Styling

- Tailwind CSS v4 and semantic shadcn-style tokens live in `src/styles.css`.
- Current root tokens are always dark. No working system-preference provider, persistence, or theme switch exists.
- Existing fonts are Geist, Instrument Serif, and JetBrains Mono.
- Existing effects include noise, grids, reveal-on-scroll, pointer glow, card spotlights, and CSS motion. No Framer Motion-like dependency exists.
- Several referenced custom properties are missing, including `--signal`, `--hairline`, `--specular`, `--ease-out-expo`, `--glow-a`, and `--glow-b`; the token pass must define or replace them.

### Runtime reconnaissance

- Dependencies were installed with `bun install`; no lockfile change resulted.
- The app renders at `http://127.0.0.1:8080/`.
- Desktop hero, mobile hero, and mobile project layouts were inspected.
- Opening the assistant currently stalls at `booting assistant…` because the environment lacks `SUPABASE_SERVICE_ROLE_KEY`.
- `/api/public/rag-warm` returns `503` in the current local environment.
- These backend issues predate the redesign. Full chat/voice integration verification requires valid environment configuration and must not be claimed otherwise.

## Design system

### Color

Use semantic tokens for every surface and state; feature components must not invent competing palettes.

**Dark — Noir**

- Canvas: near-black neutral `#0B0C0C`
- Raised surface: `#121410`
- Primary text: warm off-white `#F2F2EB`
- Muted text: `#9A9C92`
- Signature accent: chartreuse `#CFFF62`
- Hairlines: low-opacity warm white
- Building: cool, deep monochrome grade with warm illuminated windows

**Light — Warm Ivory**

- Canvas: warm ivory `#F2F0E9`
- Raised surface: `#FAF8F1`
- Primary text: ink `#141510`
- Muted text: `#62645A`
- Signature accent surface: `#C6EC5B` with dark ink text
- Small accent text: dark olive approximately `#506C00`, adjusted only if needed to exceed AA
- Hairlines: low-opacity warm ink
- Building: daylight monochrome/warm grade with soft moving sunlight

Chartreuse is the single signature accent. Semantic success, warning, error, voice-active, and chart colors remain distinguishable and readable in both themes. Never use bright chartreuse for small text on ivory.

### Typography

- **Geist:** headings, body, controls, and UI.
- **Instrument Serif:** selected italic editorial phrases, especially “talks back.”
- **JetBrains Mono:** availability, metadata, citations, telemetry, indexes, and technical labels.
- Headlines use tight tracking and responsive `clamp()` sizing; body copy keeps comfortable measure and line height.
- Retain the current font families and avoid adding another font dependency. Optimize loading without invisible text.

### Shape, depth, and texture

- Thin hairlines, precise grids, restrained radii, generous negative space.
- Composer and conversational surfaces use controlled translucent panels only where the background requires them.
- Use subtle grain as a static, non-interactive decorative layer; it must not sit over and degrade chat text.
- Avoid pervasive glassmorphism, excessive glow, nested cards, and arbitrary shadows.
- Use Lucide icons consistently with accessible labels and clear states.

## Theme behavior

- Apply `data-theme="dark"` or `data-theme="light"` to the root element and set matching `color-scheme`.
- First visit follows `prefers-color-scheme`.
- A manual choice persists under one versioned localStorage key and overrides system preference on later visits.
- A small pre-paint script applies the saved/system theme before React renders, preventing a theme flash.
- The shared switch appears in the homepage header and is reachable from standalone chat, eval, auth, and owner surfaces without duplicating theme logic.
- The switch has a visible sun/moon state, accessible name, keyboard focus, and at least a 44px touch target on small screens.
- If no explicit preference exists, system theme changes update the page; an explicit choice remains stable.
- Every component state—including hover, focus, disabled, streaming, recording, error, citations, dialogs, tables, charts, and code—receives both-theme treatment.

## Homepage design

### Header

- Sticky, safe-area-aware header with the current brand and Work/Experience/Stack anchors.
- Add the theme switch and retain the assistant entry point.
- Use a restrained translucent backdrop only after scroll or where needed for contrast.
- Mobile prioritizes brand, theme switch, and assistant access; no cramped desktop navigation.

### Hero

- Preserve current portfolio copy, primary hierarchy, composer behavior, suggestions, voice controls, and assistant entry points.
- Use the Noir Signal editorial composition: oversized Geist headline, Instrument Serif italic accent, compact mono availability label, restrained supporting copy.
- Keep the composer prominent and immediately usable; decorative motion never intercepts input or pointer events.
- Preserve Enter to send, Shift+Enter newline, textarea autosize, dictation insertion, voice persona selection, live-call start, read-aloud stopping, and query suggestions.

### Full-background building and aligned lighting

Use one local, optimized architectural source image for both themes. The exact approved reference is the 1800×1200 glass-building photograph at `https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=82` (Unsplash photo ID `1486406146926-c627a92ad1ab`). The approved mockups persist under `.superpowers/brainstorm/27773-1794229802/` during this design session. Final asset selection may refine the crop but must not substitute a different building.

The Unsplash license permits downloading, modifying, distributing, and using the image locally in this portfolio, including commercially, without payment or required permission: `https://unsplash.com/license`. The implementation must retain source/license notes with the asset. Unsold, unmodified image redistribution and building a competing image service are not part of this project.

- Serve appropriately sized AVIF/WebP with a fallback, explicit dimensions, and high priority only for the hero LCP image.
- Do not rely on a third-party image URL at runtime.
- The base photograph and every lighting overlay occupy the same absolutely positioned media box.
- Use one shared intrinsic coordinate system (`1800×1200` for the reference), shared `object-fit: cover`, shared `object-position`, shared responsive crop variables, and shared transforms.
- Define light shapes against **actual window polygons in source-image coordinates**. Do not use independently positioned viewport-percentage spans.
- Prefer two or three small inline-SVG/static transparent overlay groups, each aligned to real windows, animated with opacity only. No per-frame JavaScript coordinate calculations.
- In dark mode, existing and added warm window lights fade up subtly in staggered groups. Shapes stay clipped to their corresponding windows.
- In light mode, window-light overlays disappear and a soft sunlight layer moves slowly over the same façade using transform/opacity.
- Contrast scrims guarantee readable text and composer controls without making the building invisible.
- Responsive QA explicitly checks light/window alignment at 360, 390, 768, 1024, 1440, and 1920px widths.
- Runtime CSS grades/scrims are the default so only the active image variant downloads. Pre-rendered dark/light derivatives of the **same source photograph** are permitted if visual quality requires them; they must be theme-specific preloaded/loaded so the inactive theme is not downloaded. Image-size budgets apply per active theme, not as a combined total.

### Hero-to-chat cinematic transition

- Opening chat keeps the exact same `ThreadView` instance and thread ID mounted.
- Send/network work begins immediately; the visual transition never gates message dispatch or voice initialization.
- Sequence lasts roughly 800–950ms when a hero message/suggestion opens the conversation: hero content recedes with opacity/scale/translate, the architectural background subtly deepens, and the conversation expands from the composer region into the full overlay.
- Opening the empty assistant from the header uses the same visual language in a shorter 250–350ms fade/scale. Live-voice entry uses the shortest safe opening and never waits for choreography; all entry paths share the same focus, inert-background, scroll-lock, and mounted-overlay state layer.
- Clip-path is allowed for this short interaction only; continuous ambient effects remain transform/opacity-based.
- Closing reverses the visual relationship and restores the prior homepage scroll position and triggering-element focus.
- While open, trap focus, support Escape where safe, make background content inert, and preserve the previous body-overflow value.
- Maintain the existing audio element, telemetry refs, recorder state, pending message queue, stream, captions, citations, and source inspector.
- Provide a designed loading/failure state instead of a blank overlay or indefinite `booting assistant…` presentation.
- Reduced-motion mode replaces the cinematic sequence with an immediate visibility change and preserves all functionality.

### Stats and selected work

- Turn the stat strip into a precise editorial index with strong numerals and concise labels.
- Selected Work uses an asymmetric editorial grid, strong project numbering, clear production/personal labels, and technical metadata.
- AI BotKit remains featured; other projects stay in their current content order.
- Use restrained CSS/SVG technical motifs rather than unrelated stock imagery.
- Preserve every `proj-${project.id}` target and project/skill content relationship.

### Experience, stack, and footer

- Experience becomes a clean timeline with readable dates, roles, companies, and bullets; current three-bullet display remains unless separately requested.
- Tech stack becomes disciplined grouped columns/chips with clear hover/focus/highlight states.
- Footer becomes a strong but restrained contact close with education, email, and website.
- Preserve `#work`, `#log`, `#stack`, `#contact`, `data-skill`, and `data-group` contracts.

## Shared chat and standalone chat

Restyle all existing states without changing their data contracts:

- Header, persona/language switcher, back/close actions, thread sidebar, new/delete thread controls.
- Empty state and suggestions.
- User/assistant messages, streaming deltas, stop state, errors, citations, listen controls, and source links.
- Composer, dictation, live voice, voice switcher, active-call console, captions, and voice diagnostics.
- Source/debug inspector on desktop and mobile.
- Telemetry HUD and system checks remain functionally intact; development-only data must not leak into production presentation.
- Standalone `/chat` and `/chat/$threadId` receive the same design system but keep their existing navigation and thread behavior.

## Remaining frontend surfaces

Apply the same tokens, typography, controls, spacing, motion rules, and responsive treatment to:

- `/eval`: summary metrics, run comparison, tables, status states, and horizontal data handling.
- `/auth`: sign-in, validation, loading, and error states.
- `/admin`: visitor/session console, thread reading, role-gated states, tables, and empty/loading/error states.
- Admin KB editor: document list, upload/PDF review, extracted text, save/delete controls, and dialogs.
- Root 404/error screens and shared toast/dialog primitives.
- Generic UI primitives inherit corrected semantic tokens; feature-visible instances receive explicit visual QA.

Admin/KB desktop-only fixed grids must gain usable tablet/mobile layouts without changing admin functionality.

## Motion language

- Continuous motion is limited to slow building scale, window-light opacity, sunlight transform, small orbital/ambient accents, and existing voice feedback.
- Scroll reveals happen once with IntersectionObserver and transform/opacity; content remains visible without JavaScript.
- Hover/focus feedback is short and deliberate; no layout-affecting hover movement.
- Pause nonessential ambient work when offscreen or when the document is hidden.
- Avoid continuous React state updates. Use CSS, existing RAF-throttled pointer handling, and static SVG/media layers.
- Coarse pointers do not receive cursor-following effects.
- `prefers-reduced-motion` disables ambient motion, typewriter-like decorative movement, smooth scrolling, and cinematic interpolation while preserving state changes.
- Honor reduced data where practical by skipping decorative overlays and oversized image variants.

## Responsive rules

- Design mobile-first at 360/390px, then 768px, 1024px, 1440px, and 1920px.
- Use fluid typography/spacing, container-appropriate grids, `100dvh`, and safe-area utilities.
- No horizontal page scroll; intentional table/code scrolling remains contained and labelled where needed.
- Touch targets are at least 44px on touch layouts.
- Composer controls remain usable at 360px; secondary labels may collapse before icons or primary actions.
- Chat and inspectors use full-screen mobile presentations; admin tables/cards reflow rather than forcing desktop widths.
- Verify long names, long messages, citations, French/Hindi voice UI text, and zoom at 200%.

## Performance budgets

- No new heavy animation dependency.
- Theme and hero-motion JavaScript should add no more than approximately 15KB gzip; prefer far less.
- Hero image targets roughly ≤180KB for common mobile and ≤300KB for desktop when visually acceptable, using AVIF/WebP responsive sources.
- No new layout shift: reserve media and font space; target CLS below 0.05 on the public shell.
- Continuous animations use compositor-friendly transform/opacity and do not update layout or React state each frame.
- Below-fold imagery and noncritical overlays lazy-load; the hero LCP image does not.
- Measure the redesigned public shell against the current shell on the same machine/network. Do not claim a specific Lighthouse score without recording the test.

## Accessibility

- WCAG AA contrast for text, controls, focus indicators, and meaningful graphics in both themes.
- Semantic landmarks, headings, buttons, labels, and decorative `aria-hidden` treatment.
- Visible focus states and logical focus order.
- Theme switch and composer controls have accessible names and state.
- Chat overlay receives focus management, Escape behavior, background inerting, and focus restoration.
- Reduced-motion and static-image fallbacks preserve all content and actions.
- Voice/recording state is conveyed through text/icon semantics, not color alone.

## Preservation contracts

Do not alter:

- Anonymous visitor identity and visitor-scoped thread access.
- `src/lib/portfolio.ts` as the content source of truth or the IDs used by retrieval/co-browsing.
- Text NDJSON streaming, citations and `#cite-n` behavior, source/debug data shapes.
- `/api/live`, worklet URLs/message contracts, WebRTC flow, barge-in, turn IDs, and telemetry refs.
- `/api/transcribe`, `/api/speak`, persona/language behavior, or single-answer read-aloud behavior.
- RAG browser/cache keys and warm/prefetch behavior.
- `?hl=<id>`, `?skill=<tech>`, section anchors, project IDs, `data-skill`, `data-group`, and the co-browse hit marker.
- Visit tracking, owner alerts, admin role checks, and telemetry diagnostics.
- Generated `src/routeTree.gen.ts` conventions.

Any small interaction hardening required for reliable transitions must preserve these contracts and be covered by focused tests.

## Builder calls (not user mandates)

The builder may choose exact component decomposition and whether a small theme hook or provider best fits the existing root. The builder may tune token values for contrast, refine responsive crops, and choose SVG versus pre-rendered transparent overlays for aligned windows, provided the shared-coordinate requirement and performance budgets hold.

My design calls:

- Retain current fonts and content.
- Use one local building asset for both themes.
- Keep chartreuse as the only signature brand accent.
- Use approximately 900ms for the cinematic transition and immediate state changes for reduced motion.
- Include owner/admin/eval surfaces because the user requested the entire frontend.
- Add focus management and overlay hardening as part of the cinematic work, not as a separate product feature.
- Keep all backend/environment issues separate from visual implementation.

## Delivery and Lovable sync boundary

- The user has not requested a commit or push. Implementation proceeds in the local working tree without publishing partial states to Lovable.
- Keep implementation slices small and individually working so the branch is never intentionally left broken.
- Do not insert another mockup-approval phase for non-hero surfaces. Carry the established Noir Signal system through the complete implementation, then present the running frontend for the user’s end-to-end visual review.
- If the user later requests a commit, create a feature branch before the first commit rather than committing directly to `main`. Do not push, merge, or rewrite published history without a separate explicit request.

## Validation and acceptance

1. Run existing unit tests, lint, and production build; investigate and report any pre-existing failures separately.
2. Drive the real app in a browser at mobile, tablet, and desktop sizes in both themes.
3. Verify theme default, persistence, system behavior, no flash, keyboard use, and contrast.
4. Verify the hero composer’s Enter/Shift+Enter, dictation insertion, suggestions, and assistant opening.
5. With valid backend configuration, verify hero send creates no navigation/reload, preserves thread/messages, and begins dispatch before transition completion.
6. Verify close/reopen, active streams, live voice, read-aloud, citations, source inspector, and telemetry without remount-related resets. If credentials are unavailable, report these checks as blocked rather than passed.
7. Verify all co-browsing anchors, skill/project highlights, and generated URLs.
8. Screenshot-check aligned window lights at every required viewport and during theme changes.
9. Check reduced motion, 200% zoom, coarse pointer behavior, and horizontal overflow.
10. Record public-shell performance and asset sizes; confirm no heavy animation dependency and no continuous layout work.
11. Visually review standalone chat, eval, auth, admin/KB, loading, empty, error, streaming, and dialog states. Authenticated/backend-dependent checks must identify any environment blockers.

## Approval boundary

This document describes the complete project. After user approval, the next step is a full implementation plan using `superpowers:writing-plans`; product implementation begins only after that plan is established.
