import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AXON_FLUID,
  AXON_LIGHT_COLOR,
  AXON_SCENE,
  axonBudget,
  axonFrameScale,
  axonOrigin,
  axonRingSdf,
  axonSplatRadius,
} from "@/lib/axon-field";

describe("AXON budgets and reference configuration", () => {
  it("uses the approved desktop and mobile particle counts", () => {
    expect(
      axonBudget({ width: 1440, coarse: false, reducedMotion: false, reducedData: false }),
    ).toBe(262144);
    expect(
      axonBudget({ width: 390, coarse: false, reducedMotion: false, reducedData: false }),
    ).toBe(16384);
    expect(
      axonBudget({ width: 1440, coarse: true, reducedMotion: false, reducedData: false }),
    ).toBe(16384);
  });

  it("disables GPU work for reduced motion or reduced data", () => {
    expect(
      axonBudget({ width: 1440, coarse: false, reducedMotion: true, reducedData: false }),
    ).toBe(0);
    expect(
      axonBudget({ width: 1440, coarse: false, reducedMotion: false, reducedData: true }),
    ).toBe(0);
  });

  it("pins the fluid, scene, and light-theme values", () => {
    expect(AXON_FLUID).toEqual({
      simulationSize: 256,
      dyeSize: 512,
      velocityDissipation: 0.98,
      densityDissipation: 0.97,
      pressureDissipation: 0.95,
      pressureIterations: 5,
      curl: 30,
      dt: 1 / 60,
    });
    expect(AXON_SCENE).toEqual({
      fov: 30,
      near: 0.1,
      far: 1000,
      camera: [-1.17, 0, 6],
      position: [0.343, 0.16, -1],
      rotation: [-28.4, 390, 4.92],
      scale: [5, 5, 6],
    });
    expect(AXON_LIGHT_COLOR).toBe("#506c00");
  });

  it("faces the torus opening toward the camera before scene rotation", () => {
    const [x, y, z] = axonOrigin(0, 0);
    expect(x).toBeGreaterThan(0.33);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(0.6 * 0.65 * 0.16 * Math.sin(0.3), 12);
  });

  it("keeps a large central opening and a tall reference silhouette", () => {
    expect(axonRingSdf([0, 0, 0])).toBeCloseTo(0.187, 3);
    let horizontal = 0;
    let vertical = 0;
    for (let index = 0; index < 1000; index += 1) {
      const [x, y] = axonOrigin(index * 0.17, index * 0.31);
      horizontal = Math.max(horizontal, Math.abs(x));
      vertical = Math.max(vertical, Math.abs(y));
    }
    expect(vertical / horizontal).toBeGreaterThan(1.2);
  });

  it("keeps sampled origins on the same rotated SDF zero surface", () => {
    let maximumDistance = 0;
    for (let index = 1; index <= 1000; index += 1) {
      const u = ((((Math.sin(index * 12.9898) * 43758.5453) % 1) + 1) % 1) * Math.PI * 2;
      const v = ((((Math.sin(index * 78.233) * 12345.6789) % 1) + 1) % 1) * Math.PI * 2;
      maximumDistance = Math.max(maximumDistance, Math.abs(axonRingSdf(axonOrigin(u, v))));
    }
    expect(maximumDistance).toBeLessThan(0.000001);
  });

  it("zooms out only when the hero is narrower than the reference frame", () => {
    expect(axonFrameScale(1440, 900)).toBe(1);
    expect(axonFrameScale(1024, 768)).toBe(1);
    expect(axonFrameScale(390, 932)).toBeCloseTo(0.6 / (390 / 932), 8);
    expect(axonFrameScale(0, 0)).toBe(1);
  });

  it("uses the approved 0.8 mobile splat-radius multiplier", () => {
    expect(axonSplatRadius(262144)).toBe(0.002);
    expect(axonSplatRadius(16384)).toBe(0.0016);
  });
});

describe("AXON static ring", () => {
  it("generates one deterministic 1400-point monochrome mask", () => {
    const path = resolve("public/images/axon-ring.svg");
    const generator = resolve("scripts/generate-axon-fallback.mjs");
    const before = readFileSync(path, "utf8");
    execFileSync(process.execPath, [generator]);
    const after = readFileSync(path, "utf8");
    expect(after).toBe(before);
    expect(after.match(/<circle /g)).toHaveLength(1400);
    expect(after).toContain("Generic AXON ring");
    expect(after).toContain('fill="white"');
    expect(after).not.toContain("<image");
  });
});
