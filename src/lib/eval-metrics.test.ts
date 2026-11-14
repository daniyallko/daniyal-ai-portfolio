import { describe, it, expect } from "vitest";
import {
  recallAtK,
  mrr,
  factCoverage,
  missingFacts,
  citationStats,
  qualityScore,
  retrievalOutcomeScore,
  noContextAnswerScore,
} from "./eval-metrics";

describe("eval metrics", () => {
  it("recall counts expected chunks that were retrieved", () => {
    expect(recallAtK(["a", "b", "c"], ["b", "z"])).toBe(0.5);
  });
  it("scores no-context cases only when every weak candidate is rejected", () => {
    expect(retrievalOutcomeScore([], [])).toBe(1);
    expect(retrievalOutcomeScore(["unrelated"], [])).toBe(0);
    expect(retrievalOutcomeScore(["a", "b"], ["b", "z"])).toBe(0.5);
  });
  it("scores honest no-context answers without requiring an empty retrieval list", () => {
    const honest = "The available information doesn’t specify that detail.";
    expect(retrievalOutcomeScore(["weak-candidate"], [], honest)).toBe(1);
    expect(noContextAnswerScore("I can’t help with weather forecasts.")).toBe(1);
    expect(noContextAnswerScore("He expects a compensation package of 50 LPA.")).toBe(0);
  });
  it("mrr uses the rank of the first relevant chunk", () => {
    expect(mrr(["x", "y", "a"], ["a"])).toBeCloseTo(1 / 3);
    expect(mrr(["x"], ["a"])).toBe(0);
  });
  it("fact coverage is case-insensitive", () => {
    expect(
      factCoverage("Built on kubernetes with 99.9% uptime", ["Kubernetes", "99.9", "AWS"]),
    ).toBeCloseTo(2 / 3);
  });
  it("accepts equivalent numeric wording without hiding a missing fact", () => {
    const requirements: (string | string[])[] = [["four", "4"], "core"];
    expect(factCoverage("A team of 4 core engineers", requirements)).toBe(1);
    expect(missingFacts("A team of five engineers", requirements)).toEqual(["four or 4", "core"]);
  });
  it("citation coverage counts cited sentences and flags out-of-range numbers", () => {
    const s = citationStats(
      "Daniyal built the RAG pipeline at WisdmLabs [1]. He also migrated ten thousand Stripe users [7].  He is a very experienced engineer overall.",
      3,
    );
    expect(s.coverage).toBeCloseTo(2 / 3);
    expect(s.invalid).toBe(1);
  });
  it("quality weights facts 50%, citations 30%, validity 20%", () => {
    expect(qualityScore(1, 1, 0)).toBe(1);
    expect(qualityScore(1, 0, 2)).toBe(0.5);
  });
});
