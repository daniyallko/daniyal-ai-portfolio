import { describe, expect, it } from "vitest";
import { PolyglotAdaptiveChunker, detectLanguageAndRegister, getMultilingualEndpointTimeoutMs, normalizeCrossLingualRagQuery } from "./multilingualVoiceEngine";

describe("multilingualVoiceEngine", () => {
  it("detects Devanagari Hinglish with tech terms", () => {
    const d = detectLanguageAndRegister("मुझे आपके Kubernetes प्रोजेक्ट्स के बारे में बताइए");
    expect(d.langCode).toBe("hi");
    expect(d.isCodeSwitched).toBe(true);
  });
  it("detects romanized Hinglish", () => {
    expect(detectLanguageAndRegister("mujhe aapke projects ke baare mein batao").langName).toBe("Hinglish (Conversational)");
  });
  it("normalizes Hindi query to English keywords", () => {
    const n = normalizeCrossLingualRagQuery("मुझे आपके Kubernetes और Terraform प्रोजेक्ट्स के बारे में बताइए");
    expect(n.extractedTechEntities).toEqual(expect.arrayContaining(["kubernetes", "terraform"]));
    expect(n.englishSearchQuery).toContain("projects");
  });
  it("splits on Devanagari and CJK terminators", () => {
    const c = new PolyglotAdaptiveChunker();
    expect(c.pushToken("उन्होंने काम किया। फिर")).toEqual(["उन्होंने काम किया।"]);
    const j = new PolyglotAdaptiveChunker();
    expect(j.pushToken("こんにちは。次")).toEqual(["こんにちは。"]);
  });
  it("extends endpointing on trailing conjunctions", () => {
    expect(getMultilingualEndpointTimeoutMs("he built agents and").timeoutMs).toBe(1100);
    expect(getMultilingualEndpointTimeoutMs("उसने काम किया और").timeoutMs).toBe(1100);
    expect(getMultilingualEndpointTimeoutMs("what did he build?").timeoutMs).toBe(350);
  });
});
