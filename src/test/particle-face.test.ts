import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  particleBudget,
  pointerInfluence,
  springStep,
} from "@/lib/particle-face";

describe("particleBudget", () => {
  it("uses 3000 points for an unrestricted desktop", () => {
    expect(
      particleBudget({
        width: 1440,
        coarse: false,
        reducedMotion: false,
        reducedData: false,
      }),
    ).toBe(3000);
  });

  it.each([
    { width: 390, coarse: false },
    { width: 1440, coarse: true },
  ])("uses 1500 points for mobile or coarse input: %o", ({ width, coarse }) => {
    expect(
      particleBudget({
        width,
        coarse,
        reducedMotion: false,
        reducedData: false,
      }),
    ).toBe(1500);
  });

  it.each(["reducedMotion", "reducedData"] as const)(
    "uses the static portrait for %s",
    (preference) => {
      expect(
        particleBudget({
          width: 1440,
          coarse: false,
          reducedMotion: false,
          reducedData: false,
          [preference]: true,
        }),
      ).toBe(0);
    },
  );
});

describe("springStep", () => {
  it("converges to the target with finite values", () => {
    let value = 0;
    let velocity = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      [value, velocity] = springStep(value, velocity, 1, 1 / 60);
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isFinite(velocity)).toBe(true);
    }
    expect(value).toBeCloseTo(1, 2);
    expect(Math.abs(velocity)).toBeLessThan(0.05);
  });

  it("does not advance for a zero timestep", () => {
    expect(springStep(0.25, -0.5, 1, 0)).toEqual([0.25, -0.5]);
  });
});

describe("pointerInfluence", () => {
  it("is strongest at the pointer and smooth within the radius", () => {
    expect(pointerInfluence(0, 0)).toBe(1);
    const halfway = pointerInfluence(0.16, 0);
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(1);
  });

  it("has no influence at or beyond the radius", () => {
    expect(pointerInfluence(0.32, 0)).toBe(0);
    expect(pointerInfluence(1, 1)).toBe(0);
    expect(pointerInfluence(0.4, 0, 0.4)).toBe(0);
  });
});

describe("generated generic face", () => {
  it("contains 6000 finite normalized interleaved point/normal samples", () => {
    const bytes = readFileSync(resolve("public/models/generic-face.bin"));
    expect(bytes.byteLength).toBe(6000 * 6 * 4);
    const samples = new Float32Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength / 4,
    );
    expect(samples).toHaveLength(36000);
    expect(Array.from(samples).every(Number.isFinite)).toBe(true);

    for (let index = 0; index < samples.length; index += 6) {
      expect(Math.abs(samples[index]!)).toBeLessThanOrEqual(1);
      expect(Math.abs(samples[index + 1]!)).toBeLessThanOrEqual(1);
      expect(Math.abs(samples[index + 2]!)).toBeLessThanOrEqual(1);
      const normalLength = Math.hypot(
        samples[index + 3]!,
        samples[index + 4]!,
        samples[index + 5]!,
      );
      expect(normalLength).toBeCloseTo(1, 4);
    }
  });

  it("keeps one theme-filtered static fallback and the MakeHuman CC0 notice", () => {
    const svg = readFileSync(resolve("public/images/generic-face.svg"), "utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Generic computational portrait");
    expect(svg).toContain("viewBox=");
    expect(svg).toContain('fill="#171920"');
    const css = readFileSync(resolve("src/styles.css"), "utf8");
    expect(css).toMatch(
      /\[data-theme="dark"\] \.hero-portrait__fallback \{\s*filter: invert\(1\);\s*\}/,
    );
    const notice = readFileSync(
      resolve("public/models/generic-face.LICENSE.txt"),
      "utf8",
    );
    expect(notice).toContain("MakeHuman");
    expect(notice).toContain("CC0 1.0 Universal");
    expect(notice).toContain(
      "https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj",
    );
  });
});
