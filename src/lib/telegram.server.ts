// One durable Telegram message per browser visitor UUID, shared across visits and threads.
import { visitorTelegramMessage } from "@/lib/telegram-message";

const OWNER_CHAT_ID = 591159598;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export async function publishVisitorMessage(text: string, messageId: number | null): Promise<number> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const tg = process.env["TELEGRAM_API_KEY"];
  if (!lovable || !tg) throw new Error("Telegram credentials unavailable");
  const method = messageId === null ? "sendMessage" : "editMessageText";
  const response = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": tg,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      chat_id: OWNER_CHAT_ID,
      ...(messageId === null ? {} : { message_id: messageId }),
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const result = await response.json() as { ok?: boolean; description?: string; result?: { message_id?: number } };
  if (!response.ok || !result.ok) {
    const description = result.description ?? "Unknown Telegram error";
    if (messageId !== null && description.includes("message is not modified")) return messageId;
    // Only replace a confirmed deleted message, never send a duplicate after a timeout/temporary failure.
    if (messageId !== null && description.includes("message to edit not found")) return publishVisitorMessage(text, null);
    throw new Error(`Telegram ${method} failed [${response.status}]: ${description}`);
  }
  const id = result.result?.message_id;
  if (typeof id !== "number") throw new Error("Telegram did not return a message reference");
  return id;
}

export async function notifyVisitor(visitorId: string): Promise<void> {
  if (!process.env["LOVABLE_API_KEY"] || !process.env["TELEGRAM_API_KEY"]) return;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  try {
    // Durable revisions and a database lease serialize writers across server instances.
    const { error: queuedError } = await db.rpc("queue_visitor_telegram", { _visitor_id: visitorId });
    if (queuedError) throw queuedError;
    for (;;) {
      const token = crypto.randomUUID();
      const { data: claimed, error: claimError } = await db.rpc("claim_visitor_telegram", { _visitor_id: visitorId, _token: token });
      if (claimError) throw claimError;
      const state = claimed?.[0];
      // Another writer owns this visitor; it will pick up this pending revision before exiting.
      if (!state) return;
      let messageId = state.message_id;
      let deliveredRevision = 0;
      let pending = false;
      try {
        const [visitorResult, questionsResult] = await Promise.all([
          db.from("visitors").select("*").eq("id", visitorId).maybeSingle(),
          db.from("chat_messages")
            .select("content, created_at, debug, chat_threads!inner(visitor_id)")
            .eq("role", "user").eq("chat_threads.visitor_id", visitorId)
            .order("created_at", { ascending: false }).limit(20),
        ]);
        if (visitorResult.error) throw visitorResult.error;
        if (questionsResult.error) throw questionsResult.error;
        const visitor = visitorResult.data ?? {
          id: visitorId, first_seen: null, last_seen: null, visits: 0,
          ip: null, country: null, city: null, user_agent: null,
          referrer: null, language: null, landing_path: null,
        };
        const questions = (questionsResult.data ?? []).map((row) => ({
          content: row.content, created_at: row.created_at,
          voice: typeof row.debug === "object" && row.debug !== null && !Array.isArray(row.debug) && row.debug["via"] === "voice",
        }));
        messageId = await publishVisitorMessage(visitorTelegramMessage(visitor, questions), messageId);
        deliveredRevision = state.revision;
      } finally {
        // Release on failure too; pending revisions remain retryable on the next visitor event.
        const { data, error } = await db.rpc("finish_visitor_telegram", {
          _visitor_id: visitorId, _token: token, _revision: deliveredRevision,
          ... (messageId === null ? {} : { _message_id: messageId }),
        });
        if (error) throw error;
        pending = data === true;
      }
      if (!pending) return;
    }
  } catch (error) {
    console.error("Telegram visitor update failed", error);
  }
}