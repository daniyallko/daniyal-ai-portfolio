# Noir Signal building source

- Photograph: Unsplash photo `1486406146926-c627a92ad1ab`.
- Source URL: https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=82
- License: https://unsplash.com/license
- Intrinsic source dimensions: 1800×1200.
- Local derivatives: centered 900×600 and 1800×1200 AVIF/WebP, plus an 1800×1200 JPEG fallback. No alternate crop or façade distortion is applied; responsive cropping happens only through the shared CSS `cover` frame.
- Encoding: browser canvas produced same-crop WebP/JPEG and raw RGBA buffers; the host's native `libheif` 1.17.6 with its AOM encoder produced AVIF. No runtime dependency or remote conversion service is used.
- Window lighting uses polygons recorded in `src/lib/hero-media.ts` against these same intrinsic source coordinates.
