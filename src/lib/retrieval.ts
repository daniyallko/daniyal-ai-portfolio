// Pure hybrid-retrieval helpers: BM25 (sparse) + cosine (dense), fused with
// Reciprocal Rank Fusion. No I/O so it is unit-testable.
import type { Chunk } from "./portfolio";

const STOP = new Set(
  "a an the and or of to in on for with at by is are was were be has have had do does did what which who how his her he she it its this that as from about any can you me tell".split(
    " ",
  ),
);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function bm25Scores(query: string, chunks: Chunk[], k1 = 1.4, b = 0.75): number[] {
  const docs = chunks.map((c) => tokenize(`${c.title} ${c.text}`));
  const avg = docs.reduce((a, d) => a + d.length, 0) / Math.max(docs.length, 1);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const q = tokenize(query);
  return docs.map((d) => {
    let score = 0;
    for (const t of q) {
      const tf = d.filter((x) => x === t).length;
      if (!tf) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.length) / avg)));
    }
    return score;
  });
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!,
      y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function ranks(scores: number[]): number[] {
  const order = scores.map((s, i) => [s, i] as const).sort((x, y) => y[0] - x[0]);
  const r = new Array(scores.length).fill(Infinity);
  order.forEach(([s, i], pos) => {
    if (s > 0) r[i] = pos + 1;
  });
  return r;
}

/** Merge raw and context-expanded searches while preserving primary ranking. */
export function mergeSources<T extends { id: string; n: number }>(
  primary: T[],
  secondary: T[],
  topK = 5,
): T[] {
  const unique = new Map<string, T>();
  for (const source of [...primary, ...secondary]) {
    if (!unique.has(source.id)) unique.set(source.id, source);
  }
  return [...unique.values()].slice(0, topK).map((source, i) => ({ ...source, n: i + 1 }));
}

export type Scored = {
  chunk: Chunk;
  bm25: number;
  dense: number;
  bm25Rank: number;
  denseRank: number;
  rrf: number;
};

export function hybridRank(chunks: Chunk[], bm25: number[], dense: number[], k = 60): Scored[] {
  const br = ranks(bm25),
    dr = ranks(dense);
  return chunks
    .map((chunk, i) => ({
      chunk,
      bm25: bm25[i]!,
      dense: dense[i]!,
      bm25Rank: br[i]!,
      denseRank: dr[i]!,
      rrf: (isFinite(br[i]!) ? 1 / (k + br[i]!) : 0) + (isFinite(dr[i]!) ? 1 / (k + dr[i]!) : 0),
    }))
    .sort((a, b) => b.rrf - a.rrf);
}
