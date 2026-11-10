// Pure scoring functions for the golden-set evaluation.

/** Share of expected chunks found in the retrieved list (recall@k). */
export function recallAtK(retrieved: string[], expected: string[]): number {
  if (!expected.length) return 1;
  return expected.filter((e) => retrieved.includes(e)).length / expected.length;
}

/** Reciprocal rank of the first expected chunk (0 if none retrieved). */
export function mrr(retrieved: string[], expected: string[]): number {
  const i = retrieved.findIndex((r) => expected.includes(r));
  return i < 0 ? 0 : 1 / (i + 1);
}

/** Share of required facts mentioned in the answer. */
export function factCoverage(answer: string, mustMention: string[]): number {
  if (!mustMention.length) return 1;
  const a = answer.toLowerCase();
  return mustMention.filter((m) => a.includes(m.toLowerCase())).length / mustMention.length;
}

function sentences(answer: string): string[] {
  return answer
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z*\-•])/)
    .map((s) => s.replace(/^[\s\-*•#>]+/, "").trim())
    .filter((s) => s.replace(/\[\d+\]/g, "").trim().length >= 25);
}

/** Share of substantive sentences carrying a citation, and whether all cited numbers exist. */
export function citationStats(answer: string, sourceCount: number) {
  const ss = sentences(answer);
  const cited = ss.filter((s) => /\[\d+\]/.test(s)).length;
  const nums = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const invalid = nums.filter((n) => n < 1 || n > sourceCount).length;
  return { coverage: ss.length ? cited / ss.length : 0, citations: nums.length, invalid };
}

/** Overall quality: facts 50%, citation coverage 30%, no invalid citations 20%. */
export function qualityScore(
  facts: number,
  citeCoverage: number,
  invalidCitations: number,
): number {
  return 0.5 * facts + 0.3 * citeCoverage + 0.2 * (invalidCitations === 0 ? 1 : 0);
}
