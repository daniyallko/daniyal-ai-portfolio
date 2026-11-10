import { describe, expect, it } from "vitest";
import { BUILDING_VIEW_BOX, WINDOW_LIGHT_GROUPS } from "./hero-media";

describe("building window geometry", () => {
  it("uses the shared intrinsic frame", () => {
    expect(BUILDING_VIEW_BOX).toBe("0 0 1800 1200");
  });

  it("traces at least twelve real windows in three staggered groups", () => {
    expect(WINDOW_LIGHT_GROUPS).toHaveLength(3);
    expect(WINDOW_LIGHT_GROUPS.flatMap((group) => group.polygons).length).toBeGreaterThanOrEqual(
      12,
    );
  });

  it("uses bounded numeric source coordinates, never percentages", () => {
    for (const group of WINDOW_LIGHT_GROUPS) {
      expect(group.id).toBeTruthy();
      for (const polygon of group.polygons) {
        expect(polygon.length).toBeGreaterThanOrEqual(4);
        for (const point of polygon) {
          expect(point).toHaveLength(2);
          expect(typeof point[0]).toBe("number");
          expect(typeof point[1]).toBe("number");
          expect(Number.isFinite(point[0])).toBe(true);
          expect(Number.isFinite(point[1])).toBe(true);
          expect(point[0]).toBeGreaterThanOrEqual(0);
          expect(point[0]).toBeLessThanOrEqual(1800);
          expect(point[1]).toBeGreaterThanOrEqual(0);
          expect(point[1]).toBeLessThanOrEqual(1200);
        }
      }
    }
  });
});
