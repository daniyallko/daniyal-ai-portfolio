<div align="center">

# Daniyal.online — Voice AI & Hybrid RAG Portfolio

**An interactive portfolio for Mohd Daniyal, Full Stack AI Engineer. Recruiters can ask questions by text or live voice and get cited answers.**

[![Live](https://img.shields.io/badge/live-daniyal.online-E5A93C?style=for-the-badge)](https://daniyal.online)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-FF4154?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![Tailwind v4](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)

</div>

---

## Features

| | Feature | Details |
|---|---|---|
| 🎙️ | **Real-time voice calls** | WebRTC voice, AudioWorklet VAD, barge-in, answers start on the first clause |
| 🔎 | **Hybrid RAG** | BM25 + embeddings fused with Reciprocal Rank Fusion, inline citations |
| 🌐 | **Multilingual** | Deterministic language detection (Hindi, Hinglish, Spanish, French, Japanese and more), cross-lingual query bridge |
| 🗣️ | **Voice personas** | 4 switchable voices, pre-recorded previews, read-aloud for every answer |
| ⚡ | **3-tier cache** | Browser RAM/localStorage → isolate hot RAM → Postgres query cache |
| 📊 | **Telemetry HUD** | `Ctrl+Shift+D` latency breakdown and automated self-tests |
| 🧪 | **Evaluation** | Golden test set scoring answer quality, citation coverage, recall and latency |
| 🛡️ | **Admin console** | Visitor sessions, chat histories, knowledge-base editing with PDF ingestion, resume upload |
| 📨 | **Owner alerts** | Telegram notifications for visits, chats and voice turns |

---

## System architecture

```mermaid
flowchart LR
    subgraph Browser
        UI[Portfolio UI<br/>+ Inline Assistant]
        MIC[Mic] --> VAD[VAD AudioWorklet]
        PB[Playback Worklet] --> SPK[Speaker]
        L1[(L1 cache<br/>RAM + localStorage)]
    end

    subgraph Edge["Edge runtime (Workers)"]
        CHAT["/api/chat<br/>NDJSON stream"]
        LIVE["/api/live<br/>WebSocket relay"]
        STT["/api/transcribe"]
        TTS["/api/speak"]
        LID[Language ID +<br/>query bridge]
        RAG[Hybrid retrieval<br/>BM25 + vectors + RRF]
        L2[(L2 isolate<br/>hot RAM)]
    end

    subgraph Data["PostgreSQL"]
        KB[(kb_documents<br/>kb_embeddings)]
        L3[(rag_query_cache)]
        TH[(threads / messages)]
    end

    LLM[LLM + Realtime<br/>voice models]
    TG[Telegram]

    UI <--> L1
    UI <--> CHAT
    VAD --> LIVE
    LIVE --> PB
    UI --> STT --> CHAT
    UI --> TTS
    CHAT --> LID --> RAG
    RAG <--> L2 <--> L3
    RAG <--> KB
    CHAT --> TH
    CHAT <--> LLM
    LIVE <--> LLM
    CHAT --> TG
    LIVE --> TG
```

---

## Text question flow

```mermaid
sequenceDiagram
    autonumber
    participant U as Recruiter
    participant B as Browser
    participant S as /api/chat
    participant C as Cache tiers
    participant R as Hybrid RAG
    participant M as LLM

    U->>B: Types a question
    B->>S: POST question + thread
    S->>S: Detect language, bridge to English tokens
    S->>C: Look up versioned cache key
    alt Cache hit
        C-->>S: Cached answer + sources
    else Cache miss
        S->>R: BM25 + embedding search
        R-->>S: Top chunks (RRF fused)
        S->>M: Prompt + chunks + language instruction
        M-->>S: Token stream
    end
    S-->>B: sources → deltas → done (NDJSON)
    B-->>U: Answer with clickable citations
```

---

## Live voice pipeline

```mermaid
flowchart TB
    A[Microphone 24kHz] --> B{VAD worklet<br/>energy + spectral + duration}
    B -- noise / knock --> X[Ignored]
    B -- sustained speech --> C[Barge-in:<br/>flush playback buffer,<br/>turn_id++]
    C --> D[WebSocket relay]
    D --> E[Realtime model<br/>portfolio in instructions]
    E -- needs detail --> F[RAG fallback]
    F --> E
    E --> G[First-clause audio]
    G --> H[Ring buffer → speaker]
    H --> I[Live captions + co-browsing<br/>?hl= / ?skill= highlights]
```

**Guards:** idle cutoff, 5-minute call budget, guardrail checks, monotonic `turn_id` so stale audio is never played.

---

## Hybrid retrieval

```mermaid
flowchart LR
    Q[Query] --> N[Normalize +<br/>cross-lingual bridge]
    N --> BM[BM25 ranking]
    N --> EM[Embedding cosine]
    BM --> RRF[Reciprocal Rank Fusion]
    EM --> RRF
    RRF --> K[Top-k chunks<br/>with source IDs]
```

The corpus is built from structured portfolio data plus admin-added documents. Embeddings are keyed by content hash, so edited content re-embeds automatically.

---

## Caching hierarchy

```mermaid
graph TD
    R[Request] --> L1{L1 browser}
    L1 -- miss --> L2{L2 isolate RAM<br/>500 entries}
    L2 -- miss --> L3{L3 Postgres<br/>rag_query_cache}
    L3 -- miss --> G[Generate]
    G --> W[Write back via waitUntil]
    W --> L3 & L2 & L1
```

Only standalone, public-vocabulary answers generated without history are shared between visitors. Keys include corpus, prompt and model versions.

---

## Latency profile (local measurements)

```mermaid
xychart-beta
    title "Retrieval latency (ms, log-ish view)"
    x-axis ["Cold retrieval", "Warm retrieval", "Language ID", "Query bridge"]
    y-axis "ms" 0 --> 4000
    bar [3800, 4, 2, 5]
```

| Stage | Typical |
|---|---|
| Language detection | < 2 ms |
| Cross-lingual bridge | < 5 ms |
| Hot retrieval | 2–5 ms |
| Cold retrieval | ~3.8 s |
| Initial eval: answer quality / citation coverage / retrieval recall | 92% / 75% / 100% |

---

## Tech stack

```mermaid
mindmap
  root((Stack))
    Frontend
      React 19
      TanStack Router
      Tailwind v4
      AudioWorklets
    Server
      TanStack Start server functions
      Cloudflare Workers
      WebSocket relay
    Data
      PostgreSQL
      Row level security
      Storage bucket
    AI
      Embeddings
      LLM streaming
      Realtime voice
      Speech to text / TTS
    Ops
      Telemetry HUD
      Golden evals
      Telegram alerts
```

---

## Project structure

```text
src/
├── lib/
│   ├── portfolio.ts             # Single source of truth for content
│   ├── retrieval.ts             # BM25 + embeddings + RRF
│   ├── multilingualVoiceEngine.ts
│   ├── language.ts / voice-logic.ts / speech.ts
│   ├── golden.ts / eval-metrics.ts
│   └── prompt.ts
├── routes/
│   ├── index.tsx                # Portfolio + inline assistant
│   ├── chat.$threadId.tsx
│   ├── eval.tsx
│   ├── _authenticated/admin.tsx
│   └── api/                     # chat, live, speak, transcribe, eval, public/*
├── components/                  # thread-view, telemetry HUD, voice switcher…
└── hooks/                       # use-live-voice, use-speech
public/
├── voice-worklets.js            # VAD + playback worklets
└── voice-previews/              # Pre-recorded persona samples
```

---

## Getting started

```sh
git clone <this-repository-url>
cd <repository-name>
bun install        # or npm i
bun run dev        # http://localhost:8080
bunx vitest run    # tests
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`, plus server-side AI and Telegram keys.

---

<div align="center">

**Mohd Daniyal** · Full Stack AI Engineer
[daniyal.online](https://daniyal.online) · [daniyallko@gmail.com](mailto:daniyallko@gmail.com)

</div>
