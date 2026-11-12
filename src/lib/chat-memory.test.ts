import { describe, expect, it } from "vitest";
import { planChatMemory } from "./chat-memory";

const messages = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message-${i + 1}`,
  }));

describe("rolling chat memory", () => {
  it("keeps short histories intact without summarizing", () => {
    const plan = planChatMemory(messages(4), 4, "", 0);
    expect(plan.recent.map((m) => m.content)).toEqual([
      "message-1",
      "message-2",
      "message-3",
      "message-4",
    ]);
    expect(plan.older).toEqual([]);
    expect(plan.shouldFold).toBe(false);
  });

  it("folds older messages once and keeps six recent messages", () => {
    const plan = planChatMemory(messages(11), 11, "", 0);
    expect(plan.older.map((m) => m.content)).toEqual([
      "message-1",
      "message-2",
      "message-3",
      "message-4",
      "message-5",
    ]);
    expect(plan.recent.map((m) => m.content)).toEqual([
      "message-6",
      "message-7",
      "message-8",
      "message-9",
      "message-10",
      "message-11",
    ]);
    expect(plan.summaryCount).toBe(5);
    expect(plan.shouldFold).toBe(true);
  });

  it("reuses the prior summary between six-message batches", () => {
    const plan = planChatMemory(messages(12), 12, "Known facts", 5);
    expect(plan.summary).toBe("Known facts");
    expect(plan.older).toEqual([]);
    expect(plan.shouldFold).toBe(false);
  });

  it("folds only newly uncovered messages at the next batch", () => {
    const plan = planChatMemory(messages(17), 17, "Known facts", 5);
    expect(plan.older.map((m) => m.content)).toEqual([
      "message-6",
      "message-7",
      "message-8",
      "message-9",
      "message-10",
      "message-11",
    ]);
    expect(plan.summaryCount).toBe(11);
  });

  it("excludes failed, aborted, and empty turns from model context", () => {
    const history = [
      { role: "user", content: "question" },
      { role: "assistant", content: "provider failed", debug: { outcome: "provider_error" } },
      { role: "assistant", content: "partial", debug: { outcome: "aborted" } },
      { role: "assistant", content: "" },
      { role: "assistant", content: "grounded", debug: { outcome: "ok" } },
    ];
    expect(planChatMemory(history, 5, "", 0).recent.map((m) => m.content)).toEqual([
      "question",
      "grounded",
    ]);
  });

  it("clips oversized history content to a bounded window", () => {
    const plan = planChatMemory([{ role: "user", content: "x".repeat(5000) }], 1, "", 0);
    expect(plan.recent[0]?.content).toHaveLength(4000);
    expect(plan.recent[0]?.content.endsWith("x".repeat(100))).toBe(true);
  });
});
