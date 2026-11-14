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
  axonProject,
  axonQuality,
  axonRecoveryAlpha,
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

  it("projects static points through the live camera and group transform", () => {
    const point = axonOrigin(0.4, 1.2);
    expect(axonProject(point, 1440, 900)[0]).toBeCloseTo(946.767593, 5);
    expect(axonProject(point, 1440, 900)[1]).toBeCloseTo(315.582218, 5);
    expect(axonProject(point, 1024, 768)[0]).toBeCloseTo(705.508346, 5);
    expect(axonProject(point, 1024, 768)[1]).toBeCloseTo(269.296826, 5);
    expect(axonProject(point, 390, 844)[0]).toBeCloseTo(358.776595, 5);
    expect(axonProject(point, 390, 844)[1]).toBeCloseTo(324.92049, 5);
  });

  it("zooms out only when the hero is narrower than the reference frame", () => {
    expect(axonFrameScale(1440, 900)).toBe(1);
    expect(axonFrameScale(1024, 768)).toBe(1);
    expect(axonFrameScale(390, 932)).toBeCloseTo(0.6 / (390 / 932), 8);
    expect(axonFrameScale(0, 0)).toBe(1);
  });

  it.each([
    [390, 772],
    [360, 668],
  ])("overlays the narrow fallback on the live projection at %ix%i", (width, height) => {
    const css = readFileSync(resolve("src/styles.css"), "utf8");
    const narrowRule = css.match(/@media \(max-aspect-ratio: 3\/5\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const widthScaled = /background-size:\s*100% auto/.test(narrowRule);
    const scale = widthScaled ? width / 390 : height / 844;
    const maskWidth = widthScaled ? width : 390 * scale;
    const maskHeight = widthScaled ? 844 * scale : height;
    const baked = axonProject(axonOrigin(0.4, 1.2), 390, 844);
    const displayed = [
      (width - maskWidth) / 2 + baked[0] * scale,
      (height - maskHeight) / 2 + baked[1] * scale,
    ];
    const live = axonProject(axonOrigin(0.4, 1.2), width, height);
    expect(displayed[0]).toBeCloseTo(live[0], 8);
    expect(displayed[1]).toBeCloseTo(live[1], 8);
  });

  it("uses the same splat radius for mobile and desktop interactions", () => {
    expect(axonSplatRadius(262144)).toBe(0.002);
    expect(axonSplatRadius(16384)).toBe(0.002);
  });

  it("reduces mobile particle and DPR budgets without reducing fluid quality", () => {
    expect(axonQuality(16384)).toEqual({
      simulationSize: 256,
      dyeSize: 512,
      pressureIterations: 5,
      pixelRatio: 1,
      frameRate: 60,
    });
    expect(axonQuality(262144)).toEqual({
      simulationSize: 256,
      dyeSize: 512,
      pressureIterations: 5,
      pixelRatio: 1.25,
      frameRate: 60,
    });
  });
});

describe("AXON origin recovery", () => {
  it.each([30, 60, 120])("recovers at least 99 percent in one second at %i FPS", (fps) => {
    let residual = 1;
    for (let frame = 0; frame < fps; frame += 1) {
      residual *= 1 - axonRecoveryAlpha(1 / fps, false);
    }
    expect(residual).toBeLessThan(0.01);
  });

  it("keeps recovery weaker during active interaction and ignores invalid elapsed time", () => {
    expect(axonRecoveryAlpha(1 / 60, true)).toBeLessThan(axonRecoveryAlpha(1 / 60, false));
    expect(axonRecoveryAlpha(0, false)).toBe(0);
    expect(axonRecoveryAlpha(-1, false)).toBe(0);
    expect(axonRecoveryAlpha(Number.NaN, false)).toBe(0);
  });
});
