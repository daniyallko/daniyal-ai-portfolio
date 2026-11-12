import { describe, expect, it } from "vitest";
import { canShareAnswer } from "./rag-cache";
import { WARM_TIER1, WARM_TIER2 } from "./warm-questions";

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
  it("reports Tier 2 questions that will not be cached", () => {
    expect(WARM_TIER2.filter((q) => !canShareAnswer(q, 0))).toEqual([]);
  });
});
