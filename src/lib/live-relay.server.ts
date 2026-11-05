import process from "node:process";
import { buildChunks } from "./portfolio";
import { CHAT_SYSTEM } from "./prompt";
import { retrieve } from "../server/rag.server";
import { GUARDRAIL } from "./voice-logic";
import { getPersona, type VoicePersona } from "../config/voicePersonas";
import { LANGUAGES, LANGUAGE_RULE, fillerFor, isLangCode, type LangCode } from "./language";

import {
  connectLive,
  streamResponse,
  type LiveCommand,
  type LiveEvent,
  type LiveModel,
  type ResponsesInputItem,
  type ResponsesRequest,
  type ResponsesResponse,
} from "@lovable.dev/ai-gateway";

export type LiveConfig = {
  key: string;
  liveModel: LiveModel;
  backendModel: ResponsesRequest["model"];
  openingInstructions?: string;
  persona: VoicePersona;
  lang: LangCode | null;
};

// Fill the literal model slugs from co-loaded knowledge before typechecking.
const liveSettings = { liveModel: "openai/gpt-live-1", backendModel: "openai/gpt-6-astra" } as const;

export type LiveSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (data: unknown) => void): void;
  onClose(handler: () => void): void;
  onError(handler: () => void): void;
};

export type LiveExecutionContext = { waitUntil(task: Promise<unknown>): void };

type WorkerSocket = WebSocket & { accept(): void };
declare const WebSocketPair: { new (): { 0: WorkerSocket; 1: WorkerSocket } };
type Transcript = {
  role: "user" | "assistant";
  text: string;
  start_ms: number;
  end_ms: number;
  listeningSound: boolean;
};
type ProviderEvent = LiveEvent<LiveConfig["liveModel"]>;
type DelegationEvent = Extract<ProviderEvent, { type: "session.delegation.created" }>;
type VoiceSession = Awaited<ReturnType<typeof connectLive>>;

export function getLiveConfig(url?: string): LiveConfig {
  const params = new URL(url ?? "/", "http://local").searchParams;
  const persona = getPersona(params.get("voice"));
  const langParam = params.get("lang");
  const lang = isLangCode(langParam) ? langParam : null;
  const config: LiveConfig = {
    ...liveSettings,
    persona,
    lang,
    key: process.env["LOVABLE_API_KEY"] ?? "",
    openingInstructions:
      `In ${lang ? LANGUAGES[lang].name : "English"}, greet the caller in one short sentence as Daniyal's portfolio voice assistant, then ask what they'd like to know about his experience or projects. Then listen.`,
  };
  if ([config.key, config.liveModel, config.backendModel].some((value) => !value)) {
    throw new Error("Missing Live relay configuration");
  }
  return config;
}

export function validateLiveUpgrade(request: Request, options: { allowMissingOrigin?: boolean } = {}): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null ? !options.allowMissingOrigin : origin !== new URL(request.url).origin) {
    return new Response("Voice connection origin rejected", { status: 403 });
  }
  if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket required", { status: 426 });
  }
  return null;
}

function workerSocket(socket: WorkerSocket): LiveSocket {
  return {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onMessage: (handler) => socket.addEventListener("message", (event) => handler(event.data)),
    onClose: (handler) => socket.addEventListener("close", handler),
    onError: (handler) => socket.addEventListener("error", handler),
  };
}

export function handleLiveRequest(request: Request): Response {
  const waitUntil = (request as Request & Partial<LiveExecutionContext>).waitUntil;
  if (!waitUntil) return new Response("Live runtime unavailable", { status: 503 });
  const config = getLiveConfig(request.url);
  const rejected = validateLiveUpgrade(request);
  if (rejected) return rejected;
  const pair = new WebSocketPair();
  pair[1].accept();
  bindLiveConnection(workerSocket(pair[1]), config, { waitUntil });
  const response: ResponseInit & { webSocket: WebSocket } = { status: 101, webSocket: pair[0] };
  return new Response(null, response);
}

function conversationInstructions(config: LiveConfig) {
  const female = config.persona.gender === "female";
  const fillers = (["en", "hi", "es", "fr", "de"] as const).map((l) => `${LANGUAGES[l].name}: "${fillerFor(l, female)}"`).join("; ");
  const profile = buildChunks().map((c) => `- (${c.section}) ${c.title}: ${c.text}`).join("\n");
  return `You are the voice assistant on Mohd Daniyal's portfolio, talking with recruiters and hiring managers.
${config.lang ? `Always speak ${LANGUAGES[config.lang].name}.` : "Detect the language the user speaks (including Hinglish and other code-switched mixes) and answer in that same language and register; start in English."}
You speak as the "${config.persona.name}" persona (${config.persona.tagline}).
${LANGUAGE_RULE}
Be warm, confident and brief: one to three short sentences per turn, then let them talk.
Refer to him as Daniyal. Use only the PROFILE below. Never invent facts, numbers, dates or employers.
If the profile doesn't cover something, say so and suggest emailing daniyallko@gmail.com.
Read emails and links naturally (say "at" and "dot"). Don't read markdown or bullet symbols aloud.
Backchannel policy: Use light listening sounds sparingly; never talk over the user.
Interruption policy: When the user starts speaking, stop immediately, drop the rest of your answer and respond to what they just said.
${GUARDRAIL}
Latency masking: Before delegating to the backend, say a brief natural filler first, in the language the user just used, never English for a non-English speaker. Examples: ${fillers}.
Delegation policy:
Backend tools: A portfolio search that returns grounded, detailed answers.
Delegate to the backend when: The user asks for a detailed comparison or a detail the profile below does not clearly answer.
Do not delegate to the backend when: Greeting, small talk, clarifying, or the answer is in the profile below. Answer those directly and immediately.
PROFILE:
${profile}`;
}

async function answerQuestion(
  messages: ResponsesInputItem[],
  config: LiveConfig,
  correlation: { runID: string; sessionID: string; delegationID: string },
  signal: AbortSignal,
  consumeInput: () => void,
) {
  signal.throwIfAborted();
  consumeInput();
  const lastUser = [...messages].reverse().slice(0, 6).filter((m) => "role" in m && m.role === "user").map((m) => ("content" in m && typeof m.content === "string" ? m.content : "")).reverse().join(" ");
  const { sources } = await retrieve(lastUser || "Daniyal experience");
  const ctx = sources.map((s) => `[${s.n}] (${s.section}) ${s.title}\n${s.text}`).join("\n\n") || "(no relevant sources)";
  const stream = await streamResponse(
    {
      model: config.backendModel,
      input: [...messages, { role: "user", content: `SOURCES:\n${ctx}\n\nAnswer the latest user question for a spoken reply.` }],
      instructions: CHAT_SYSTEM + "\nThis answer will be spoken aloud: no markdown, no citation numbers, at most 70 words. Answer in the language the user spoke, keeping technical terms in English. Use the latest correction if transcripts were revised.",
      reasoning: { effort: "low" },
    },
    { apiKey: config.key, signal, maxRetries: 0, runId: correlation.runID, metadata: { live_session_id: correlation.sessionID, delegation_id: correlation.delegationID } },
  );
  let completed: ResponsesResponse | undefined;
  for await (const event of stream) if (event.type === "response.completed") completed = event.response;
  signal.throwIfAborted();
  if (!completed || completed.status !== "completed") throw new Error("The backend response did not complete");
  const answer = completed.output.flatMap((item) => (item.type === "message" ? item.content.flatMap((part) => (part.type === "output_text" ? [part.text] : [])) : [])).join("\n");
  if (!answer.trim()) throw new Error("The backend response had no answer");
  messages.push({ role: "assistant", content: answer });
  return answer;
}

function isListeningSound(text: string) {
  const normalized = text.toLowerCase().replace(/[\s\p{Pd}]/gu, "");
  return /^(?:m+hm+|uhhuh)[.,!]*$/.test(normalized);
}

function* commentaryChunks(content: string) {
  const encoder = new TextEncoder();
  let chunk = "";
  let bytes = 0;
  for (const [word] of content.matchAll(/\S+\s*|\s+/gu)) {
    // Chunks stay well inside the provider's per-append size limit.
    if (chunk && bytes + encoder.encode(word).length > 480) {
      yield chunk;
      chunk = "";
      bytes = 0;
    }
    for (const character of word) {
      const size = encoder.encode(character).length;
      if (bytes + size > 480) {
        yield chunk;
        chunk = "";
        bytes = 0;
      }
      chunk += character;
      bytes += size;
    }
  }
  if (chunk) yield chunk;
}

export function bindLiveConnection(
  browser: LiveSocket,
  configuration: LiveConfig,
  execution: LiveExecutionContext,
): void {
  const config = { ...configuration };
  const runID = crypto.randomUUID();
  const setupAbort = new AbortController();
  let gateway: VoiceSession | undefined;
  let sessionID: string | undefined;
  let starting = false;
  let closing = false;
  let finished = false;
  let revision = 0;
  let task: AbortController | undefined;
  const pendingDelegations: Array<{
    event: DelegationEvent;
  }> = [];
  let completedDelegation: (typeof pendingDelegations)[number] | undefined;
  const backendMessages: ResponsesInputItem[] = [];
  let transcriptCursor = 0;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let browserReady = false;
  let greetingRequested = false;
  let greetingCommand: { id: string; type: "instructions" | "commentary" } | undefined;
  let greetingTimer: ReturnType<typeof setTimeout> | undefined;
  const startTimer = setTimeout(() => {
    emit({ type: "app.error", error: { message: "Voice startup message timed out" } });
    stop();
  }, 5000);
  const transcripts: Transcript[] = [];
  const delegations = new Set<string>();

  function emit(event: object) {
    if (browser.readyState !== 1) return;
    try {
      browser.send(JSON.stringify(event));
    } catch {
      stop();
    }
  }

  function close(socket?: LiveSocket) {
    if (!socket || socket.readyState === 3) return;
    try {
      socket.close(1000, "Call ended");
    } catch {
      return;
    }
  }

  function clearGreeting() {
    clearTimeout(greetingTimer);
    greetingCommand = undefined;
  }

  function requestGreeting() {
    const content = (
      config.openingInstructions ??
      "Start the conversation now in your configured language and role. Give a brief greeting suited to this app's purpose, ask one relevant opening question, then listen."
    ).trim();
    if (!content || !browserReady || !sessionID || greetingRequested || closing) return;
    greetingRequested = true;
    if (new TextEncoder().encode(content).length > 480) {
      emit({ type: "app.greeting.error", error: { message: "The opening instructions are too long" } });
      return;
    }
    greetingCommand = { id: crypto.randomUUID(), type: "instructions" };
    greetingTimer = setTimeout(() => {
      clearGreeting();
      emit({ type: "app.greeting.error", error: { message: "The opening could not be confirmed" } });
    }, 10_000);
    sendGateway({
      type: "session.instructions.append",
      event_id: greetingCommand.id,
      delegation_id: null,
      content,
    });
  }

  function discardPendingWork() {
    pendingDelegations.length = 0;
    completedDelegation = undefined;
    clearTimeout(restartTimer);
    task?.abort();
  }

  function finish() {
    if (finished) return;
    finished = closing = true;
    clearTimeout(startTimer);
    clearTimeout(restartTimer);
    clearGreeting();
    discardPendingWork();
    setupAbort.abort();
    if (gateway) execution.waitUntil(gateway.close());
    close(browser);
  }

  function stop() {
    if (closing) return;
    closing = true;
    discardPendingWork();
    clearTimeout(startTimer);
    clearGreeting();
    if (gateway) execution.waitUntil(gateway.close());
    else finish();
  }

  function sendGateway(event: LiveCommand<LiveConfig["liveModel"]>) {
    if (!gateway || closing) return;
    execution.waitUntil(
      gateway.send(event).catch(() => {
        emit({ type: "app.error", error: { message: "Voice command could not be sent" } });
        stop();
      }),
    );
  }

  function scheduleDelegation() {
    clearTimeout(restartTimer);
    if (closing || task || pendingDelegations.length === 0) return;
    restartTimer = setTimeout(() => void runDelegation(), 300);
  }

  function deliverResult(delegationID: string, answer: string) {
    if (closing) return;
    if (!gateway) return stop();
    try {
      for (const content of commentaryChunks(answer)) {
        sendGateway({
          type: "session.commentary.append",
          event_id: crypto.randomUUID(),
          delegation_id: delegationID,
          content,
        });
      }
      completedDelegation = pendingDelegations.shift();
    } catch {
      stop();
    }
  }

  async function runDelegation() {
    const pending = pendingDelegations[0];
    const event = pending?.event;
    const id = event?.delegation?.id;
    if (!pending || !event || !id || !sessionID || closing || task) return;
    if (!transcripts.some(({ role, text }) => role === "user" && text.trim())) return;
    const controller = new AbortController();
    task = controller;
    let taskRevision = revision;
    try {
      const answer = await answerQuestion(
        backendMessages,
        config,
        { runID, sessionID, delegationID: id },
        controller.signal,
        () => {
          const updates = transcripts.slice(transcriptCursor);
          backendMessages.push(...updates.map(({ role, text }) => ({ role, content: text })));
          transcriptCursor = transcripts.length;
          taskRevision = revision;
        }
      );
      if (closing || controller.signal.aborted) return;
      if (taskRevision !== revision) return;
      deliverResult(id, answer.trim());
    } catch {
      if (closing || controller.signal.aborted) return;
      backendMessages.push({
        role: "assistant",
        content:
          "The backend attempt failed. Completed tool results remain valid; verify uncertain external actions before any retry.",
      });
      if (taskRevision !== revision) return;
      deliverResult(id, "The backend could not finish the answer. Ask whether the user wants to try again.");
    } finally {
      if (task === controller) task = undefined;
      scheduleDelegation();
    }
  }

  function queueDelegation(event: DelegationEvent) {
    pendingDelegations.push({ event });
    emit({ type: "app.delegation.pending", delegation_id: event.delegation?.id });
    scheduleDelegation();
  }

  function receiveGateway(event: ProviderEvent) {
    try {
      if (browser.readyState === 1) browser.send(JSON.stringify(event));
      if (event.type === "session.closed") return finish();
      if (event.type === "gateway.session.closing" || event.type === "gateway.error") {
        return stop();
      }
      if (closing) return;
      if (event.type === "gateway.session.created") {
        sessionID = event.session?.id;
        requestGreeting();
      }
      if (
        greetingCommand &&
        event.type === `session.${greetingCommand.type}.appended` &&
        "client_event_id" in event &&
        event.client_event_id === greetingCommand.id
      ) {
        if (greetingCommand.type === "instructions") {
          greetingCommand = { id: crypto.randomUUID(), type: "commentary" };
          sendGateway({
            type: "session.commentary.append",
            event_id: greetingCommand.id,
            delegation_id: null,
            content: "Begin the conversation now, following the instructions provided.",
          });
        } else {
          clearGreeting();
          emit({ type: "app.greeting.accepted" });
        }
      } else if (greetingCommand && event.type === "error" && event.error?.client_event_id === greetingCommand.id) {
        clearGreeting();
        emit({ type: "app.greeting.error", error: { message: event.error.message ?? "The opening was rejected" } });
      }
      if (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") {
        const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
        if (!event.delta?.trim()) return;
        const listeningSound = role === "user" && Boolean(task) && isListeningSound(event.delta);
        transcripts.push({
          role,
          text: event.delta,
          start_ms: event.start_ms ?? 0,
          end_ms: event.end_ms ?? 0,
          listeningSound,
        });
        if (listeningSound) return;
        if (role === "user") {
          revision++;
          const offset = completedDelegation?.event.offset_ms;
          // Live has no transcript watermark; completed handoffs can receive late context.
          if (
            pendingDelegations.length === 0 &&
            completedDelegation &&
            typeof offset === "number" &&
            Number.isFinite(offset) &&
            offset >= 0 &&
            typeof event.start_ms === "number" &&
            Number.isFinite(event.start_ms) &&
            event.start_ms >= 0 &&
            event.start_ms <= offset
          ) {
            pendingDelegations.push(completedDelegation);
            completedDelegation = undefined;
          }
          if (pendingDelegations.length) {
            emit({ type: "app.delegation.pending", delegation_id: pendingDelegations[0]?.event.delegation?.id });
          }
        }
        scheduleDelegation();
      } else if (event.type === "session.delegation.created") {
        const id = event.delegation?.id;
        if (id && event.delegation?.target === "client" && !delegations.has(id)) {
          delegations.add(id);
          queueDelegation(event);
        }
      }
    } catch {
      emit({ type: "app.error", error: { message: "Invalid voice event or lost connection" } });
      stop();
    }
  }

  async function startSession(sdp: string) {
    if (closing || browser.readyState !== 1) return;
    clearTimeout(startTimer);
    const { syncDocuments } = await import("@/server/kb-docs.server");
    await syncDocuments().catch(() => {});
    const accepted = await connectLive(
      {
        type: "session.start",
        session: {
          model: config.liveModel,
          instructions: conversationInstructions(config),
          audio: { output: { voice: config.persona.liveVoice } },
          delegation: { type: "client" },
        },
        transport: { type: "webrtc", sdp },
      },
      { apiKey: config.key, signal: setupAbort.signal, runId: runID },
    );
    if (closing || browser.readyState !== 1) {
      execution.waitUntil(accepted.close());
      return;
    }
    gateway = accepted;
    execution.waitUntil(
      (async () => {
        try {
          for await (const event of accepted) receiveGateway(event);
        } catch {
          if (!closing) emit({ type: "app.error", error: { message: "Voice gateway connection failed" } });
        } finally {
          finish();
        }
      })(),
    );
  }

  browser.onMessage((data) => {
    try {
      if (typeof data !== "string" || data.length > 64 * 1024) throw new Error("Invalid client message");
      const event = JSON.parse(data);
      if (event.type === "session.close") return stop();
      if (closing) return;
      if (!gateway) {
        if (starting || event.type !== "app.start" || typeof event.sdp !== "string" || !event.sdp.trim()) {
          throw new Error("Voice startup message required");
        }
        starting = true;
        execution.waitUntil(
          startSession(event.sdp).catch((error) => {
            if (!closing)
              emit({
                type: "app.error",
                error: { message: error instanceof Error ? error.message : "Voice startup failed" },
              });
            stop();
          }),
        );
        return;
      }
      if (event.type === "app.ready") {
        browserReady = true;
        requestGreeting();
        return;
      }
      if (event.type !== "gateway.heartbeat") {
        throw new Error("Unsupported client event");
      }
      sendGateway({ type: "gateway.heartbeat" });
    } catch {
      emit({ type: "app.error", error: { message: "Voice connection could not be started or continued" } });
      stop();
    }
  });
  browser.onClose(stop);
  browser.onError(stop);
}
