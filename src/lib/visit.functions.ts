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
    const { notifyOwner, shortId } = await import("@/lib/telegram.server");
    const h = getRequest()?.headers;
    const ip = h?.get("cf-connecting-ip") ?? h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const country = h?.get("cf-ipcountry") ?? null;
    const city = h?.get("cf-ipcity") ?? null;
    const ua = h?.get("user-agent")?.slice(0, 400) ?? null;

    const { data: existing } = await supabaseAdmin.from("visitors").select("last_seen, visits").eq("id", data.visitorId).maybeSingle();
    const now = new Date();
    if (!existing) {
      await supabaseAdmin.from("visitors").insert({ id: data.visitorId, ip, country, city, user_agent: ua, referrer: data.referrer || null, language: data.language ?? null, landing_path: data.path });
      await notifyOwner(["🆕 New visitor on your portfolio", `ID: ${shortId(data.visitorId)}`, `Page: ${data.path}`, country && `Country: ${country}${city ? ` / ${city}` : ""}`, ip && `IP: ${ip}`, data.language && `Language: ${data.language}`, data.referrer && `From: ${data.referrer}`, ua && `Device: ${ua}`]);
      return { ok: true };
    }
    const gap = now.getTime() - new Date(existing.last_seen).getTime();
    const returning = gap > RETURN_GAP_MS;
    await supabaseAdmin.from("visitors").update({ last_seen: now.toISOString(), ...(returning ? { visits: existing.visits + 1 } : {}), ip, country, city, user_agent: ua }).eq("id", data.visitorId);
    if (returning) await notifyOwner([`🔁 Returning visitor (visit #${existing.visits + 1})`, `ID: ${shortId(data.visitorId)}`, `Page: ${data.path}`, country && `Country: ${country}`, ip && `IP: ${ip}`]);
    return { ok: true };
  });
