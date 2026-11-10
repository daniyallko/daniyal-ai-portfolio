import { describe, expect, it } from "vitest";
import {
  bridgeQuery,
  detectLanguage,
  fillerFor,
  polyglotFirstClause,
  splitSentences,
} from "./language";
import { endpointSilenceMs, normalizeQueryKey } from "./voice-logic";
import { getPersona, VOICE_PERSONAS } from "@/config/voicePersonas";

describe("detectLanguage", () => {
  it("detects Devanagari Hindi with English tech terms as code-switched", () => {
    const d = detectLanguage("मुझे आपके Kubernetes और Terraform प्रोजेक्ट्स के बारे में बताइए");
    expect(d).toMatchObject({ code: "hi", script: "Devanagari", isCodeSwitched: true });
  });
  it("detects romanized Hinglish", () => {
    expect(detectLanguage("unhone kya projects kiye hai aur kaise kaam karte hai")).toMatchObject({
      code: "hi",
      script: "Latin",
      isCodeSwitched: true,
    });
  });
  it("detects Spanish, French, German, Portuguese, Japanese, Arabic and English", () => {
    expect(detectLanguage("¿Qué proyectos tiene Daniyal y cómo es su experiencia?").code).toBe(
      "es",
    );
    expect(
      detectLanguage("Quels sont les projets de Daniyal et son expérience avec les agents ?").code,
    ).toBe("fr");
    expect(detectLanguage("Welche Projekte hat er und was ist seine Erfahrung mit RAG?").code).toBe(
      "de",
    );
    expect(detectLanguage("Quais projetos ele tem e qual a experiência dele?").code).toBe("pt");
    expect(detectLanguage("Daniyalのプロジェクトについて教えてください").code).toBe("ja");
    expect(detectLanguage("ما هي مشاريع دانيال؟").code).toBe("ar");
    expect(detectLanguage("What RAG systems has he built?").code).toBe("en");
  });
});

describe("bridgeQuery", () => {
  it("maps a Hindi query to English search tokens", () => {
    const b = bridgeQuery("मुझे आपके Kubernetes और Terraform प्रोजेक्ट्स के बारे में बताइए");
    expect(b.tokens).toEqual(expect.arrayContaining(["kubernetes", "terraform", "projects"]));
    expect(b.normalized).toContain("projects");
  });
  it("leaves English queries untouched", () => {
    expect(bridgeQuery("What has he built?").normalized).toBe("What has he built?");
  });
  it("keeps non-Latin text in the cache key", () => {
    expect(normalizeQueryKey("प्रोजेक्ट्स बताइए")).not.toBe("");
  });
});

describe("polyglotFirstClause", () => {
  it("flushes on the Hindi poorna viram", () => {
    const r = polyglotFirstClause(
      "Daniyal ने AI BotKit पर काम किया। उन्होंने Kubernetes पर licensing platform चलाया और 99.9% uptime रखा।",
    );
    expect(r.delimiter).toBe("।");
    expect(r.first).toBe("Daniyal ने AI BotKit पर काम किया।");
  });
  it("flushes on the CJK full stop", () => {
    const r = polyglotFirstClause(
      "DaniyalはAI BotKitの中核部分を構築しました。千以上のサイトで稼働しているマルチチャネルのRAGチャットボットです。",
    );
    expect(r.delimiter).toBe("。");
    expect(r.first.endsWith("。")).toBe(true);
  });
  it("flushes on an Arabic comma within 5-8 words", () => {
    const r = polyglotFirstClause(
      "بنى دانيال منصة للدردشة الذكية، وهي تعمل على أكثر من ألف موقع حول العالم اليوم",
    );
    expect(r.delimiter).toBe("،");
  });
  it("splits sentences across scripts", () => {
    expect(splitSentences("एक। दो। three. 四。")).toHaveLength(4);
  });
});

describe("multilingual endpointing", () => {
  it("extends to 1100ms on trailing conjunctions", () => {
    expect(endpointSilenceMs("उन्होंने AI BotKit बनाया और")).toBe(1100);
    expect(endpointSilenceMs("he worked there kyunki")).toBe(1100);
    expect(endpointSilenceMs("trabajó en RAG porque")).toBe(1100);
    expect(endpointSilenceMs("il a construit des agents parce que")).toBe(1100);
  });
  it("uses 350ms on complete questions in any script", () => {
    expect(endpointSilenceMs("उन्होंने क्या बनाया?")).toBe(350);
    expect(endpointSilenceMs("ما هي مشاريعه؟")).toBe(350);
    expect(endpointSilenceMs("何を作りましたか？")).toBe(350);
  });
});

describe("fillers and personas", () => {
  it("never uses English fillers for Hindi or Spanish", () => {
    expect(fillerFor("hi", true)).toContain("निकालती");
    expect(fillerFor("hi", false)).toContain("निकालता");
    expect(fillerFor("es", false)).toMatch(/^Un momento/);
  });
  it("has at least 4 personas with distinct voices", () => {
    expect(VOICE_PERSONAS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(VOICE_PERSONAS.map((p) => p.ttsVoice)).size).toBe(VOICE_PERSONAS.length);
    expect(getPersona("nope").id).toBe("lead");
  });
});
