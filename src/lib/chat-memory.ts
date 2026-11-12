export const MEMORY_FETCH_LIMIT = 24;
export const MEMORY_SUMMARY_THRESHOLD = 10;
export const MEMORY_BATCH_SIZE = 6;
export const MEMORY_KEEP_VERBATIM = 6;
export const MAX_HISTORY_MESSAGE_CHARS = 4000;
export const MAX_SUMMARY_CHARS = 4000;

export type ChatHistoryMessage = {
  role: string;
  content: string;
  debug?: unknown;
};

export type ChatMemoryPlan = {
  recent: ChatHistoryMessage[];
  older: ChatHistoryMessage[];
  summary: string;
  summaryCount: number;
  shouldFold: boolean;
};

export function messageOutcome(message: ChatHistoryMessage): string | null {
  if (!message.debug || typeof message.debug !== "object") return null;
  const outcome = (message.debug as { outcome?: unknown }).outcome;
  return typeof outcome === "string" ? outcome : null;
}

export function isUsableChatMessage(message: ChatHistoryMessage): boolean {
  const outcome = messageOutcome(message);
  return (
    (message.role === "user" || message.role === "assistant") &&
    message.content.trim().length > 0 &&
    outcome !== "provider_error" &&
    outcome !== "aborted"
  );
}

function usable(messages: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return messages.filter(isUsableChatMessage).map((message) => ({
    ...message,
    content:
      message.content.length > MAX_HISTORY_MESSAGE_CHARS
        ? `…${message.content.slice(-(MAX_HISTORY_MESSAGE_CHARS - 1))}`
        : message.content,
  }));
}

/** Plan an incremental fold using absolute row counts and a bounded DB fetch window. */
export function planChatMemory(
  history: ChatHistoryMessage[],
  totalCount: number,
  priorSummary: string,
  priorSummaryCount: number,
): ChatMemoryPlan {
  const keep = history.slice(-MEMORY_KEEP_VERBATIM);
  const base = {
    recent: usable(totalCount <= MEMORY_SUMMARY_THRESHOLD ? history : keep),
    summary: priorSummary,
    summaryCount: priorSummaryCount,
  };
  if (totalCount <= MEMORY_SUMMARY_THRESHOLD) return { ...base, older: [], shouldFold: false };

  const newSinceFold = totalCount - priorSummaryCount - MEMORY_KEEP_VERBATIM;
  if (priorSummary && newSinceFold < MEMORY_BATCH_SIZE) {
    return { ...base, older: [], shouldFold: false };
  }

  const offset = totalCount - history.length;
  const foldFrom = Math.max(0, priorSummaryCount - offset);
  const foldTo = Math.max(foldFrom, history.length - MEMORY_KEEP_VERBATIM);
  const older = usable(history.slice(foldFrom, foldTo));
  return {
    ...base,
    older,
    summaryCount: older.length ? totalCount - MEMORY_KEEP_VERBATIM : priorSummaryCount,
    shouldFold: older.length > 0,
  };
}
