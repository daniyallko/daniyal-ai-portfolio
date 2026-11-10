import { describe, expect, it } from "vitest";
import {
  answerKey,
  BoundedCache,
  canShareAnswer,
  canonicalQuery,
  corpusVersion,
  retrievalKey,
} from "./rag-cache";

describe("public RAG cache rules", () => {
  it("never publishes contextual answers", () => {
    expect(canShareAnswer("What RAG systems has Daniyal built in production?", 2)).toBe(false);
    expect(canShareAnswer("What RAG systems has Daniyal built in production?", 0)).toBe(true);
  });
  it("does not publish personal inputs", () => {
    expect(canShareAnswer("My email is jane@example.com", 0)).toBe(false);
    expect(canShareAnswer("Compare my offer of 5000", 0)).toBe(false);
  });
  it("separates response script and language", () => {
    expect(answerKey("projects", "prompt", "en")).not.toBe(answerKey("projects", "prompt", "hi"));
    expect(answerKey("प्रोजेक्ट्स", "prompt")).not.toBe(
      answerKey("Mujhe projects bataiye", "prompt"),
    );
  });
  it("shares exact multilingual topic labels for retrieval", () => {
    expect(retrievalKey("projects")).toBe(retrievalKey("प्रोजेक्ट्स"));
    expect(retrievalKey("projects")).toBe(retrievalKey("proyectos"));
    expect(canonicalQuery("プロジェクト")).toBe("projects");
  });
  it("preserves meaningful qualifiers numbers and negation", () => {
    expect(retrievalKey("projects not using React")).not.toBe(retrievalKey("projects using React"));
    expect(retrievalKey("projects 2025")).not.toBe(retrievalKey("projects 2026"));
    expect(retrievalKey("projects", 3)).not.toBe(retrievalKey("projects", 5));
  });
  it("versions prompt and corpus", () => {
    expect(answerKey("projects", "v1")).not.toBe(answerKey("projects", "v2"));
    expect(retrievalKey("projects").startsWith(corpusVersion() + ":")).toBe(true);
  });
  it("expires entries and bounds RAM", () => {
    const cache = new BoundedCache<string>(2);
    cache.set("one", "first", 100);
    expect(cache.get("one", 100)).toBeUndefined();
    cache.set("a", "A", 1000);
    cache.set("b", "B", 1000);
    cache.set("c", "C", 1000);
    expect(cache.get("a", 0)).toBeUndefined();
    expect(cache.get("c", 0)).toBe("C");
  });
});
