export type Source = { n: number; id: string; section: string; title: string; text: string };

export type Debug = {
  query?: string;
  model?: string;
  timingsMs?: Record<string, number | null>;
  usage?: unknown;
  cache?: string;
  bridge?: { raw: string; tokens: string[]; normalized: string; ms: number };
  candidates?: { id: string; title: string; bm25: number; dense: number; bm25Rank: number | null; denseRank: number | null; rrf: number; kept: boolean }[];
};

export type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[] | undefined;
  debug?: Debug | undefined;
  error?: string | undefined;
};
