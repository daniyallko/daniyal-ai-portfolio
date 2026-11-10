import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const css = read("src/styles.css");
const building = read("src/components/hero-building.tsx");
const hero = read("src/components/home-hero.tsx");
const overlay = read("src/lib/overlay-motion.ts");
const orb = read("src/components/voice-diagnostics.tsx");
const thread = read("src/components/thread-view.tsx");
const home = read("src/routes/index.tsx");
const ambient = read("src/components/ambient-cursor-glow.tsx");

const reducedMotionBlock = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
const reducedBuildingBlock = css.match(/@media \(prefers-reduced-motion: reduce\), \(prefers-reduced-data: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
const reducedDataBlock = css.match(/@media \(prefers-reduced-data: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

function keyframesBody(name: string) {
  const start = css.indexOf(`@keyframes ${name} {`);
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") depth -= 1;
    if (depth === 0) return css.slice(open + 1, i);
  }
  return "";
}

describe("Noir motion and reduced-data safeguards", () => {
  it("disables building, window, sunlight, reveal, caret, and cinematic motion", () => {
    for (const name of ["hero-building__frame", "hero-building__window", "hero-building__sunlight"]) {
      expect(reducedBuildingBlock).toContain(`.${name}`);
    }
    expect(reducedBuildingBlock).toContain("animation: none");
    for (const name of ["reveal", "hero-exit", "assistant-overlay", "chat-message-in", "voice-console"]) {
      expect(reducedMotionBlock).toContain(`.${name}`);
    }
    expect(reducedMotionBlock).toContain(".caret");
    expect(reducedMotionBlock).toContain(".ambient-glow");
    expect(hero).toContain("useTypewriter(PROMPTS, !reducedMotion");
    expect(overlay).toContain("if (reducedMotion || entry === \"voice\") return 0");
  });

  it("places the complete reduced-motion override after every motion declaration", () => {
    const override = css.lastIndexOf("@media (prefers-reduced-motion: reduce) {");
    for (const declaration of [".hero-enter {", ".assistant-overlay {", ".chat-message-in {", ".voice-popover, .telemetry-popover {", ".home-hero {", ".hero-building__image {"]) {
      expect(css.indexOf(declaration), declaration).toBeLessThan(override);
    }
    const finalBlock = css.slice(override);
    for (const name of ["hero-enter", "home-hero", "hero-building__image", "hl-pulse", "breathe"]) {
      expect(finalBlock).toContain(`.${name}`);
    }
    expect(finalBlock).toContain("transition: none");
  });

  it("draws one reduced-motion voice orb frame instead of a continuous RAF", () => {
    expect(orb).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
    expect(orb).toContain("if (!reducedMotion) raf = requestAnimationFrame(draw)");
    expect(orb).toContain("raf = requestAnimationFrame(draw)");
  });

  it("honors reduced motion for every programmatic smooth scroll", () => {
    for (const source of [thread, home]) {
      expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"');
      expect(source).not.toContain('scrollIntoView({ behavior: "smooth"');
    }
  });

  it("removes decorative overlays and selects the smaller image for reduced data", () => {
    expect(reducedDataBlock).toMatch(/\.ambient-glow,\s*\.hero-building__windows,\s*\.hero-building__sunlight\s*\{\s*display:\s*none;/);
    expect(building).toContain('media="(prefers-reduced-data: reduce)"');
    expect(building).toContain('srcSet="/images/noir-building-900.avif"');
  });

  it("keeps continuous keyframes on compositor-friendly transform and opacity", () => {
    for (const name of ["breathe", "caret", "signal-pulse", "hero-building-drift", "hero-window-glow", "hero-sunlight"]) {
      const body = keyframesBody(name);
      expect(body, name).not.toBe("");
      expect(body, name).not.toMatch(/(?:^|[;{])\s*(?:box-shadow|background(?:-color)?|filter|clip-path|width|height|top|left)\s*:/);
      expect(body, name).toMatch(/(?:transform|opacity)\s*:/);
    }
  });

  it("pauses hidden building work and avoids continuous React state updates", () => {
    expect(building).toContain("IntersectionObserver");
    expect(building).toContain('document.visibilityState === "hidden"');
    expect(css).toContain('.hero-building[data-paused="true"]');
    expect(building).not.toContain("useState");
    expect(ambient).not.toContain("useState");
    expect(ambient).toContain("(pointer: coarse), (prefers-reduced-motion: reduce)");
  });

  it("adds no animation runtime dependency", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of ["gsap", "framer-motion", "motion", "@react-spring/web"]) {
      expect(dependencies[name]).toBeUndefined();
    }
  });
});
