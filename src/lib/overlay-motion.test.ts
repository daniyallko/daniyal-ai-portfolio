import { describe, expect, it } from "vitest";
import { overlayDurationMs } from "./overlay-motion";

describe("overlayDurationMs", () => {
  it.each([
    ["message", 900],
    ["empty", 300],
    ["voice", 0],
  ] as const)("uses the cinematic %s entry duration", (entry, duration) => {
    expect(overlayDurationMs(entry, false)).toBe(duration);
  });

  it.each(["message", "empty", "voice"] as const)(
    "disables %s interpolation under reduced motion",
    (entry) => {
      expect(overlayDurationMs(entry, true)).toBe(0);
    },
  );
});
