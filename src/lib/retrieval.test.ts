import { describe, it, expect } from "vitest";
import { bm25Scores, hybridRank, mergeSources, tokenize } from "./retrieval";
import { buildChunks } from "./portfolio";
import { golden } from "./golden";

describe("hybrid retrieval", () => {
  const chunks = buildChunks();
  it("keyword search finds the Stripe migration for a Stripe question", () => {
    const s = bm25Scores("Stripe migration users", chunks);
    const best = chunks[s.indexOf(Math.max(...s))];
    expect(best?.text).toMatch(/10,000\+ (users|Stripe subscriptions)/);
    expect(best?.text).toContain("Stripe");
  });
  it("fusion ranks a chunk found by both signals above one found by one", () => {
    const c = chunks.slice(0, 3);
    const r = hybridRank(c, [2, 1, 0], [0.9, 0, 0.5]);
    expect(r[0]?.chunk.id).toBe(c[0]?.id);
  });
  it("merges paired searches by id and renumbers citations", () => {
    const source = (id: string, n: number) => ({ id, n, text: id });
    const merged = mergeSources([source("a", 1), source("b", 2)], [source("b", 1), source("c", 2)]);
    expect(merged).toEqual([source("a", 1), source("b", 2), source("c", 3)]);
    expect(mergeSources([source("a", 1)], [source("b", 1), source("c", 2)], 2)).toEqual([
      source("a", 1),
      source("b", 2),
    ]);
  });
  it("negative goldens have no lexical corpus matches", () => {
    for (const testCase of golden.filter((c) => c.expectNoContext)) {
      expect(Math.max(...bm25Scores(testCase.question, chunks)), testCase.id).toBe(0);
    }
  });
  it("drops stop words", () => {
    expect(tokenize("What is the RAG")).toEqual(["rag"]);
  });
});
