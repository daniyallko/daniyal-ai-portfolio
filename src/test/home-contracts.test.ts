import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { projects } from "@/lib/portfolio";

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

  it("mounts one computational portrait in HomeHero outside the editorial wrapper", () => {
    expect(source).toContain('<HomeHero onOpen={assistant.go} assistantOpen={assistant.open} />');
    expect(hero.match(/<HeroPortrait paused=\{assistantOpen\}\s*\/>/g)).toHaveLength(1);
    expect(hero).not.toContain("HeroBuilding");
    expect(source).not.toContain("function Hero()");
    expect(source).toMatch(/<main id="top"[^>]*>\s*<HomeHero onOpen=\{assistant\.go\} assistantOpen=\{assistant\.open\} \/>/);
    expect(source).toMatch(
      /<HomeHero onOpen=\{assistant\.go\} assistantOpen=\{assistant\.open\} \/>\s*<div className="[^"]*mx-auto[^"]*max-w-6xl/,
    );
  });

  it("keeps dock behavior while replacing rotating copy with one stable prompt", () => {
    expect(hero).toContain('const PROMPT = "Ask about experience, projects, architecture, or availability…"');
    expect(hero).toContain("placeholder={");
    expect(hero).not.toContain("useTypewriter");
    expect(hero).toContain("speech.stop()");
    expect(hero).toContain("onOpen(pending)");
    expect(hero).toContain("e.key === \"Enter\" && !e.shiftKey");
    expect(hero).toContain("<VoiceSwitcher");
    expect(hero).toContain("toggleDictation");
    expect(hero).toContain("CHIPS.map");
  });

  it("keeps reveal content visible until JS opts into motion", () => {
    expect(styles).toMatch(/\.reveal\s*\{[^}]*opacity:\s*1/s);
    expect(styles).toContain(".motion-ready .reveal");
    expect(styles).toMatch(/\.motion-ready \.reveal\.in\s*\{[^}]*opacity:\s*1/s);
  });

  it("uses accessible metric animation and fact-derived project flows", () => {
    expect(source).toContain('import { CountUp } from "@/components/count-up"');
    expect(source).toContain('import { ProjectFlow } from "@/components/project-flow"');
    expect(source).toContain("<CountUp value={s.value} reducedMotion={reducedMotion} />");
    expect(source).toContain("const reducedMotion = useReducedMotion()");
    expect(source).toContain("{featured.flow && <ProjectFlow steps={featured.flow} />}");
    expect(source).toContain("{p.flow && <ProjectFlow steps={p.flow} />}");
    expect(projects.map((project) => project.flow)).toEqual([
      [
        "Website + documents",
        "Hybrid retrieval + reranking",
        "LangGraph agent + memory",
        "Web, WhatsApp, Telegram + voice",
      ],
      ["License sale", "Stripe subscription", "Activation + upgrades"],
      ["Speech-to-text", "Streaming LLM", "Text-to-speech"],
      ["User request", "Agent orchestration", "Tool calling", "Coordinated response"],
    ]);
  });

  it("opens grounded project and skill-group questions through the existing assistant", () => {
    expect(source).toContain("const askProject = (name: string) =>");
    expect(source).toContain(
      "assistant.go({ q: `Tell me about Daniyal's ${name} project.` })",
    );
    expect(source).toContain("onClick={() => askProject(featured.name)}");
    expect(source).toContain("onClick={() => askProject(p.name)}");
    expect(source).toContain("const askGroup = (group: string) =>");
    expect(source).toContain(
      "assistant.go({ q: `Tell me about Daniyal's experience with ${group}.` })",
    );
    expect(source).toContain("onClick={() => askGroup(s.group)}");
  });

  it("gives primary contact links at least 44px hit areas", () => {
    expect(source).toMatch(
      /href=\{`mailto:\$\{profile\.email\}`\}\s+className="[^"]*\bmin-h-11\b/,
    );
    expect(source).toMatch(
      /href=\{`tel:\$\{profile\.phone\.replace\(\/\\s\/g, ""\)\}`\}\s+className="[^"]*\bmin-h-11\b/,
    );
    expect(source).toContain('href="#top" className="flex min-h-11 min-w-11');
  });
});
