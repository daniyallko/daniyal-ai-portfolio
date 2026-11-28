import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  visitorId: z.string().uuid(),
  path: z.string().max(300),
  referrer: z.string().max(500).optional(),
  language: z.string().max(40).optional(),
});

const RETURN_GAP_MS = 30 * 60 * 1000;

export const trackVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyVisitor } = await import("@/lib/telegram.server");
    const h = getRequest()?.headers;
    const ip =
      h?.get("cf-connecting-ip") ?? h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const country = h?.get("cf-ipcountry") ?? null;
    const city = h?.get("cf-ipcity") ?? null;
    const ua = h?.get("user-agent")?.slice(0, 400) ?? null;

    const { data: existing } = await supabaseAdmin
      .from("visitors")
      .select("last_seen, visits")
      .eq("id", data.visitorId)
      .maybeSingle();
    const now = new Date();
    if (!existing) {
      await supabaseAdmin.from("visitors").upsert({
        id: data.visitorId,
        ip,
        country,
        city,
        user_agent: ua,
        referrer: data.referrer || null,
        language: data.language ?? null,
        landing_path: data.path,
      }, { onConflict: "id", ignoreDuplicates: true }).throwOnError();
      await notifyVisitor(data.visitorId);
      return { ok: true };
    }
    const gap = now.getTime() - new Date(existing.last_seen).getTime();
    const returning = gap > RETURN_GAP_MS;
    await supabaseAdmin
      .from("visitors")
      .update({
        last_seen: now.toISOString(),
        ...(returning ? { visits: existing.visits + 1 } : {}),
        ip,
        country,
        city,
        user_agent: ua,
      })
      .eq("id", data.visitorId).throwOnError();
    await notifyVisitor(data.visitorId);
    return { ok: true };
  });
