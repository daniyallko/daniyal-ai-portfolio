import { z } from "zod";

export type VisitorSummary = {
  id: string;
  first_seen: string | null;
  last_seen: string | null;
  visits: number;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  referrer: string | null;
  language: string | null;
  landing_path: string | null;
};
export type VisitorQuestion = { content: string; created_at: string; voice: boolean };

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function ipInfoLink(ip: string | null): string | null {
  if (!ip || !z.string().ip().safeParse(ip).success) return null;
  return `https://ipinfo.io/${ip}`;
}

/** A bounded summary, not a second copy of the full admin transcript. */
export function visitorTelegramMessage(visitor: VisitorSummary, questions: VisitorQuestion[]) {
  const field = (label: string, value: string | null) => value ? `${label}: ${escapeHtml(value.slice(0, 350))}` : null;
  const url = ipInfoLink(visitor.ip);
  const lines = [
    "<b>👤 Portfolio visitor</b>",
    field("ID", visitor.id),
    `Visits: ${visitor.visits}`,
    field("First seen (UTC)", visitor.first_seen),
    field("Last seen (UTC)", visitor.last_seen),
    field("Landing page", visitor.landing_path),
    field("Location", [visitor.country, visitor.city].filter(Boolean).join(" / ")),
    url && visitor.ip ? `IP: <a href="${url}">${escapeHtml(visitor.ip)}</a>` : null,
    field("Language", visitor.language),
    field("From", visitor.referrer),
    field("Device", visitor.user_agent),
    "",
    "<b>Recent chat / voice questions</b>",
  ].filter((line): line is string => line !== null);
  let text = lines.join("\n");
  // Input is newest first. Keep newest questions; never truncate an HTML entity or tag.
  let included = 0;
  for (const question of questions.slice(0, 20)) {
    const entry = `\n${question.voice ? "🎙️" : "💬"} ${escapeHtml(question.created_at)}\n${escapeHtml(question.content.slice(0, 320))}${question.content.length > 320 ? "…" : ""}`;
    if (text.length + entry.length > 3700) break;
    text += entry;
    included++;
  }
  if (!questions.length) text += "\nNo questions yet.";
  if (included < questions.length) text += "\nOlder questions remain in the admin console.";
  return text;
}