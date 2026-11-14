import { describe, expect, it } from "vitest";
import { detectSmallTalk, smallTalkReply } from "./small-talk";

describe("small talk fast-path", () => {
  it("detects greetings", () => {
    for (const m of ["hi", "Hello!", "hey there", "Good morning", "namaste ji", "नमस्ते"])
      expect(detectSmallTalk(m)).toBe("greeting");
  });
  it("detects thanks, bye, how are you", () => {
    expect(detectSmallTalk("thank you so much")).toBe("thanks");
    expect(detectSmallTalk("bye")).toBe("bye");
    expect(detectSmallTalk("how are you?")).toBe("how_are_you");
  });
  it("leaves real questions to the AI", () => {
    for (const m of ["hi, what is his tech stack?", "hello tell me about BotKit", "what is his salary"])
      expect(detectSmallTalk(m)).toBeNull();
  });
  it("echoes time of day and shows topics on the first turn", () => {
    const r = smallTalkReply("good evening", "en", true)!;
    expect(r.startsWith("Good evening!")).toBe(true);
    expect(r).toContain("/api/public/resume");
    expect(smallTalkReply("hi", "en", false)).not.toContain("/api/public/resume");
  });
});
