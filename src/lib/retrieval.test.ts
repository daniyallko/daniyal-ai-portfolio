import { describe, it, expect } from "vitest";
import { bm25Scores, hybridRank, tokenize } from "./retrieval";
import { buildChunks } from "./portfolio";

describe("hybrid retrieval", () => {
  const chunks = buildChunks();
  it("keyword search finds the Stripe migration for a Stripe question", () => {
    const s = bm25Scores("Stripe migration users", chunks);
    const best = chunks[s.indexOf(Math.max(...s))];
    expect(best?.text).toContain("10,000+ users between Stripe accounts");
  });
  it("fusion ranks a chunk found by both signals above one found by one", () => {
    const c = chunks.slice(0, 3);
    const r = hybridRank(c, [2, 1, 0], [0.9, 0, 0.5]);
    expect(r[0]?.chunk.id).toBe(c[0]?.id);
  });
  it("drops stop words", () => {
    expect(tokenize("What is the RAG")).toEqual(["rag"]);
  });
});
