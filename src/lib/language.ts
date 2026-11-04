// Pure, browser-safe multilingual helpers: language ID, cross-lingual query bridge,
// polyglot clause chunking, fillers and preview lines. No I/O, so it's unit-testable.

export type LangCode = "en" | "hi" | "es" | "fr" | "de" | "ja" | "ar" | "pt";
export type Script = "Latin" | "Devanagari" | "Japanese" | "Arabic";
export type DetectedLanguage = { code: LangCode; name: string; script: Script; isCodeSwitched: boolean; confidence: number };

export const LANGUAGES: Record<LangCode, { name: string; bcp47: string }> = {
  en: { name: "English", bcp47: "en-US" },
  hi: { name: "Hindi", bcp47: "hi-IN" },
  es: { name: "Spanish", bcp47: "es-ES" },
  fr: { name: "French", bcp47: "fr-FR" },
  de: { name: "German", bcp47: "de-DE" },
  ja: { name: "Japanese", bcp47: "ja-JP" },
  ar: { name: "Arabic", bcp47: "ar-EG" },
  pt: { name: "Portuguese", bcp47: "pt-BR" },
};
export const isLangCode = (s: unknown): s is LangCode => typeof s === "string" && s in LANGUAGES;

const LEX: Partial<Record<LangCode, string[]>> = {
  hi: ["hai", "hain", "kya", "aur", "kyunki", "mujhe", "batao", "bataiye", "ke", "baare", "mein", "kaise", "nahi", "unhone", "kiya", "unka", "unke", "apne", "kaun", "kitna", "matlab", "jaise", "bhai", "acha", "accha", "karte", "kaam"],
  es: ["qué", "que", "cómo", "como", "proyectos", "sobre", "tiene", "experiencia", "porque", "él", "habla", "cuáles", "trabajo", "dime", "su", "sus", "de", "los", "las", "y", "con"],
  fr: ["quels", "quelle", "est-ce", "projets", "sur", "parce", "expérience", "il", "avec", "les", "des", "et", "comme", "son", "ses", "parlez", "moi", "travail", "qu'il"],
  de: ["welche", "hat", "erfahrung", "projekte", "über", "und", "mit", "er", "seine", "ist", "erzähl", "mir", "was", "wie", "die", "der", "das"],
  pt: ["quais", "você", "projetos", "sobre", "experiência", "ele", "tem", "não", "fale", "trabalho", "seus", "dele", "como", "e", "com"],
};

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

/** Instant (<2ms) script + lexical language ID. `hint` is STT language metadata, used for ties. */
export function detectLanguage(text: string, hint?: string | null): DetectedLanguage {
  const t = text.trim();
  const mk = (code: LangCode, script: Script, isCodeSwitched: boolean, confidence: number): DetectedLanguage => ({ code, name: LANGUAGES[code].name + (isCodeSwitched && code === "hi" ? " (Hinglish)" : ""), script, isCodeSwitched, confidence });
  const latin = count(t, /[A-Za-zÀ-ÿ]/g);
  const deva = count(t, /[\u0900-\u097F]/g);
  const jp = count(t, /[\u3040-\u30FF\u4E00-\u9FFF]/g);
  const arab = count(t, /[\u0600-\u06FF]/g);
  const letters = latin + deva + jp + arab;
  if (!letters) return mk(isLangCode(hint) ? hint : "en", "Latin", false, 0);
  if (deva / letters > 0.3) return mk("hi", "Devanagari", latin / letters > 0.15, deva / letters);
  if (jp / letters > 0.3) return mk("ja", "Japanese", latin / letters > 0.15, jp / letters);
  if (arab / letters > 0.3) return mk("ar", "Arabic", latin / letters > 0.15, arab / letters);
  const words = t.toLowerCase().split(/[^\p{L}'-]+/u).filter(Boolean);
  let best: LangCode = "en", bestScore = 0;
  for (const [code, list] of Object.entries(LEX) as [LangCode, string[]][]) {
    const set = new Set(list);
    let score = words.filter((w) => set.has(w)).length;
    if (code === "es" && /[ñ¿¡]/.test(t)) score += 2;
    if (code === "pt" && /[ãõç]/.test(t)) score += 2;
    if (code === "fr" && /[èêàùç]|qu'/.test(t)) score += 1;
    if (code === "de" && /[ßäöü]/.test(t)) score += 2;
    if (score > bestScore) { best = code; bestScore = score; }
  }
  const ratio = words.length ? bestScore / words.length : 0;
  if (bestScore >= 2 && ratio >= 0.2) return mk(best, "Latin", best === "hi", Math.min(1, ratio * 2));
  if (isLangCode(hint) && hint !== "en" && LEX[hint]) return mk(hint, "Latin", hint === "hi", 0.4);
  return mk("en", "Latin", false, 1 - ratio);
}

// Cross-lingual bridge: non-English intent words -> canonical English portfolio vocabulary.
const BRIDGE: [RegExp, string][] = [
  [/प्रोजेक्ट|परियोजना|proyecto|projet|projekt|projeto|プロジェクト|مشروع|مشاريع|kaam|काम/iu, "projects built"],
  [/अनुभव|experiencia|expérience|erfahrung|experiência|経験|خبرة|tajurba|anubhav/iu, "experience roles"],
  [/कौशल|स्किल|habilidades|compétences|fähigkeiten|competências|スキル|مهارات/iu, "skills stack"],
  [/शिक्षा|डिग्री|educación|éducation|ausbildung|educação|学歴|تعليم|padhai/iu, "education degree"],
  [/संपर्क|ईमेल|contacto|contato|kontakt|連絡|اتصال|email/iu, "contact email"],
  [/नौकरी|कंपनी|empresa|entreprise|firma|会社|شركة|naukri/iu, "company employer"],
  [/स्थानांतरण|relocat|reubicar|déménager|umziehen|mudar|引っ越し|انتقال|shift/iu, "relocate relocation"],
  [/आवाज़|आवाज|voz|voix|stimme|音声|صوت|awaaz/iu, "voice ai"],
  [/एजेंट|agente|agent|エージェント|وكيل/iu, "agents agentic"],
  [/अपटाइम|disponibilidad|disponibilité|verfügbarkeit|稼働/iu, "uptime"],
  [/कुबेरनेट्स|कुबरनेटीज|クバネティス/iu, "kubernetes"],
  [/टेराफॉर्म/iu, "terraform"],
  [/डॉकर/iu, "docker"],
];

/** Map a multilingual query to English search terms; keeps original Latin technical terms. */
export function bridgeQuery(query: string): { normalized: string; tokens: string[]; ms: number; changed: boolean } {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const add = new Set<string>();
  for (const [re, en] of BRIDGE) if (re.test(query)) en.split(" ").forEach((w) => add.add(w));
  const latinTerms = (query.match(/[A-Za-z][A-Za-z0-9+#./-]*/g) ?? []).map((w) => w.toLowerCase()).filter((w) => w.length > 1);
  const det = detectLanguage(query);
  const nonEnglish = det.code !== "en";
  const tokens = nonEnglish ? [...new Set([...latinTerms, ...add])] : [...add];
  const normalized = tokens.length ? `${query} ${tokens.join(" ")}` : query;
  const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return { normalized, tokens, ms: +ms.toFixed(2), changed: normalized !== query };
}

// Polyglot punctuation.
export const SENTENCE_END = /[.!?;:।॥。！？；؟؛]/;
export const CLAUSE_MARK = /[,،、—–]/;
const isCJK = (s: string) => /[\u3040-\u30FF\u4E00-\u9FFF]/.test(s);

/**
 * First-clause fast flush across writing systems. Returns the delimiter that triggered the flush.
 * Latin/Devanagari/Arabic count words (5–8); CJK counts characters (8–24).
 */
export function polyglotFirstClause(text: string, min = 5, max = 8): { first: string; rest: string; delimiter: string | null } {
  const s = text.trim();
  if (isCJK(s) && count(s, /[\u3040-\u30FF\u4E00-\u9FFF]/g) / Math.max(1, count(s, /\S/g)) > 0.3) {
    const chars = [...s];
    if (chars.length <= 28) return { first: s, rest: "", delimiter: null };
    for (let i = 7; i < Math.min(40, chars.length); i++) {
      if (SENTENCE_END.test(chars[i]!) || CLAUSE_MARK.test(chars[i]!)) return { first: chars.slice(0, i + 1).join(""), rest: chars.slice(i + 1).join("").trim(), delimiter: chars[i]! };
    }
    return { first: chars.slice(0, 24).join(""), rest: chars.slice(24).join(""), delimiter: null };
  }
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length <= max + 4) return { first: words.join(" "), rest: "", delimiter: null };
  const endOf = (w: string) => w.slice(-1);
  for (let i = min - 1; i < Math.min(max, words.length); i++) {
    const c = endOf(words[i]!);
    if (SENTENCE_END.test(c) || CLAUSE_MARK.test(c) || c === "-") return { first: words.slice(0, i + 1).join(" "), rest: words.slice(i + 1).join(" "), delimiter: c };
  }
  const end = words.findIndex((w, i) => i >= min - 1 && SENTENCE_END.test(endOf(w)));
  const cut = end >= 0 && end < 16 ? end + 1 : max;
  return { first: words.slice(0, cut).join(" "), rest: words.slice(cut).join(" "), delimiter: end >= 0 && end < 16 ? endOf(words[end]!) : null };
}

/** Split text into sentences on any script's terminal punctuation. */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?।॥。！？؟])\s*/u).map((x) => x.trim()).filter(Boolean);
}

export const TRAILING_MULTI = new Set([
  // English
  "and", "because", "like", "with", "uh", "um", "er", "so", "but", "or", "to", "of", "for", "the", "a", "an", "in", "on", "at", "about", "if", "that", "which", "then", "his", "my",
  // Hindi / Hinglish
  "और", "क्योंकि", "मतलब", "जैसे", "लेकिन", "या", "तो", "कि", "aur", "kyunki", "matlab", "jaise", "lekin", "ya", "toh", "ki",
  // Spanish
  "y", "porque", "como", "pero", "o", "que", "de", "con", "el", "la", "su",
  // French
  "et", "comme", "mais", "ou", "que", "de", "avec", "le", "les", "son",
  // German / Portuguese
  "und", "weil", "aber", "oder", "mit", "e", "porque", "mas", "com",
]);

const FILLERS: Record<LangCode, (female: boolean) => string> = {
  en: () => "Let me pull that up...",
  hi: (f) => `एक सेकंड, मैं वो प्रोजेक्ट डिटेल्स ${f ? "निकालती" : "निकालता"} हूँ...`,
  es: () => "Un momento, déjame revisar eso...",
  fr: () => "Un instant, je vérifie ça...",
  de: () => "Einen Moment, ich schaue kurz nach...",
  ja: () => "少々お待ちください、確認します…",
  ar: () => "لحظة واحدة، دعني أتحقق من ذلك...",
  pt: () => "Um momento, deixa eu verificar isso...",
};
export const fillerFor = (lang: LangCode, female: boolean) => FILLERS[lang](female);

const PREVIEW: Record<LangCode, string> = {
  en: "Hi, I can walk you through Daniyal's projects, experience and stack.",
  hi: "नमस्ते, मैं आपको Daniyal के projects, experience और tech stack के बारे में बता सकती हूँ।",
  es: "Hola, puedo contarte sobre los proyectos y la experiencia de Daniyal.",
  fr: "Bonjour, je peux vous présenter les projets et l'expérience de Daniyal.",
  de: "Hallo, ich erzähle Ihnen gern von Daniyals Projekten und Erfahrung.",
  ja: "こんにちは。Daniyalのプロジェクトや経験についてご案内します。",
  ar: "مرحبًا، يمكنني أن أحدثك عن مشاريع دانيال وخبرته.",
  pt: "Olá, posso falar sobre os projetos e a experiência do Daniyal.",
};
export function previewLine(lang: LangCode, female: boolean): string {
  const s = PREVIEW[lang];
  return lang === "hi" && !female ? s.replace("सकती", "सकता") : s;
}

export const LANGUAGE_RULE = `Language: Reply in the user's language and script. Pure Hindi gets natural conversational Hindi; Hinglish or any code-switched mix gets the same natural mix. Keep software, DevOps and cloud terms (Kubernetes, Terraform, Docker, CI/CD pipeline, AWS, latency, microservices, React, Supabase, RAG, LangGraph) in English inside any language. Sources are in English; translate facts faithfully, never add new ones.`;

/** One-line instruction appended to a turn so the model answers in the detected language. */
export function replyLanguageHint(d: DetectedLanguage): string {
  if (d.code === "en" && !d.isCodeSwitched) return "";
  const style = d.code === "hi" && d.isCodeSwitched
    ? `Hinglish: Hindi mixed with English technical terms, with every Hindi word written in ${d.script === "Devanagari" ? "Devanagari script (never romanized) (e.g. \"उन्होंने Kubernetes पर काम किया\")" : "Roman letters (e.g. \"unhone Kubernetes par kaam kiya\")"}`
    : `${LANGUAGES[d.code].name} written in ${d.script} script`;
  return `\n(Reply in ${style}. Match the user's script exactly. Keep technical terms in English (Latin letters).)`;
}
