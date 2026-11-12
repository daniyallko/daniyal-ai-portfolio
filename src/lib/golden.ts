// Golden test set: recruiter questions with the chunks that must be retrieved
// and the facts a good answer must mention (case-insensitive substrings).
export type GoldenCase = {
  id: string;
  question: string;
  expectedChunks: string[];
  mustMention: string[];
  expectNoContext?: boolean;
};

export const golden: GoldenCase[] = [
  {
    id: "rag-prod",
    question: "What RAG systems has Daniyal built in production?",
    expectedChunks: ["exp-wisdmlabs-1", "proj-ai-botkit"],
    mustMention: ["AI BotKit", "hybrid", "rerank"],
  },
  {
    id: "scale",
    question: "How many websites and users does AI BotKit serve?",
    expectedChunks: ["exp-wisdmlabs-0", "proj-ai-botkit"],
    mustMention: ["1,000", "100,000"],
  },
  {
    id: "stripe",
    question: "Has he migrated Stripe customers?",
    expectedChunks: ["exp-wisdmlabs-6"],
    mustMention: ["10,000", "downtime"],
  },
  {
    id: "relocate",
    question: "Is he open to relocating to the UAE?",
    expectedChunks: ["contact"],
    mustMention: ["UAE", "remote"],
  },
  {
    id: "agents",
    question: "What experience does he have with LangGraph and agents?",
    expectedChunks: ["exp-wisdmlabs-2"],
    mustMention: ["LangGraph", "tool calling"],
  },
  {
    id: "voice",
    question: "Has he worked on voice AI?",
    expectedChunks: ["exp-wisdmlabs-4", "proj-voice-agent"],
    mustMention: ["Whisper", "voice"],
  },
  {
    id: "uptime",
    question: "What infrastructure does Edwiser.org run on and what uptime?",
    expectedChunks: ["exp-wisdmlabs-5", "proj-edwiser"],
    mustMention: ["Kubernetes", "99.9"],
  },
  {
    id: "education",
    question: "Where did he study?",
    expectedChunks: ["education"],
    mustMention: ["B.Tech", "Babu Banarasi Das"],
  },
  {
    id: "observability",
    question: "How does he trace and evaluate LLM responses?",
    expectedChunks: ["exp-wisdmlabs-3"],
    mustMention: ["LangSmith"],
  },
  {
    id: "proprofs",
    question: "What did he do at ProProfs?",
    expectedChunks: ["exp-proprofs-0"],
    mustMention: ["PHP", "A/B"],
  },
  {
    id: "unknown-salary",
    question: "What annual compensation does he expect?",
    expectedChunks: [],
    mustMention: [],
    expectNoContext: true,
  },
  {
    id: "unknown-pilot",
    question: "Does he hold an aviation pilot licence?",
    expectedChunks: [],
    mustMention: [],
    expectNoContext: true,
  },
  {
    id: "off-topic-weather",
    question: "Will it rain in Reykjavik tomorrow?",
    expectedChunks: [],
    mustMention: [],
    expectNoContext: true,
  },
];
