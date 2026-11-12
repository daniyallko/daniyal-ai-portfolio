import { isUsableChatMessage, messageOutcome, type ChatHistoryMessage } from "@/lib/chat-memory";

export type ChatOutcome = "ok" | "no_reliable_context" | "off_topic" | "aborted" | "provider_error";

export function usableChatHistory(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return history.filter(isUsableChatMessage);
}

/** Count unresolved answers; successful answers reset, neutral turns do not. */
export function unansweredStreak(history: ChatHistoryMessage[]): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i]!;
    if (message.role !== "assistant") continue;
    const outcome = messageOutcome(message);
    if (outcome === "no_reliable_context") {
      streak++;
      continue;
    }
    if (outcome === "off_topic" || outcome === "provider_error" || outcome === "aborted") continue;
    break;
  }
  return streak;
}

export function shouldEscalateToContact(
  history: ChatHistoryMessage[],
  outcome: ChatOutcome,
): boolean {
  return outcome === "no_reliable_context" && unansweredStreak(history) >= 1;
}

export function followupQuery(message: string, previousUser?: string): string {
  return message.split(/\s+/).length < 8 && previousUser ? `${previousUser} ${message}` : message;
}
