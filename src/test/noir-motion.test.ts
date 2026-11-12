import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const css = read("src/styles.css");
const portrait = read("src/components/hero-portrait.tsx");
const engine = read("src/components/particle-face-engine.ts");
const hero = read("src/components/home-hero.tsx");
const overlay = read("src/lib/overlay-motion.ts");
const orb = read("src/components/voice-diagnostics.tsx");
const thread = read("src/components/thread-view.tsx");
const home = read("src/routes/index.tsx");
const root = read("src/routes/__root.tsx");
const ambient = read("src/components/ambient-cursor-glow.tsx");

const reducedMotionBlock =
  css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
const reducedPortraitBlock =
  css.match(
    /@media \(prefers-reduced-motion: reduce\), \(prefers-reduced-data: reduce\) \{([\s\S]*?)\n\}/,
  )?.[1] ?? "";
const reducedDataBlock =
  css.match(/@media \(prefers-reduced-data: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

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
  it("disables portrait, reveal, caret, and cinematic motion", () => {
    expect(reducedPortraitBlock).toContain(".hero-portrait__stage");
    expect(reducedPortraitBlock).toContain(".hero-portrait__fallback");
    expect(reducedPortraitBlock).toContain("opacity: 1");
    for (const name of [
      "reveal",
      "hero-exit",
      "assistant-overlay",
      "chat-message-in",
      "voice-console",
    ]) {
      expect(reducedMotionBlock).toContain(`.${name}`);
    }
    expect(reducedMotionBlock).toContain(".caret");
    expect(reducedMotionBlock).toContain(".ambient-glow");
    expect(hero).toContain("const PROMPT =");
    expect(hero).not.toContain("useTypewriter");
    expect(overlay).toContain('if (reducedMotion || entry === "voice") return 0');
  });

  it("places the complete reduced-motion override after every motion declaration", () => {
    const override = css.lastIndexOf("@media (prefers-reduced-motion: reduce) {");
    for (const declaration of [
      ".hero-enter {",
      ".assistant-overlay {",
      ".chat-message-in {",
      ".voice-popover, .telemetry-popover {",
      ".home-hero {",
      ".hero-portrait__fallback {",
    ]) {
      expect(css.indexOf(declaration), declaration).toBeLessThan(override);
    }
    const finalBlock = css.slice(override);
    for (const name of ["hero-enter", "home-hero", "hero-portrait__fallback", "hl-pulse", "breathe"]) {
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
      if (!source.includes('"smooth"')) continue;
      expect(source).toContain(
        'window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"',
      );
      expect(source).not.toContain('scrollIntoView({ behavior: "smooth"');
    }
  });

  it("removes decorative overlays and the live renderer for reduced data", () => {
    expect(reducedDataBlock).toMatch(
      /\.ambient-glow,\s*\.hero-portrait__stage\s*\{\s*display:\s*none;/,
    );
    expect(portrait).toContain("reducedData: dataQuery.matches");
    expect(portrait).toContain("connection?.saveData");
  });

  it("keeps continuous keyframes on compositor-friendly transform and opacity", () => {
    for (const name of ["breathe", "caret", "signal-pulse"]) {
      const body = keyframesBody(name);
      expect(body, name).not.toBe("");
      expect(body, name).not.toMatch(
        /(?:^|[;{])\s*(?:box-shadow|background(?:-color)?|filter|clip-path|width|height|top|left)\s*:/,
      );
      expect(body, name).toMatch(/(?:transform|opacity)\s*:/);
    }
    expect(css).not.toContain("hero-building-drift");
    expect(css).not.toContain("hero-window-glow");
    expect(css).not.toContain("hero-sunlight");
  });

  it("pauses hidden portrait work and avoids continuous React state updates", () => {
    expect(portrait).toContain("IntersectionObserver");
    expect(engine).toContain('attributeFilter: ["data-paused"]');
    expect(engine).toContain('document.visibilityState === "visible"');
    expect(engine).toContain("cancelAnimationFrame");
    expect(portrait).toContain('document.visibilityState === "hidden"');
    expect(portrait).not.toContain("useState");
    expect(ambient).not.toContain("useState");
    expect(ambient).toContain("(pointer: coarse), (prefers-reduced-motion: reduce)");
  });

  it("adds no animation runtime dependency", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of ["gsap", "framer-motion", "motion", "@react-spring/web"]) {
      expect(dependencies[name]).toBeUndefined();
    }
  });

  it("removes competing critters without changing root route behavior", () => {
    expect(root).not.toContain("AmbientCritters");
    expect(root).not.toContain("ambient-critters");
    expect(root).toContain("<AmbientCursorGlow />");
    expect(root).toContain("<ThemeProvider>");
    expect(root).toContain("<Outlet />");
    expect(root).toContain("supabase.auth.onAuthStateChange");
    expect(root).toContain("<QueryClientProvider client={queryClient}>");
  });
});
