import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ipInfoLink, visitorTelegramMessage, type VisitorSummary } from "./telegram-message";
import { publishVisitorMessage } from "./telegram.server";

const visitor: VisitorSummary = {
  id: "11111111-1111-4111-8111-111111111111", first_seen: "2026-11-28T08:22:00Z",
  last_seen: "2026-11-28T08:23:00Z", visits: 2, ip: "203.0.113.7", country: "IN",
  city: null, user_agent: "Test browser", referrer: null, language: "en", landing_path: "/",
};
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-only");
  vi.stubEnv("TELEGRAM_API_KEY", "test-only");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

function success(id: number) {
  return Response.json({ ok: true, result: { message_id: id } });
}

describe("consolidated Telegram notifications", () => {
  it("sends once, then edits the exact same Telegram message for that visitor", async () => {
    fetchMock.mockResolvedValueOnce(success(812)).mockResolvedValueOnce(success(812));
    const id = await publishVisitorMessage("first visit", null);
    expect(id).toBe(812);
    expect(await publishVisitorMessage("visit + chat + voice", id)).toBe(812);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://connector-gateway.lovable.dev/telegram/sendMessage");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://connector-gateway.lovable.dev/telegram/editMessageText");
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { message_id: number; chat_id: number };
    expect(secondBody.message_id).toBe(812);
    expect(secondBody.chat_id).toBe(591159598);
  });

  it("keeps separate message references for separate visitors", async () => {
    fetchMock.mockResolvedValueOnce(success(812)).mockResolvedValueOnce(success(813)).mockResolvedValueOnce(success(812));
    const first = await publishVisitorMessage("visitor A", null);
    const second = await publishVisitorMessage("visitor B", null);
    expect(second).toBe(813);
    expect(await publishVisitorMessage("A updated", first)).toBe(812);
  });

  it("does not create a duplicate when an edit fails temporarily", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, description: "Too Many Requests" }, { status: 429 }));
    await expect(publishVisitorMessage("updated", 812)).rejects.toThrow("429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats an unchanged edit as success", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, description: "Bad Request: message is not modified" }, { status: 400 }));
    expect(await publishVisitorMessage("same", 812)).toBe(812);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("replaces a confirmed deleted message and returns the new reference", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false, description: "Bad Request: message to edit not found" }, { status: 400 })).mockResolvedValueOnce(success(814));
    expect(await publishVisitorMessage("updated", 812)).toBe(814);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("links the visitor's IPv4 address to IPinfo", () => {
    expect(ipInfoLink("203.0.113.7")).toBe("https://ipinfo.io/203.0.113.7");
  });
  it("also supports an IPv6 visitor address", () => {
    expect(ipInfoLink("2001:db8::1")).toBe("https://ipinfo.io/2001:db8::1");
  });
  it("rejects invalid IP addresses rather than making arbitrary links", () => {
    expect(ipInfoLink('1.2.3.4\" onclick=\"bad')).toBeNull();
  });
  it("bounds recent chat and voice data without losing the most recent question", () => {
    const questions = Array.from({ length: 40 }, (_, i) => ({ content: `${i === 0 ? "latest-question" : "older"} ${"<>&".repeat(400)}`, created_at: "2026-11-28T08:23:00Z", voice: i % 2 === 0 }));
    const result = visitorTelegramMessage(visitor, questions);
    expect(result.length).toBeLessThan(4096);
    expect(result).toContain("latest-question");
    expect(result).not.toContain("<>&");
  });
});