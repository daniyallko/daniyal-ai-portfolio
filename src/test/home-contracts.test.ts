import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/routes/index.tsx"), "utf8");
const hero = readFileSync(resolve(process.cwd(), "src/components/home-hero.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("homepage preservation contracts", () => {
  it("retains every static and dynamic co-browsing target", () => {
    for (const anchor of ["top", "work", "log", "stack", "contact"]) {
      expect(source).toContain(`id="${anchor}"`);
    }
    expect(source.match(/id=\{`proj-\$\{(?:featured|p)\.id\}`\}/g)).toHaveLength(2);
    expect(source).toContain("data-skill={it}");
    expect(source).toContain("data-group={s.group}");
    expect(source).toContain('dataset["cobrowseHit"]');
    expect(source).toContain("scrollIntoView");
  });

  it("keeps featured-first project ordering and the existing content collections", () => {
    expect(source).toContain("projects.find((p) => p.featured)");
    expect(source).toContain("projects.filter((p) => !p.featured)");
    expect(source).toContain("others.map((p, i)");
    expect(source).toContain("stats.map((s, i)");
    expect(source).toContain("experience.map((e, i)");
    expect(source).toContain("skills.map((s, i)");
  });

  it("mounts one building in a full-bleed HomeHero outside the editorial wrapper", () => {
    expect(source).toContain("<HomeHero onOpen={assistant.go} />");
    expect(hero.match(/<HeroBuilding\s*\/>/g)).toHaveLength(1);
    expect(source).not.toContain("function Hero()");
    expect(source).toMatch(/<main id="top"[^>]*>\s*<HomeHero onOpen=\{assistant\.go\} \/>/);
    expect(source).toMatch(/<HomeHero onOpen=\{assistant\.go\} \/>\s*<div className="[^"]*mx-auto[^"]*max-w-6xl/);
  });

  it("keeps reveal content visible until JS opts into motion", () => {
    expect(styles).toMatch(/\.reveal\s*\{[^}]*opacity:\s*1/s);
    expect(styles).toContain(".motion-ready .reveal");
    expect(styles).toMatch(/\.motion-ready \.reveal\.in\s*\{[^}]*opacity:\s*1/s);
  });
});
