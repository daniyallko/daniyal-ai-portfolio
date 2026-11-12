import { describe, expect, it } from "vitest";
import {
  followupQuery,
  shouldEscalateToContact,
  unansweredStreak,
  usableChatHistory,
} from "./chat-turn";

describe("chat turn policies", () => {
  it("removes failed and aborted answers from model history", () => {
    const history = [
      { role: "user", content: "question" },
      { role: "assistant", content: "partial", debug: { outcome: "aborted" } },
      { role: "assistant", content: "failed", debug: { outcome: "provider_error" } },
      { role: "assistant", content: "grounded", debug: { outcome: "ok" } },
    ];
    expect(usableChatHistory(history).map((m) => m.content)).toEqual(["question", "grounded"]);
  });

  it("counts consecutive no-context answers and resets after a grounded answer", () => {
    expect(
      unansweredStreak([
        { role: "assistant", content: "unknown", debug: { outcome: "no_reliable_context" } },
        { role: "assistant", content: "unknown", debug: { outcome: "no_reliable_context" } },
      ]),
    ).toBe(2);
    expect(
      unansweredStreak([
        { role: "assistant", content: "unknown", debug: { outcome: "no_reliable_context" } },
        { role: "assistant", content: "grounded", debug: { outcome: "ok" } },
        { role: "assistant", content: "unknown", debug: { outcome: "no_reliable_context" } },
      ]),
    ).toBe(1);
  });

  it("keeps off-topic and provider failures neutral for the streak", () => {
    expect(
      unansweredStreak([
        { role: "assistant", content: "unknown", debug: { outcome: "no_reliable_context" } },
        { role: "assistant", content: "declined", debug: { outcome: "off_topic" } },
        { role: "assistant", content: "unknown", debug: { outcome: "no_reliable_context" } },
      ]),
    ).toBe(2);
  });

  it("expands only short follow-ups with an earlier user turn", () => {
    expect(followupQuery("What about voice?", "Tell me about AI BotKit")).toBe(
      "Tell me about AI BotKit What about voice?",
    );
    expect(followupQuery("What about voice?", undefined)).toBe("What about voice?");
    expect(
      followupQuery(
        "Give me a detailed comparison of all the production AI systems",
        "Tell me about AI BotKit",
      ),
    ).toBe("Give me a detailed comparison of all the production AI systems");
  });

  it("offers contact on the second no-context answer only", () => {
    expect(shouldEscalateToContact([], "no_reliable_context")).toBe(false);
    expect(
      shouldEscalateToContact(
        [{ role: "assistant", content: "unknown", debug: { outcome: "no_reliable_context" } }],
        "no_reliable_context",
      ),
    ).toBe(true);
    expect(shouldEscalateToContact([], "off_topic")).toBe(false);
  });
});
