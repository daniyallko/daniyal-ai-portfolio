import { describe, expect, it } from "vitest";
import { canShareAnswer } from "./rag-cache";
import { WARM_TIER1, WARM_TIER2, WARM_TIER3 } from "./warm-questions";

describe("pre-warmed recruiter questions", () => {
  it("never shares salary, CTC or reasons for leaving", () => {
    for (const q of [
      "What are Daniyal's salary expectations?",
      "What is Daniyal's current CTC?",
      "Why is Daniyal leaving WisdmLabs?",
      "Why is Daniyal looking for a new role?",
    ])
      expect(canShareAnswer(q, 0)).toBe(false);
  });
  it("Tier 1 English questions are shareable", () => {
    expect(WARM_TIER1.slice(0, 10).filter((q) => !canShareAnswer(q, 0))).toEqual([]);
  });
  it("keeps every curated warm-up question shareable", () => {
    const all = [...WARM_TIER1, ...WARM_TIER2, ...WARM_TIER3];
    expect(all.filter((q) => !canShareAnswer(q, 0))).toEqual([]);
  });
  it("does not duplicate warm-up work across tiers", () => {
    const all = [...WARM_TIER1, ...WARM_TIER2, ...WARM_TIER3];
    expect(new Set(all.map((q) => q.toLowerCase())).size).toBe(all.length);
  });
});
