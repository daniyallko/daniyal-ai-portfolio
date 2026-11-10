// Owner notifications via the Telegram connector (gateway-backed).
const OWNER_CHAT_ID = 591159598;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function notifyOwner(lines: (string | null | undefined | false)[]) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const tg = process.env["TELEGRAM_API_KEY"];
  if (!lovable || !tg) {
    console.error("Telegram notify skipped: missing keys");
    return;
  }
  const text = lines
    .filter(Boolean)
    .map((l) => esc(String(l)))
    .join("\n")
    .slice(0, 4000);
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": tg,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text, disable_web_page_preview: true }),
    });
    if (!res.ok) console.error(`Telegram notify failed [${res.status}]: ${await res.text()}`);
  } catch (e) {
    console.error("Telegram notify error", e);
  }
}

export function shortId(id: string) {
  return id.slice(0, 8);
}
