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
    expectedChunks: ["proj-ai-botkit"],
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
    expectedChunks: ["doc-889c10c0-0"],
    mustMention: ["10,000", "downtime"],
  },
  {
    id: "relocate",
    question: "Is he open to relocating to the UAE or working remotely?",
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
    question: "How did Daniyal use Whisper in AI BotKit's Telegram voice support?",
    expectedChunks: ["doc-3523a1a4-2"],
    mustMention: ["Whisper", "language"],
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
    id: "availability",
    question: "Is Daniyal an immediate joiner with no notice period?",
    expectedChunks: ["contact", "doc-1e9da5bc-0"],
    mustMention: ["immediate", "no notice period"],
  },
  {
    id: "languages",
    question: "Which languages can Daniyal speak and read?",
    expectedChunks: ["doc-ed471a80-0"],
    mustMention: ["English", "Hindi", "Urdu", "Arabic"],
  },
  {
    id: "botkit-team",
    question: "How large was the AI BotKit team and what did Daniyal personally own?",
    expectedChunks: ["exp-wisdmlabs-0", "doc-7558d84f-2"],
    mustMention: ["four", "core"],
  },
  {
    id: "channel-architecture",
    question: "How are AI BotKit's WhatsApp and Telegram adapters designed around the shared RAG engine?",
    expectedChunks: ["doc-3523a1a4-1"],
    mustMention: ["adapter", "shared"],
  },
  {
    id: "photo-voice-pairing",
    question: "How does AI BotKit pair a photo with a voice note sent separately?",
    expectedChunks: ["doc-3523a1a4-4"],
    mustMention: ["buffer", "multimodal"],
  },
  {
    id: "opus-gain",
    question: "How did Daniyal make Telegram voice replies louder without transcoding?",
    expectedChunks: ["doc-3523a1a4-5"],
    mustMention: ["Opus", "checksum", "transcoding"],
  },
  {
    id: "knowledge-indexing",
    question: "How does AI BotKit crawl content, chunk it, and isolate each customer's knowledge?",
    expectedChunks: ["doc-c74fd2b9-0"],
    mustMention: ["overlapping", "isolated"],
  },
  {
    id: "streaming-handoff",
    question: "How does AI BotKit stream answers and hand over to a human?",
    expectedChunks: ["doc-c74fd2b9-2", "doc-c74fd2b9-3"],
    mustMention: ["Server-Sent Events", "handover"],
  },
  {
    id: "memory-summarization",
    question: "How does AI BotKit summarize long conversations while preserving important details?",
    expectedChunks: ["doc-c74fd2b9-3"],
    mustMention: ["PostgreSQL", "summar"],
  },
  {
    id: "podcast-pipeline",
    question: "How does Code To AI Podcast turn a GitHub commit or pull request into a podcast?",
    expectedChunks: ["doc-6d20066b-0", "doc-6d20066b-2"],
    mustMention: ["GitHub", "two-host", "FFmpeg"],
  },
  {
    id: "podcast-audio",
    question: "How does Code To AI Podcast produce broadcast-quality audio with FFmpeg?",
    expectedChunks: ["doc-6d20066b-4"],
    mustMention: ["sidechain", "EBU R128", "stereo"],
  },
  {
    id: "podcast-queue",
    question: "How does Code To AI Podcast queue renders, retry failures, and clean up files?",
    expectedChunks: ["doc-6d20066b-5"],
    mustMention: ["two", "exponential backoff", "two hours"],
  },
  {
    id: "podcast-mcp",
    question: "How does Code To AI Podcast support private code offline through MCP?",
    expectedChunks: ["doc-6d20066b-6"],
    mustMention: ["MCP", "local", "private"],
  },
  {
    id: "podcast-fallback",
    question: "How does Code To AI Podcast handle LLM failures and messy code diffs?",
    expectedChunks: ["doc-6d20066b-3"],
    mustMention: ["pattern-match", "raw commit hashes"],
  },
  {
    id: "stripe-rehearsal",
    question: "How did Daniyal rehearse the Stripe migration and keep subscription IDs synchronized?",
    expectedChunks: ["doc-889c10c0-1"],
    mustMention: ["staging", "subscription ID"],
  },
  {
    id: "one-click-upgrade",
    question: "How does Daniyal's one-click Edwiser upgrade plugin work?",
    expectedChunks: ["doc-e9bfa5fc-1"],
    mustMention: ["saved", "license", "checkout"],
  },
  {
    id: "limestreet",
    question: "What did Daniyal build and optimize at Limestreet?",
    expectedChunks: ["exp-limestreet-0"],
    mustMention: ["CDN", "payment"],
  },
  {
    id: "multi-agent-project",
    question: "How does Daniyal's personal multi-agent chatbot coordinate agents?",
    expectedChunks: ["proj-multi-agent"],
    mustMention: ["orchestration", "tool calling"],
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
