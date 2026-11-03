// Browser-safe text helpers for read-aloud. Pure, no server or DOM imports.

export const SPEAK_MODEL = "google/gemini-3.1-flash-tts-preview";
export const SPEAK_VOICE = "Kore";
export const MAX_SPEAK_CHARS = 1800;

/** Turn a chat answer's markdown into text that sounds natural when spoken. */
export function speakableText(md: string): string {
  let t = typeof md === "string" ? md : "";
  // Code is unreadable aloud: drop fenced blocks (closed and still-open), keep inline code text.
  t = t.replace(/```[^\n]*\n[\s\S]*?```/g, " ");
  t = t.replace(/```[^\n]*\n?[\s\S]*$/g, " ");
  t = t.replace(/`([^`\n]*)`/g, "$1");
  // Links and images speak their label; citation chips [3] speak nothing.
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/\[\d+\]/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/https?:\/\/\S+/g, "");
  // Structure that carries no sound.
  t = t.replace(/^\s*#{1,6}\s+/gm, "");
  t = t.replace(/^\s*>\s?/gm, "");
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/^\s*\d+[.)]\s+/gm, "");
  t = t.replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, " ");
  t = t.replace(/^\s*\|(.*)\|\s*$/gm, (_m, row: string) => " " + row.split("|").map((c) => c.trim()).filter(Boolean).join(", ") + ".");
  t = t.replace(/^\s*[-*_]{3,}\s*$/gm, " ");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/\*([^*\n]+)\*/g, "$1");
  t = t.replace(/~~([^~]+)~~/g, "$1");
  // Symbols a voice would skip or misread.
  t = t.replace(/→/g, " to ").replace(/←/g, " from ").replace(/·/g, ", ").replace(/—|–/g, ", ");
  t = t.replace(/&/g, " and ");
  t = t.replace(/(\d)([MB])\b/g, (_m, n: string, s: string) => `${n} ${s === "M" ? "million" : "billion"}`);
  t = t.replace(/(\d)K\b/g, "$1 thousand");
  t = t.replace(/(\d)x\b/g, "$1 times");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/\s+([,.!?])/g, "$1");
  t = t.replace(/([,.]){2,}/g, "$1");
  return t.replace(/^[,.]+/, "").trim();
}

/** Cut to a sentence boundary at or before the limit so a reply never ends mid-word. */
export function trimForSpeech(t: string, limit = MAX_SPEAK_CHARS): string {
  if (t.length <= limit) return t;
  const slice = t.slice(0, limit);
  const ends = [". ", "! ", "? "].map((p) => slice.lastIndexOf(p));
  const cut = Math.max(...ends);
  const out = cut > limit * 0.4 ? slice.slice(0, cut + 1) : slice.slice(0, Math.max(slice.lastIndexOf(" "), 1));
  return out.trim();
}

/** Full pipeline: markdown in, speakable text out ("" when there is nothing to say). */
export function prepareForSpeech(md: string): string {
  const t = trimForSpeech(speakableText(md));
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
