// Structured portfolio data. Single source of truth for both the UI and the
// chatbot knowledge base (chunks are derived from this file).

export const profile = {
  name: "Mohd Daniyal",
  title: "Full Stack AI Engineer",
  tagline: "Agentic AI · Advanced RAG · Voice AI",
  location: "Lucknow, India",
  availability: "Open to relocation (UAE / international) and remote",
  email: "daniyallko@gmail.com",
  phone: "+91 7007644677",
  website: "https://daniyal.online",
  summary:
    "Full Stack AI Engineer with 5+ years of experience building production web platforms, specializing in agentic AI, advanced RAG, and voice AI. Built core parts of AI BotKit, a multi-channel RAG chatbot platform live on 1,000+ websites serving 100,000+ users (hybrid retrieval with reranking, LangGraph agents, voice, WhatsApp and Telegram, LLM tracing). Also built multi-agent and real-time voice AI systems, and runs a licensing platform at 99.9% uptime on Kubernetes.",
};

export const stats = [
  { value: "5+", label: "years shipping production" },
  { value: "1,000+", label: "websites running AI BotKit" },
  { value: "100k+", label: "end users served" },
  { value: "99.9%", label: "uptime on Edwiser.org" },
];

export type Experience = {
  id: string;
  role: string;
  company: string;
  period: string;
  context?: string;
  bullets: string[];
};

export const experience: Experience[] = [
  {
    id: "wisdmlabs",
    role: "Software Engineer",
    company: "WisdmLabs",
    period: "July 2023 – Present",
    context:
      "AI BotKit (multi-tenant AI chatbot platform, team project) and Edwiser.org (production licensing platform)",
    bullets: [
      "AI BotKit: built core components of a multi-tenant RAG chatbot platform, now live on 1,000+ websites and serving 100,000+ users. It scans a customer's website and documents, builds a knowledge base, and embeds a chat widget through a single JavaScript snippet.",
      "Developed the advanced RAG pipeline: Pinecone hybrid search (dense + sparse), cross-encoder reranking, and relevance gating with query reformulation.",
      "Built the agentic chat engine with LangChain and LangGraph, with tool calling, persistent multi-turn memory in PostgreSQL, and multi-provider LLM support (OpenAI, Gemini).",
      "Built Python (FastAPI) services for the platform backend, and used LangSmith for LLM tracing, token tracking, and response evaluation.",
      "Implemented WhatsApp, Telegram, and other channel integrations, and voice support with Whisper transcription and replies in the user's language.",
      "Edwiser.org: owns this live licensing platform (license sales, activation and deactivation), responsible for 99.9% uptime, speed, server management, and custom development; infrastructure runs on Kubernetes.",
      "Migrated 10,000+ users between Stripe accounts with no downtime, and built a one-click Stripe subscription upgrade flow that charges the saved card and upgrades the license in one step.",
      "Moved the site to faster infrastructure; resolves support tickets and works directly with international clients.",
    ],
  },
  {
    id: "limestreet",
    role: "Software Engineer",
    company: "Limestreet (D.K. Sp. z o.o.)",
    period: "June 2022 – February 2023",
    bullets: [
      "Managed a live e-commerce site, built custom features, integrated payment methods, and improved page speed by optimizing delivery with a CDN.",
    ],
  },
  {
    id: "proprofs",
    role: "Software Engineer",
    company: "ProProfs",
    period: "June 2021 – June 2022",
    bullets: [
      "Built full stack features (PHP CodeIgniter, SQL, JavaScript, CSS) for a SaaS product where customers embed a JavaScript snippet, design popups, run A/B tests, and capture leads.",
    ],
  },
];

export type Project = {
  id: string;
  name: string;
  kind: string;
  blurb: string;
  details: string;
  tags: string[];
  featured?: boolean;
};

export const projects: Project[] = [
  {
    id: "ai-botkit",
    name: "AI BotKit",
    kind: "Production · WisdmLabs",
    blurb: "Multi-tenant RAG chatbot platform live on 1,000+ websites, serving 100,000+ users.",
    details:
      "Scans a customer's website and documents, builds a knowledge base, and embeds a chat widget with one JavaScript snippet. Pinecone hybrid search (dense + sparse), cross-encoder reranking, relevance gating with query reformulation, LangGraph agentic engine with tool calling, PostgreSQL memory, OpenAI and Gemini, LangSmith tracing, WhatsApp/Telegram channels and Whisper voice.",
    tags: ["LangGraph", "Pinecone", "FastAPI", "Reranking", "Whisper"],
    featured: true,
  },
  {
    id: "edwiser",
    name: "Edwiser.org",
    kind: "Production · WisdmLabs",
    blurb: "Licensing platform at 99.9% uptime on Kubernetes.",
    details:
      "Owns license sales, activation and deactivation. Migrated 10,000+ users between Stripe accounts with zero downtime and built a one-click subscription upgrade flow that charges the saved card and upgrades the license in one step.",
    tags: ["Kubernetes", "Stripe", "PHP", "Infra"],
  },
  {
    id: "voice-agent",
    name: "Real-time Voice Agent",
    kind: "Personal project",
    blurb: "Streaming voice assistant for live spoken conversations.",
    details:
      "Combines speech-to-text, an LLM, and text-to-speech in a streaming pipeline for live spoken conversations.",
    tags: ["STT", "LLM", "TTS", "Streaming"],
  },
  {
    id: "multi-agent",
    name: "Multi-agent Chatbot",
    kind: "Personal project",
    blurb: "Multiple AI agents coordinating to handle user requests.",
    details:
      "A chatbot where several AI agents coordinate via agent orchestration and tool calling to handle user requests.",
    tags: ["Orchestration", "Tool calling", "Agents"],
  },
];

export const skills: { group: string; items: string[] }[] = [
  {
    group: "Agentic AI & LLM",
    items: [
      "LangGraph",
      "LangChain",
      "Multi-agent orchestration",
      "Autonomous agents",
      "Tool calling",
      "Advanced RAG",
      "Hybrid search",
      "Embeddings",
      "Reranking",
      "Pinecone",
      "Prompt engineering",
      "LangSmith",
      "OpenAI API",
      "Gemini API",
    ],
  },
  {
    group: "Voice & Conversational",
    items: [
      "Real-time voice agents",
      "Whisper STT",
      "Text-to-speech",
      "AI chatbots",
      "WhatsApp Cloud API",
      "Telegram Bot API",
    ],
  },
  {
    group: "Languages & Frameworks",
    items: [
      "Python",
      "FastAPI",
      "TypeScript",
      "JavaScript",
      "Node.js",
      "React",
      "Next.js",
      "PHP",
      "SQL",
      "REST APIs",
      "Webhooks",
    ],
  },
  {
    group: "Data, Cloud & DevOps",
    items: [
      "PostgreSQL",
      "MySQL",
      "AWS",
      "Docker",
      "Kubernetes",
      "Linux",
      "CDN",
      "CI/CD",
      "Git & GitHub",
      "Stripe",
    ],
  },
];

export const education = {
  degree: "B.Tech, Computer Science and Engineering",
  period: "2016 – 2020",
  school:
    "Babu Banarasi Das Engineering College, Lucknow (Dr. A.P.J. Abdul Kalam Technical University)",
};

export type Chunk = { id: string; section: string; title: string; text: string };

// Admin-added documents (loaded server-side from kb_documents) join the corpus here.
let extraChunks: Chunk[] = [];
export function setExtraChunks(chunks: Chunk[]) {
  extraChunks = chunks;
}

/** Split an admin document into paragraph-aligned chunks with bounded overlap. */
export function chunkDocument(
  doc: { id: string; title: string; section: string; content: string },
  max = 900,
): Chunk[] {
  const overlap = Math.min(120, Math.floor(max / 5));
  const bodyMax = Math.max(1, max - overlap - (overlap ? 1 : 0));
  const paras = doc.content
    .replace(/\r/g, "")
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras.flatMap((p) =>
    p.length > bodyMax ? (p.match(new RegExp(`.{1,${bodyMax}}(\\s|$)`, "g")) ?? [p]) : [p],
  )) {
    if (cur && cur.length + p.length + 1 > bodyMax) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur} ${p.trim()}` : p.trim();
  }
  if (cur) out.push(cur);
  return out.map((body, i) => {
    const previous = i > 0 ? out[i - 1]! : "";
    const tail = previous.slice(-overlap).trim();
    const prefix = tail.includes(" ") ? tail.slice(tail.indexOf(" ") + 1) : tail;
    const text = prefix ? `${prefix} ${body}` : body;
    return {
      id: `doc-${doc.id.slice(0, 8)}-${i}`,
      section: doc.section,
      title: out.length > 1 ? `${doc.title} (${i + 1}/${out.length})` : doc.title,
      text,
    };
  });
}

export function buildChunks(): Chunk[] {
  const chunks: Chunk[] = [
    {
      id: "profile",
      section: "Profile",
      title: `${profile.name} — ${profile.title}`,
      text: `${profile.summary} Specializes in ${profile.tagline}.`,
    },
    {
      id: "contact",
      section: "Contact",
      title: "Contact & availability",
      text: `Location: ${profile.location}. Availability: ${profile.availability}. Email: ${profile.email}. Phone: ${profile.phone}. Website: ${profile.website}.`,
    },
    {
      id: "education",
      section: "Education",
      title: education.degree,
      text: `${education.degree}, ${education.period}, ${education.school}.`,
    },
  ];
  for (const e of experience) {
    e.bullets.forEach((b, i) =>
      chunks.push({
        id: `exp-${e.id}-${i}`,
        section: "Experience",
        title: `${e.role} @ ${e.company} (${e.period})`,
        text: `${e.role} at ${e.company}, ${e.period}. ${i === 0 && e.context ? e.context + ". " : ""}${b}`,
      }),
    );
  }
  for (const p of projects) {
    chunks.push({
      id: `proj-${p.id}`,
      section: "Projects",
      title: p.name,
      text: `${p.name} (${p.kind}): ${p.blurb} ${p.details} Tech: ${p.tags.join(", ")}.`,
    });
  }
  for (const s of skills) {
    chunks.push({
      id: `skill-${s.group.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      section: "Skills",
      title: s.group,
      text: `${s.group} skills: ${s.items.join(", ")}.`,
    });
  }
  return [...chunks, ...extraChunks];
}
