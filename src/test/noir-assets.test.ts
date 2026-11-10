import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assets = [
  ["noir-building-900.avif", 180 * 1024],
  ["noir-building-900.webp", 180 * 1024],
  ["noir-building-1800.avif", 300 * 1024],
  ["noir-building-1800.webp", 300 * 1024],
  ["noir-building-1800.jpg", 300 * 1024],
] as const;

describe("local building production assets", () => {
  it.each(assets)("%s exists within its active-image budget", (name, budget) => {
    const path = resolve(process.cwd(), "public/images", name);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeLessThanOrEqual(budget);
  });

  it("retains source and license notes", () => {
    expect(existsSync(resolve(process.cwd(), "public/images/noir-building-SOURCE.md"))).toBe(true);
  });
});
