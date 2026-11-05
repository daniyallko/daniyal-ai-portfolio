import { buildChunks } from "@/lib/portfolio";
import { bridgeQuery, detectLanguage, isLangCode } from "@/lib/language";
import { normalizeCrossLingualRagQuery } from "@/lib/multilingualVoiceEngine";

export type CacheSource = { n: number; id: string; section: string; title: string; text: string };
export type CacheEntry = {
  key: string; query: string; version: string; lang: string;
  sources: CacheSource[]; text: string; tools: unknown[]; expiresAt: number;
};
export const CACHE_LIMIT = 100;
export const CACHE_TTL = 7 * 24 * 60 * 60_000;
export function fingerprint(text: string): string {
  let h = 2166136261;
  let second = 5381;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ text.charCodeAt(i);
  }
  return `${(h >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}
export function corpusVersion(): string {
  return fingerprint(JSON.stringify(buildChunks()));
}
export const queryWords = (text: string) => text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{M}\p{N}+#]+/gu) ?? [];
const GRAMMAR = new Set("a an the is are was were do does did has have he his him daniyal what which who tell me about of in on and to can you with for any please show list describe summarize explain portfolio work built projects project experience skills skill stack production systems system".split(" "));
const ALIASES: [RegExp, string][] = [
  [/^(?:what|which|tell me about|show me|list|describe)?\s*(?:are |is |his |daniyal s |the |your )*(?:projects|project)\s*(?:has he built|has daniyal built)?$/i, "projects"],
  [/^(?:experience|work experience|career|roles)$/i, "experience"],
  [/^(?:skills|technical skills|tech stack)$/i, "skills"],
];
export function canonicalQuery(raw: string): string {
  const exactTopic = queryWords(raw).join(" ");
  if (/^(projects?|प्रोजेक्ट्स?|परियोजना|proyectos?|projets?|projekte?|プロジェクト)$/iu.test(exactTopic)) return "projects";
  if (/^(experience|अनुभव|experiencia|expérience|erfahrung|経験)$/iu.test(exactTopic)) return "experience";
  if (/^(skills?|कौशल|स्किल|habilidades|compétences|fähigkeiten|スキル)$/iu.test(exactTopic)) return "skills";
  const detected = detectLanguage(raw);
  // Keep significant qualifiers and numbers. Never merge merely by shared topic.
  if (detected.code === "en") {
    const words = queryWords(raw).join(" ");
    const alias = ALIASES.find(([re]) => re.test(words));
    return alias?.[1] ?? words;
  }
  const bridge = bridgeQuery(raw);
  const engine = normalizeCrossLingualRagQuery(raw);
  const topic = /प्रोजेक्ट|परियोजना|proyectos?|projets?|projekte?|プロジェクト/iu.test(raw) ? "projects"
    : /अनुभव|experiencia|expérience|erfahrung|経験/iu.test(raw) ? "experience"
    : /कौशल|स्किल|habilidades|compétences|fähigkeiten|スキル/iu.test(raw) ? "skills" : null;
  // Only an exact translated topic label is safe to collapse without a translator.
  if (topic && queryWords(raw).length === 1) return topic;
  const tokens = [...new Set([...bridge.tokens, ...queryWords(engine.englishSearchQuery)])].sort();
  // Non-Latin qualifiers stay in the key: deterministic bridging isn't full translation.
  const qualifiers = queryWords(raw).filter((w) => /[^\x00-\x7f]/.test(w));
  return [...tokens, ...qualifiers].join(" ") || queryWords(raw).join(" ");
}
export function retrievalKey(raw: string, topK = 5): string {
  return `${corpusVersion()}:r:${topK}:${fingerprint(canonicalQuery(raw))}`;
}
export function answerKey(raw: string, promptVersion: string, lock?: string): string {
  const d = detectLanguage(raw);
  const lang = isLangCode(lock) ? lock : d.code;
  return `${corpusVersion()}:a:${promptVersion}:${lang}:${d.script}:${d.isCodeSwitched}:${fingerprint(queryWords(raw).join(" "))}`;
}
/** Only public-vocabulary standalone questions can publish model output globally. */
export function canShareAnswer(raw: string, historyLength: number): boolean {
  if (historyLength !== 0 || raw.length > 240 || /[@\d]|https?:|\b(my|i|we|our|previous|above|that|instead|ignore|not|never|salary|offer|candidate)\b/i.test(raw)) return false;
  const words = queryWords(raw);
  const publicWords = new Set(queryWords(buildChunks().map((c) => `${c.title} ${c.text}`).join(" ")));
  return words.length > 0 && words.length <= 40 && words.every((w) => GRAMMAR.has(w) || publicWords.has(w));
}
export class BoundedCache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  constructor(private limit = CACHE_LIMIT) {}
  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.expiresAt <= now) { this.entries.delete(key); return; }
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T, expiresAt: number) {
    this.entries.delete(key); this.entries.set(key, { value, expiresAt });
    while (this.entries.size > this.limit) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
  }
}