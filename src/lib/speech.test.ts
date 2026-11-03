import { describe, it, expect } from "vitest";
import { prepareForSpeech, speakableText, trimForSpeech } from "./speech";

describe("read-aloud text", () => {
  it("keeps the answer and drops citation chips, markdown and links", () => {
    const md = "## Headline\nHe migrated **40,000** Stripe customers [1] with `zero` downtime.\nSee [the write-up](https://example.com/post).";
    const out = speakableText(md);
    expect(out).toContain("He migrated 40,000 Stripe customers with zero downtime.");
    expect(out).not.toContain("[1]");
    expect(out).not.toContain("**");
    expect(out).not.toContain("example.com");
    expect(out).not.toContain("#");
  });

  it("drops fenced code but keeps the prose around it", () => {
    const out = speakableText("Here is the query:\n```sql\nselect * from t;\n```\nIt ran in 40ms.");
    expect(out).toContain("It ran in 40ms.");
    expect(out).not.toContain("select");
  });

  it("speaks units and symbols as words", () => {
    const out = speakableText("Serves 1.2M monthly users · 10x faster → 200ms.");
    expect(out).toContain("1.2 million monthly users");
    expect(out).toContain("10 times faster");
    expect(out).not.toContain("·");
    expect(out).not.toContain("→");
  });

  it("reads table rows as comma-separated text", () => {
    const out = speakableText("| Stack | Use |\n| --- | --- |\n| LangGraph | agents |");
    expect(out).toContain("LangGraph, agents");
    expect(out).not.toContain("|");
  });

  it("trims a long answer at a sentence boundary inside the limit", () => {
    const long = "Sentence one is here. ".repeat(200);
    const out = trimForSpeech(long, 120);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith(".")).toBe(true);
  });

  it("returns empty text when there is nothing to say", () => {
    expect(prepareForSpeech("   \n[1] \n")).toBe("");
  });

  it("ends with punctuation so the voice closes the sentence", () => {
    expect(prepareForSpeech("He built a RAG pipeline")).toBe("He built a RAG pipeline.");
  });
});
