import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RatePolicy = {
  scope: string;
  identity?: string;
  limit: number;
  windowSeconds: number;
};

function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0];
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    forwarded ??
    "unknown"
  )
    .trim()
    .slice(0, 200);
}

function bucketKey(request: Request, policy: RatePolicy): string {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "development-only-rate-limit-secret";
  const identity = policy.identity ?? requestIp(request);
  const digest = createHmac("sha256", secret).update(identity).digest("hex");
  return `${policy.scope}:${digest}`;
}

/** Consume each policy atomically. Limiter outages fail closed before paid work. */
export async function enforceRateLimit(
  request: Request,
  policies: RatePolicy[],
): Promise<Response | null> {
  for (const policy of policies) {
    const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
      _key: bucketKey(request, policy),
      _limit: policy.limit,
      _window_seconds: policy.windowSeconds,
    });
    const result = data?.[0];
    if (error || !result) {
      console.error("Rate limiter unavailable", error?.message ?? "empty result");
      return Response.json(
        { error: "Rate limiter unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    if (!result.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "retry-after": String(Math.max(1, result.retry_after)),
            "cache-control": "no-store",
          },
        },
      );
    }
  }
  return null;
}
