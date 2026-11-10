import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("Noir Signal semantic tokens", () => {
  it("defines both root theme selectors", () => {
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('[data-theme="dark"]');
  });

  it.each(["signal", "hairline", "specular", "ease-out-expo", "glow-a", "glow-b"])(
    "defines --%s",
    (name) => expect(css).toMatch(new RegExp(`--${name}:\\s*[^;]+;`)),
  );

  it("uses the approved canvas, text, and accent colors", () => {
    for (const color of ["#0b0c0c", "#f2f2eb", "#cfff62", "#f2f0e9", "#141510", "#c6ec5b", "#506c00"]) {
      expect(css.toLowerCase()).toContain(color);
    }
  });

  it("uses readable signal text for bold Markdown in both themes", () => {
    expect(css).toMatch(/\.prose-chat strong\s*\{[^}]*color:\s*var\(--signal\)/);
  });

  it("keeps muted and placeholder text at the AA-compliant semantic token", () => {
    for (const path of ["src/components/thread-view.tsx", "src/components/chat-inspector.tsx", "src/components/admin-kb.tsx", "src/routes/auth.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source, path).not.toMatch(/text-muted-foreground\/\d+/);
    }
  });

  it("expands coarse-pointer controls to 44px and preserves inline citation layout", () => {
    expect(css).toMatch(/@media \(pointer: coarse\)\s*\{[\s\S]*button,[\s\S]*min-height:\s*44px/);
    expect(css).toMatch(/\.chat-citation\s*\{[^}]*min-height:\s*20px/);
    expect(css).toMatch(/\.chat-citation::after\s*\{[^}]*inset:\s*-12px/);
  });
});
