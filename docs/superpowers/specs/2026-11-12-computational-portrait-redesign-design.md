# Computational Portrait Redesign — Design

**Date:** 2026-11-12
**Status:** Approved by user on 2026-11-12
**Supersedes:** the building-specific portions of `2026-11-09-noir-signal-frontend-redesign-design.md`

## Intent

Replace the generic architectural hero with a product-specific computational portrait and make the remaining homepage evidence easier to inspect. Preserve the working recruiter assistant and every backend, content, voice, and co-browsing contract.

## Approved direction

- **Product:** A recruiter-facing portfolio with a working text and voice assistant for evaluating Daniyal's production AI engineering.
- **Character:** Exact, candid, responsive.
- **World:** Computational portraiture and live production signal paths.
- **Moments:** An interactive generic particle face and the assistant's grounded answers.
- **Signature:** A small lime live node connecting availability, system paths, and active assistant states.

Retain Geist, Instrument Serif, JetBrains Mono, warm ivory, near-black surfaces, and chartreuse. Remove page-wide amber critters and competing decorative effects. This is a focused polish pass, not a rebrand.

## Particle hero

- Use the head geometry from MakeHuman `hm08` `base.obj`, explicitly released under CC0 1.0 Universal. It is a generic face and must not be represented as Daniyal's likeness.
- Generate local binary point/normal data and static SVG fallbacks from the same samples. Keep the source URL and CC0 notice with generated assets.
- Start with 3,000 desktop particles and 1,500 mobile particles. Increase only after real-device profiling.
- Use cursor displacement, ambient motion, subtle camera gaze, and critically damped spring return over approximately 1–2 seconds.
- Use neutral ivory/graphite particles with a lime interaction response. Dark mode may use additive blending; light mode uses normal blending and dark ink points.
- Load Three.js only on the client through `ClientOnly` and dynamic import. Never import it into the SSR graph.
- Respect live reduced-motion and reduced-data changes. Skip enhancement for those preferences, unavailable WebGL, and unsuitable touch devices.
- Pause offscreen and in hidden documents. Restore a static fallback after WebGL context loss.
- Cap DPR at 2 on desktop and 1.5 on mobile. Never intercept page scrolling or assistant controls.

## Homepage refinement

- Keep current portfolio facts, section order, anchors, project IDs, and skill hooks.
- Keep the dock's text send, Enter/Shift+Enter behavior, dictation, voice preferences, read-aloud stopping, live calls, and immediate assistant opening unchanged.
- Use one stable composer prompt instead of rotating placeholder text. Keep all credentials and suggested questions with quieter presentation.
- Add data-derived system paths and explicit project assistant actions. Store any structured presentation data only in `src/lib/portfolio.ts`; do not invent claims.
- Animate metric numerals once without changing their final formatting or accessible values. SSR and reduced motion show final values immediately.
- Preserve experience content and every skill. Reduce chip noise and use explicit group-level assistant actions instead of making every skill a button.
- Make email primary and give brand, email, phone, and icon controls consistent hit areas.

## Non-goals

- No backend, RAG, prompt, model, database, route, visitor, or voice redesign.
- No `ThreadView` replacement or remount.
- No GSAP, Framer Motion, Motion, React Spring, carousel, or additional animation runtime.
- No fabricated likeness, project facts, proficiency levels, links, or metrics.
- No universal 60fps claim from headless testing.
- No commits, pushes, history rewrites, or provisioning missing backend credentials.

## Verification

Run unit tests, TypeScript, and production build. Inspect 1440×900, 1024×768, and 390×844 in both themes. Exercise keyboard/focus, reduced motion, reduced data, unavailable WebGL, context loss, offscreen pausing, hidden tabs, and horizontal overflow. Full chat/voice verification requires the missing local backend credentials and must be reported separately if still blocked.
