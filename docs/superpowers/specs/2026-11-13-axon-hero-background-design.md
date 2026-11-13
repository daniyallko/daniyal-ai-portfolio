# AXON hero background design

## Intent

Replace the generic computational face with the approved AXON-inspired sculpted particle ring. The ring sits behind the complete homepage hero so it is visible in the first fold while the recruiter-facing copy and assistant remain the primary interface.

## Approved behavior

- Render a dense, hollow, organically twisted ring using GPU particles.
- Stir particles through a GPU fluid field from pointer and touch movement.
- Add subtle camera gaze and restore particles to the sculpted surface after interaction.
- Use white-grey particles with sparse lavender accents in dark mode.
- Use `#506c00` for the cloud in light mode so it remains visible.
- Target 262,144 particles on unrestricted desktop and 16,384 on mobile/coarse-pointer devices.
- Keep the portfolio navigation, hero copy, command dock, assistant, projects, and all other content unchanged.
- Do not add AXON navigation, tags, cards, videos, branding, copy, or external media.

## Architecture

Reuse the existing client-only `HeroPortrait` lifecycle boundary but replace its face engine with an AXON engine. The visual fills the hero absolute inset behind the existing z-indexed content. Three.js remains dynamically imported outside SSR. No animation dependency or UMD script is added.

The engine owns a GPU position simulation and a half-float fluid simulation. Position textures drive point vertices; an SDF, curl noise, origin spring, and projected fluid velocity update particles each frame. Fluid passes implement splats, curl, vorticity, divergence, pressure, gradient subtraction, and advection at the approved resolutions. A locally generated soft matcap is embedded or generated without a network dependency.

The existing wrapper continues to own assistant, intersection, document visibility, reduced motion, reduced data, connection changes, and first-frame readiness. The engine consumes `data-paused`, observes theme changes, and disposes all GPU resources.

## Fallbacks and accessibility

A static AXON-ring SVG replaces the face fallback. It remains visible until the first rendered frame and for reduced motion, reduced data, unavailable WebGL, asset/setup failure, or context loss. The visual is decorative and hidden from assistive technology. Pointer input does not intercept dock or navigation controls.

Light mode uses the same static geometry with `#506c00`. Reduced-motion and reduced-data modes do not mount the simulations.

## Constraints

- Preserve TanStack Start, React 19, Cloudflare Workers, `ThreadView`, voice, RAG, telemetry, anchors, co-browsing, and published contact links.
- Keep WebGL client-only and avoid per-frame React state.
- Preserve `src/lib/portfolio.ts` as the content source of truth.
- Remove obsolete generic-face assets and generation code only after the AXON replacement works.
- Do not claim physical-device frame rates from headless testing.
- Do not add commits or pushes unless separately requested.

## Reference and builder decisions

The approved reference is the AXON recreation brief supplied with the request. Its exact scene values govern the silhouette: camera FOV 30, near 0.1, far 1000, base position `(-1.17, 0, 6)`; group position `(0.343, 0.16, -1)`, rotation `(-28.4°, 390°, 4.92°)`, and scale `(5, 5, 6)`. The SDF is a closed, smooth, twisted ring with a large opening, depth mirroring, and quaternion `(0.5, 0.5, 0.5, 0.5)`. The ring fills the hero and sits slightly right of center; verification must preserve text readability.

Fluid velocity, curl, vorticity, divergence, and pressure use 256×256 targets. Density uses 512×512. Use velocity dissipation 0.98, density dissipation 0.97, pressure dissipation 0.95, five pressure iterations, curl 30, and dt 1/60. Mobile runs the same full fluid pipeline with 16,384 particles; the splat radius uses the brief's 0.8 mobile multiplier.

Pointer and touch use passive window pointer listeners. They never call `preventDefault`, and the canvas has `pointer-events: none`, so dock input, navigation, text selection, and native scrolling remain available. Pointer coordinates are measured against the hero bounds. Camera gaze follows the brief's lerp 0.05.

The static fallback is generated offline from the same ring parameters. A single monochrome SVG mask is tinted through `currentColor`: `#506c00` in light mode and ivory in dark mode. This avoids dual-theme downloads and keeps the fallback silhouette aligned with the GPU form. The generator is deterministic and the fallback has no runtime dependency.

SwiftShader verification may reduce particle and fluid resolutions through explicit engine-only test overrides. Production defaults remain the approved values.

## Verification

Use failing tests before implementation for shader/configuration contracts, static fallback, theme colors, particle budgets, lifecycle, and hero placement. Run the full suite, TypeScript, and production build. Drive desktop and mobile in both themes; inspect first-fold visibility, pointer/touch behavior, pause/resume, reduced preferences, context loss, and console/network errors. Use reduced particle budgets in browser lifecycle checks where SwiftShader makes the full desktop simulation impractical, and disclose that limitation.
