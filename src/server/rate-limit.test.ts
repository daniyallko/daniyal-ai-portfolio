import { beforeEach, describe, expect, it, vi } from "vitest";
import { enforceRateLimit } from "./rate-limit.server";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: mocks.rpc },
}));

const request = () =>
  new Request("https://daniyal.online/api/chat", {
    headers: { "cf-connecting-ip": "203.0.113.10" },
  });
const policy = { scope: "chat:ip", limit: 20, windowSeconds: 60 };

beforeEach(() => {
  vi.clearAllMocks();
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-server-secret";
});

describe("atomic API rate limits", () => {
  it("allows requests while the atomic bucket is below its limit", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: true, remaining: 19, retry_after: 0 }],
      error: null,
    });
    expect(await enforceRateLimit(request(), [policy])).toBeNull();
    const { _key: key } = mocks.rpc.mock.calls[0]![1] as { _key: string };
    expect(key).not.toContain("203.0.113.10");
    expect(key).toMatch(/^chat:ip:[a-f0-9]{64}$/);
  });

  it("returns 429 with Retry-After when any policy is exhausted", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, retry_after: 37 }],
      error: null,
    });
    const response = await enforceRateLimit(request(), [policy]);
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("37");
    expect(await response?.json()).toEqual({ error: "Too many requests. Please try again later." });
  });

  it("fails closed with 503 when the limiter cannot be read", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "migration missing" } });
    const response = await enforceRateLimit(request(), [policy]);
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: "Rate limiter unavailable" });
  });
});
