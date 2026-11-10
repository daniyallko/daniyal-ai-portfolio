// Deterministic (<2ms, no LLM) multilingual voice engine: language/register detection,
// cross-lingual RAG normalization, polyglot clause chunking, endpointing and localized fillers.
// Voice personas stay in src/config/voicePersonas.ts (Gateway voices, not ElevenLabs ids).

export interface LanguageDetectionResult {
  langCode: "en" | "hi" | "es" | "fr" | "de" | "ja" | "ar";
  langName: string;
  script: "Latin" | "Devanagari" | "CJK" | "Arabic";
  isCodeSwitched: boolean;
  ttsLanguageCode: string;
  systemPromptInstruction: string;
}

const HINGLISH_MARKERS = new Set([
  "mujhe",
  "aap",
  "aapke",
  "aapka",
  "batao",
  "bataiye",
  "kya",
  "kaise",
  "kaisa",
  "hai",
  "hain",
  "mein",
  "ko",
  "ka",
  "ki",
  "ke",
  "se",
  "aur",
  "kyunki",
  "matlab",
  "jaise",
  "kaam",
  "kiya",
  "banaya",
  "dikhao",
  "dikhaiye",
  "samjhao",
  "samjhaiye",
  "iske",
  "uske",
  "baare",
  "konse",
  "kaunse",
  "kitna",
  "kab",
  "kahan",
  "acha",
  "theek",
]);
const SPANISH_MARKERS = new Set([
  "hola",
  "como",
  "cómo",
  "puedes",
  "cuéntame",
  "sobre",
  "proyectos",
  "experiencia",
  "habilidades",
  "arquitectura",
  "cual",
  "cuál",
  "qué",
  "por",
  "para",
  "con",
  "está",
]);
const FRENCH_MARKERS = new Set([
  "bonjour",
  "comment",
  "pouvez",
  "parlez",
  "moi",
  "projets",
  "expérience",
  "compétences",
  "architecture",
  "quel",
  "quelle",
  "avec",
  "pour",
  "dans",
  "est",
]);
const GERMAN_MARKERS = new Set([
  "hallo",
  "wie",
  "können",
  "erzählen",
  "über",
  "projekte",
  "erfahrung",
  "fähigkeiten",
  "architektur",
  "welche",
  "mit",
  "für",
  "und",
  "ist",
]);
export const TECH_TERMS = new Set([
  "kubernetes",
  "k8s",
  "docker",
  "terraform",
  "aws",
  "gcp",
  "azure",
  "react",
  "typescript",
  "nextjs",
  "supabase",
  "postgres",
  "pgvector",
  "rag",
  "llm",
  "webrtc",
  "websocket",
  "latency",
  "microservices",
  "ci/cd",
  "devops",
  "python",
  "rust",
  "golang",
  "node",
  "api",
  "backend",
  "frontend",
  "fullstack",
  "architecture",
]);

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function detectLanguageAndRegister(
  transcript: string,
  sttLangHint?: string,
): LanguageDetectionResult {
  const clean = transcript.trim();
  const tokens = clean
    .toLowerCase()
    .split(/[\s,?.!।॥。؟]+/)
    .filter(Boolean);
  const hasLatinTech = tokens.some((t) => TECH_TERMS.has(t));
  const r = (
    langCode: LanguageDetectionResult["langCode"],
    langName: string,
    script: LanguageDetectionResult["script"],
    isCodeSwitched: boolean,
    systemPromptInstruction: string,
  ): LanguageDetectionResult => ({
    langCode,
    langName,
    script,
    isCodeSwitched,
    ttsLanguageCode: langCode,
    systemPromptInstruction,
  });

  if (/[\u0900-\u097F]/.test(clean)) {
    return r(
      "hi",
      hasLatinTech ? "Hindi + Tech English (Hinglish)" : "Hindi (हिन्दी)",
      "Devanagari",
      hasLatinTech,
      "Reply in natural conversational Hindi (Devanagari script) while keeping all software engineering terms (e.g., Kubernetes, Terraform, React, CI/CD, latency, microservices) in natural English. Never translate technical terms into awkward literal Hindi.",
    );
  }
  const hinglishHits = tokens.filter((t) => HINGLISH_MARKERS.has(t)).length;
  if (hinglishHits >= 2 || (hinglishHits >= 1 && tokens.length <= 5)) {
    return r(
      "hi",
      "Hinglish (Conversational)",
      "Latin",
      true,
      "The user is speaking Hinglish (Hindi mixed with English). Reply naturally in conversational Hindi/Hinglish (use Devanagari for Hindi words so the multilingual TTS pronounces phonemes natively, and keep technical terms like Kubernetes, React, AWS, API, and latency in English).",
    );
  }
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(clean) || sttLangHint?.startsWith("ja")) {
    return r(
      "ja",
      "Japanese (日本語)",
      "CJK",
      hasLatinTech,
      "Reply in natural polite Japanese while keeping core English technical stack names as standard developer terminology.",
    );
  }
  if (/[\u0600-\u06FF]/.test(clean) || sttLangHint?.startsWith("ar")) {
    return r(
      "ar",
      "Arabic (العربية)",
      "Arabic",
      hasLatinTech,
      "Reply in natural conversational Arabic while preserving standard English software engineering terms.",
    );
  }
  const hits = (set: Set<string>) => tokens.filter((t) => set.has(t)).length;
  if (hits(SPANISH_MARKERS) >= 2 || sttLangHint?.startsWith("es")) {
    return r(
      "es",
      "Spanish (Español)",
      "Latin",
      hasLatinTech,
      "Reply in natural conversational Spanish while keeping English technical terms (Kubernetes, Docker, CI/CD, RAG) untouched.",
    );
  }
  if (hits(FRENCH_MARKERS) >= 2 || sttLangHint?.startsWith("fr")) {
    return r(
      "fr",
      "French (Français)",
      "Latin",
      hasLatinTech,
      "Reply in natural conversational French while keeping standard English technical terms untouched.",
    );
  }
  if (hits(GERMAN_MARKERS) >= 2 || sttLangHint?.startsWith("de")) {
    return r(
      "de",
      "German (Deutsch)",
      "Latin",
      hasLatinTech,
      "Reply in natural conversational German while keeping standard English technical terms untouched.",
    );
  }
  return r("en", "English", "Latin", false, "Reply concisely and conversationally in English.");
}

const CROSS_LINGUAL_INTENT_MAP: { pattern: RegExp; englishKeywords: string }[] = [
  {
    pattern:
      /(प्रोजेक्ट|प्रोजेक्ट्स|project|projects|proyectos|projets|projekte|banaya|बनाया|काम|kaam)/i,
    englishKeywords: "projects portfolio built architecture case study implementation",
  },
  {
    pattern:
      /(अनुभव|एक्सपीरियंस|experience|experiencia|expérience|erfahrung|company|companies|कंपनी|job|role)/i,
    englishKeywords: "work experience career history roles responsibilities impact",
  },
  {
    pattern:
      /(स्किल|स्किल्स|कौशल|टेक|स्टैक|skills|tech stack|habilidades|compétences|fähigkeiten|technologies)/i,
    englishKeywords: "technical skills stack languages frameworks cloud devops tools",
  },
  {
    pattern:
      /(आर्किटेक्चर|सिस्टम|डिज़ाइन|architecture|system design|arquitectura|लेटेंसी|latency|scale)/i,
    englishKeywords: "system architecture scalability distributed systems performance latency",
  },
  {
    pattern:
      /(संपर्क|कांटेक्ट|हायर|इंटरव्यू|ईमेल|contact|hire|hiring|interview|availability|book|resume|रेज़्यूमे|cv)/i,
    englishKeywords: "contact email availability hiring resume schedule interview",
  },
  {
    pattern: /(शिक्षा|एजुकेशन|डिग्री|कॉलेज|education|degree|university|certification)/i,
    englishKeywords: "education university degree certifications",
  },
];

export interface NormalizedRagQuery {
  rawQuery: string;
  englishSearchQuery: string;
  extractedTechEntities: string[];
  normalizationTimeMs: number;
}

export function normalizeCrossLingualRagQuery(rawQuery: string): NormalizedRagQuery {
  const start = now();
  const lower = rawQuery.toLowerCase();
  const tech: string[] = [];
  for (const term of TECH_TERMS)
    if (new RegExp(`(^|[^a-z])${term.replace("/", "\\/")}([^a-z]|$)`).test(lower)) tech.push(term);
  if (/कुबेरनेट्स|क्युबेरनेट्स|कुबरनेटीज/.test(rawQuery)) tech.push("kubernetes");
  if (/टेराफॉर्म/.test(rawQuery)) tech.push("terraform");
  if (/डॉकर/.test(rawQuery)) tech.push("docker");
  if (/रिएक्ट/.test(rawQuery)) tech.push("react");
  if (/सुपाबेस/.test(rawQuery)) tech.push("supabase");
  if (/एडब्ल्यूएस|क्लाउड/.test(rawQuery)) tech.push("aws", "cloud");
  const intents = CROSS_LINGUAL_INTENT_MAP.filter((e) => e.pattern.test(rawQuery)).map(
    (e) => e.englishKeywords,
  );
  const latinWords = rawQuery
    .replace(/[^\p{ASCII}]+/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^\w/+#.-]/g, ""))
    .filter((w) => w.length > 2 && !HINGLISH_MARKERS.has(w.toLowerCase()));
  const combined = [...new Set([...tech, ...latinWords, ...intents.join(" ").split(" ")])]
    .filter(Boolean)
    .join(" ");
  return {
    rawQuery,
    englishSearchQuery: combined.trim() || "portfolio overview projects skills experience",
    extractedTechEntities: [...new Set(tech)],
    normalizationTimeMs: Number((now() - start).toFixed(2)),
  };
}

/** Streaming token chunker: fast first clause (5+ words), then full sentences in any script. */
export class PolyglotAdaptiveChunker {
  private buffer = "";
  private isFirstClauseFlushed = false;
  public lastFlushDelimiter = "none";
  private static SENTENCE_END_REGEX = /([.!?;:।॥؟]+(?=\s|$)|[。！？；]+)/; // CJK needs no trailing space
  private static FIRST_CLAUSE_REGEX =
    /([,،、—–]|\s+(?:and|or|because|so|और|या|क्योंकि|तो|aur|kyunki|y|porque|et)\s+)/i;

  public pushToken(token: string): string[] {
    this.buffer += token;
    const ready: string[] = [];
    for (;;) {
      const wordCount = this.buffer.trim().split(/\s+/).filter(Boolean).length;
      if (!this.isFirstClauseFlushed && wordCount >= 5) {
        const m = PolyglotAdaptiveChunker.FIRST_CLAUSE_REGEX.exec(this.buffer);
        if (m) {
          const idx = m.index + m[0].length;
          const chunk = this.buffer.slice(0, idx).trim();
          if (chunk.split(/\s+/).length >= 4) {
            ready.push(chunk);
            this.buffer = this.buffer.slice(idx);
            this.isFirstClauseFlushed = true;
            this.lastFlushDelimiter = `First-Clause (${(m[1] ?? "").trim()})`;
            continue;
          }
        }
      }
      const s = PolyglotAdaptiveChunker.SENTENCE_END_REGEX.exec(this.buffer);
      if (s) {
        const idx = s.index + (s[1] ?? "").length;
        const chunk = this.buffer.slice(0, idx).trim();
        if (chunk) {
          ready.push(chunk);
          this.isFirstClauseFlushed = true;
          this.lastFlushDelimiter = `Sentence (${s[1]})`;
        }
        this.buffer = this.buffer.slice(idx).trimStart();
        continue;
      }
      break;
    }
    return ready;
  }

  public flushRemaining(): string | null {
    const rest = this.buffer.trim();
    this.buffer = "";
    this.isFirstClauseFlushed = false;
    return rest || null;
  }

  public reset(): void {
    this.buffer = "";
    this.isFirstClauseFlushed = false;
    this.lastFlushDelimiter = "none";
  }
}

const TRAILING_HESITATION_REGEX =
  /(?:\b(?:and|or|but|because|so|like|with|for|to|uh|um|aur|ya|kyunki|matlab|jaise|ki|ke|y|o|porque|como|et|ou|comme)|(?:और|या|क्योंकि|मतलब|जैसे|कि|के|से|में))[\s,.…]*$/i;

export function getMultilingualEndpointTimeoutMs(interim: string): {
  timeoutMs: number;
  mode: "Fast (350ms)" | "Extended (1100ms)";
} {
  const clean = interim.trim();
  if (!clean || TRAILING_HESITATION_REGEX.test(clean))
    return { timeoutMs: 1100, mode: "Extended (1100ms)" };
  return { timeoutMs: 350, mode: "Fast (350ms)" };
}

export const LOCALIZED_BACKCHANNELS: Record<string, string[]> = {
  en: ["Let me pull that up for you.", "Checking that architecture now."],
  hi: [
    "एक सेकंड, मैं वो प्रोजेक्ट डिटेल्स निकालता हूँ।",
    "चलिए, मैं आपको इसके बारे में बताता हूँ।",
  ],
  es: ["Un momento, déjame revisar ese proyecto.", "Veamos los detalles de esa arquitectura."],
  fr: ["Un instant, je vérifie les détails de ce projet."],
  de: ["Einen Moment, ich rufe die Projektdetails auf."],
  ja: ["少々お待ちください、プロジェクトの詳細を確認します。"],
  ar: ["لحظة واحدة، دعني أستعرض تفاصيل هذا المشروع."],
};
