import { useCallback, useEffect, useRef, useState } from "react";

export type LiveEvent = {
  type: string;
  reason?: string;
  error?: { message?: string };
  usage?: { seconds?: number };
  finalized?: boolean;
  transport?: { type?: string; sdp?: string };
  [key: string]: unknown;
};

export type VoiceTelemetry = {
  sessionId: string;
  turnId: number;
  micRms: number;
  zcr: number;
  vad: "speech" | "silence";
  silenceMs: number;
  onsetDetectMs: number | null;
  bufferMs: number;
  outRms: number;
  underruns: number;
  playedMs: number;
  assistantSpeaking: boolean;
  ducked: boolean;
  bargeIns: number;
  lastBargeCutMs: number | null;
  ttfaMs: number | null;
  connectedAt: number | null;
  lastActivity: number;
  maxMs: number;
  idleMs: number;
  worklet: boolean;
  micAnalyser: AnalyserNode | null;
  outAnalyser: AnalyserNode | null;
};

export const VOICE_IDLE_MS = 15_000;
export const VOICE_MAX_MS = 5 * 60_000;

function newTelemetry(): VoiceTelemetry {
  return {
    sessionId: crypto.randomUUID(), turnId: 0, micRms: 0, zcr: 0, vad: "silence", silenceMs: 0, onsetDetectMs: null,
    bufferMs: 0, outRms: 0, underruns: 0, playedMs: 0, assistantSpeaking: false, ducked: false, bargeIns: 0,
    lastBargeCutMs: null, ttfaMs: null, connectedAt: null, lastActivity: Date.now(), maxMs: VOICE_MAX_MS,
    idleMs: VOICE_IDLE_MS, worklet: false, micAnalyser: null, outAnalyser: null,
  };
}

type LiveState = {
  status: "idle" | "connecting" | "connected" | "stopping" | "closed";
  error: string | null;
  hasConnected: boolean;
  finalized: boolean | null;
  muted: boolean;
  playbackBlocked: boolean;
  outputMuted: boolean;
  endReason: "idle" | "budget" | null;
};

const initialState: LiveState = {
  status: "idle",
  error: null,
  hasConnected: false,
  finalized: null,
  muted: false,
  playbackBlocked: false,
  outputMuted: false,
  endReason: null,
};

export function useLiveVoice(
  options: {
    url?: string;
    onEvent?: (event: LiveEvent) => void | Promise<void>;
  } = {},
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<ReturnType<typeof createLiveVoice> | null>(null);
  const mounted = useRef(false);
  const latest = useRef(options);
  const [call, setCall] = useState(initialState);
  const telemetry = useRef<VoiceTelemetry>(newTelemetry());

  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const voice = controller.current;
      controller.current = null;
      voice?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!mounted.current || controller.current) return;
    const audio = audioRef.current;
    if (!audio) {
      setCall((previous) => ({ ...previous, error: "Voice playback is not mounted." }));
      return;
    }
    let endpoint: URL;
    try {
      endpoint = new URL(latest.current.url ?? "/api/live", window.location.href);
      if (endpoint.protocol === "https:") endpoint.protocol = "wss:";
      if (endpoint.protocol === "http:") endpoint.protocol = "ws:";
    } catch {
      setCall((previous) => ({ ...previous, error: "Invalid voice connection URL." }));
      return;
    }
    telemetry.current = newTelemetry();
    const voice = createLiveVoice({
      url: endpoint.href,
      audio,
      telemetry: telemetry.current,
      onEvent(event) {
        if (!mounted.current || controller.current !== voice) return;
        if (event.type === "app.connected") {
          setCall((previous) => ({ ...previous, status: "connected", hasConnected: true }));
        } else if (event.type === "app.stopping") {
          setCall((previous) => ({ ...previous, status: "stopping", playbackBlocked: false }));
        } else if (event.type === "app.closed") {
          controller.current = null;
          setCall((previous) => ({
            ...previous,
            status: "closed",
            muted: false,
            playbackBlocked: false,
            finalized: event.finalized === true,
            outputMuted: false,
            endReason: event.reason === "idle" || event.reason === "budget" ? event.reason : null,
          }));
        } else if (event.type === "app.playback.blocked" || event.type === "app.playback.resumed") {
          setCall((previous) => ({ ...previous, playbackBlocked: event.type === "app.playback.blocked" }));
        } else if (["app.error", "gateway.error", "error"].includes(event.type)) {
          setCall((previous) => ({ ...previous, error: event.error?.message ?? "Voice request failed." }));
        }
        try {
          void Promise.resolve(latest.current.onEvent?.(event)).catch(() => {
            console.error("Live UI event handler failed");
          });
        } catch {
          console.error("Live UI event handler failed");
        }
      },
    });
    controller.current = voice;
    setCall({ ...initialState, status: "connecting" });
    void voice.start();
  }, []);

  const stop = useCallback(() => {
    controller.current?.stop();
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    if (controller.current?.setMuted(muted)) setCall((previous) => ({ ...previous, muted }));
  }, []);
  const setOutputMuted = useCallback((on: boolean) => {
    if (controller.current?.setOutputMuted(on)) setCall((previous) => ({ ...previous, outputMuted: on }));
  }, []);
  const resumePlayback = useCallback(() => {
    void controller.current?.resumePlayback();
  }, []);

  return { ...call, audioRef, telemetry, start, stop, setMuted, setOutputMuted, resumePlayback };
}

type LiveOptions = {
  url: string;
  audio: HTMLAudioElement;
  telemetry: VoiceTelemetry;
  onEvent: (event: LiveEvent) => void;
};

function createLiveVoice(options: LiveOptions) {
  let state: "idle" | "starting" | "active" | "stopping" | "closed" = "idle";
  let socket: WebSocket | undefined;
  let peer: RTCPeerConnection | undefined;
  let channel: RTCDataChannel | undefined;
  let microphone: MediaStream | undefined;
  let playback: MediaStream | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancelGathering: (() => void) | undefined;
  let lastAck = 0;
  let lastHeartbeat = 0;
  let answerReceived = false;
  let finalized = false;
  let muted = false;
  let outputMuted = false;
  let endReason: "idle" | "budget" | undefined;
  const tel = options.telemetry;
  let ctx: AudioContext | undefined;
  let workletReady: Promise<void> | undefined;
  let player: AudioWorkletNode | undefined;
  let lastOutAt = 0;
  let bargeAt = 0;
  let userTranscriptSinceBarge = false;
  let userEndAt: number | null = null;

  // WebKit (all iPhone/iPad browsers, desktop Safari) crackles when WebRTC audio is re-routed
  // through Web Audio while the mic is open; play natively via the WebRTC jitter buffer there.
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const nativePlayback = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1) || (/Safari/.test(ua) && !/Chrome|Chromium|Android|CriOS|Edg/.test(ua));

  function setDuck(on: boolean) {
    tel.ducked = on;
    player?.port.postMessage({ type: "duck", on });
  }

  // Instant barge-in: flush the ring buffer and drop the rest of the interrupted turn.
  function onVadOnset(detectMs: number) {
    tel.onsetDetectMs = detectMs;
    tel.turnId += 1;
    tel.lastActivity = Date.now();
    userEndAt = null;
    if (state !== "active" || !player || tel.ducked) return;
    if (performance.now() - lastOutAt > 250) return;
    const t0 = performance.now();
    player.port.postMessage({ type: "flush" });
    setDuck(true);
    tel.lastBargeCutMs = +(detectMs + (performance.now() - t0)).toFixed(1);
    tel.bargeIns += 1;
    bargeAt = performance.now();
    userTranscriptSinceBarge = false;
    options.onEvent({ type: "app.barge_in", turnId: tel.turnId, playedMs: tel.playedMs });
  }

  function onPlayerLevel(d: { rms: number; inRms: number; fillMs: number; underruns: number; playedMs: number }) {
    const now = performance.now();
    tel.outRms = d.rms;
    tel.bufferMs = d.fillMs;
    tel.underruns = d.underruns;
    tel.playedMs = d.playedMs;
    if (d.inRms > 0.008) lastOutAt = now;
    tel.assistantSpeaking = now - lastOutAt < 250;
    if (d.rms > 0.01) {
      tel.lastActivity = Date.now();
      if (userEndAt !== null) { tel.ttfaMs = Math.round(now - userEndAt); userEndAt = null; }
    }
    if (tel.ducked) {
      const sinceBarge = now - bargeAt;
      const serverStopped = userTranscriptSinceBarge && now - lastOutAt > 200;
      const falseAlarm = !userTranscriptSinceBarge && tel.vad === "silence" && sinceBarge > 900;
      if ((serverStopped && sinceBarge > 300) || falseAlarm || sinceBarge > 8000) setDuck(false);
    }
  }

  async function setupMic(stream: MediaStream) {
    if (!ctx || !workletReady) return;
    try {
      await workletReady;
      const src = ctx.createMediaStreamSource(stream);
      const vad = new AudioWorkletNode(ctx, "vad-processor");
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      src.connect(vad);
      tel.micAnalyser = an;
      vad.port.onmessage = ({ data }) => {
        if (data.type === "onset") { tel.vad = "speech"; onVadOnset(data.detectMs); }
        else if (data.type === "offset") { tel.vad = "silence"; userEndAt = performance.now(); }
        else if (data.type === "level") {
          tel.micRms = data.rms; tel.zcr = data.zcr; tel.silenceMs = Math.round(data.silentMs);
          if (data.speaking) tel.lastActivity = Date.now();
        }
      };
    } catch {
      tel.micAnalyser = null;
    }
  }

  async function setupPlayback(stream: MediaStream) {
    if (!ctx || !workletReady) return false;
    try {
      await workletReady;
      if (state === "stopping" || state === "closed") return false;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      if (nativePlayback) {
        // Analyser only (visualizer/telemetry); the <audio> element does the playing.
        src.connect(an);
        tel.outAnalyser = an;
        void ctx.resume();
        return false;
      }
      const node = new AudioWorkletNode(ctx, "ring-player", { outputChannelCount: [1] });
      src.connect(node).connect(an).connect(ctx.destination);
      node.port.onmessage = ({ data }) => { if (data.type === "level") onPlayerLevel(data); };
      node.port.postMessage({ type: "mute", on: outputMuted });
      player = node;
      tel.outAnalyser = an;
      tel.worklet = true;
      void ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  function starting() {
    return state === "starting";
  }

  function send(event: object) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  }

  function stopAudio() {
    microphone?.getTracks().forEach((track) => track.stop());
    if (playback && options.audio.srcObject === playback) {
      options.audio.pause();
      options.audio.srcObject = null;
    }
    player?.port.postMessage({ type: "flush" });
    player = undefined;
    void ctx?.close().catch(() => {});
    ctx = undefined;
  }

  function release() {
    if (state === "closed") return;
    state = "closed";
    clearInterval(heartbeat);
    clearTimeout(deadline);
    cancelGathering?.();
    window.removeEventListener("pagehide", stop);
    stopAudio();
    channel?.close();
    peer?.close();
    socket?.close();
    options.onEvent({ type: "app.closed", finalized, ...(endReason ? { reason: endReason } : {}) });
  }

  function stop() {
    if (state === "stopping" || state === "closed") return;
    state = "stopping";
    try {
      send({ type: "session.close" });
    } catch {
      return release();
    }
    stopAudio();
    cancelGathering?.();
    clearInterval(heartbeat);
    clearTimeout(deadline);
    deadline = setTimeout(release, 15_000);
    options.onEvent({ type: "app.stopping" });
    if (!socket || socket.readyState !== WebSocket.OPEN) release();
  }

  function setMuted(value: boolean) {
    if (state !== "starting" && state !== "active") return false;
    muted = value;
    microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    return true;
  }

  function setOutputMuted(value: boolean) {
    if (state !== "starting" && state !== "active") return false;
    outputMuted = value;
    if (player) player.port.postMessage({ type: "mute", on: value });
    else options.audio.muted = value;
    return true;
  }

  async function resumePlayback() {
    if ((state !== "starting" && state !== "active") || !options.audio.srcObject) return;
    try {
      await options.audio.play();
      await ctx?.resume();
      if (state === "starting" || state === "active") options.onEvent({ type: "app.playback.resumed" });
    } catch {
      if (state === "starting" || state === "active") options.onEvent({ type: "app.playback.blocked" });
    }
  }

  function fail(message: string) {
    if (state === "stopping" || state === "closed") return;
    options.onEvent({ type: "app.error", error: { message } });
    stop();
  }

  function reportUnexpectedClosure(reason?: string) {
    if (state === "stopping" || state === "closed") return;
    const messages: Record<string, string> = {
      startup_timeout: "Voice startup timed out. Start a new call to retry.",
      initial_heartbeat_timeout: "Voice media did not connect. Start a new call to retry.",
      heartbeat_timeout: "Voice connection was lost. Start a new call to retry.",
      gateway_shutdown: "The voice service restarted. Start a new call to reconnect.",
      inactivity_timeout: "The voice call ended after inactivity.",
      duration_limit: "The voice call reached its duration limit. Start a new call to continue.",
    };
    options.onEvent({
      type: "app.error",
      error: { message: messages[reason ?? ""] ?? "The voice call ended unexpectedly. Start a new call to retry." },
    });
  }

  function mediaReady() {
    return peer?.connectionState === "connected" && channel?.readyState === "open";
  }

  function pulse() {
    if (state !== "active") return;
    if (Date.now() - lastAck >= 5000) return fail("Voice control connection lost");
    if (Date.now() - lastHeartbeat >= 5000) return fail("Voice media connection lost");
    const nowMs = Date.now();
    if (tel.connectedAt && nowMs - tel.connectedAt >= tel.maxMs) { endReason = "budget"; return stop(); }
    if (nowMs - tel.lastActivity >= tel.idleMs) { endReason = "idle"; return stop(); }
    if (!mediaReady()) return;
    try {
      send({ type: "gateway.heartbeat" });
      lastHeartbeat = Date.now();
    } catch {
      fail("Voice control connection failed");
    }
  }

  function activate() {
    if (!answerReceived || !mediaReady()) return;
    if (starting()) {
      state = "active";
      clearTimeout(deadline);
      lastAck = Date.now();
      lastHeartbeat = Date.now();
      tel.connectedAt = Date.now();
      tel.lastActivity = Date.now();
      heartbeat = setInterval(pulse, 1000);
      pulse();
      if (state !== "active") return;
      send({ type: "app.ready" });
      options.onEvent({ type: "app.connected" });
    } else pulse();
  }

  async function applyAnswer(event: LiveEvent) {
    if (!starting() || !peer) return;
    if (answerReceived || event.transport?.type !== "webrtc" || !event.transport.sdp) {
      throw new Error("Invalid voice session answer");
    }
    answerReceived = true;
    clearTimeout(deadline);
    deadline = setTimeout(
      () => fail("Voice media did not connect within 12 seconds. Start a new call to retry."),
      12_000,
    );
    await peer.setRemoteDescription({ type: "answer", sdp: event.transport.sdp });
    activate();
  }

  async function gatherCandidates(connection: RTCPeerConnection) {
    if (connection.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error("Voice network setup timed out")), 10_000);
      function finish(error?: Error) {
        clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", changed);
        cancelGathering = undefined;
        if (error) reject(error);
        else resolve();
      }
      function changed() {
        if (connection.iceGatheringState === "complete") finish();
      }
      cancelGathering = () => finish(new Error("Call ended"));
      connection.addEventListener("icegatheringstatechange", changed);
      changed();
    });
  }

  async function start() {
    if (state !== "idle") return;
    state = "starting";
    window.addEventListener("pagehide", stop);
    try {
      // Created inside the user's click so playback is allowed.
      ctx = new AudioContext({ latencyHint: "interactive" });
      workletReady = ctx.audioWorklet.addModule("/voice-worklets.js");
      workletReady.catch(() => {});
    } catch {
      ctx = undefined;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      microphone = stream;
      if (!starting()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      void setupMic(stream);
      const connection = new RTCPeerConnection();
      peer = connection;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !muted;
        track.addEventListener("ended", stop);
        connection.addTrack(track, stream);
      }
      connection.addEventListener("track", ({ track }) => {
        if (state === "stopping" || state === "closed") return;
        playback = new MediaStream([track]);
        options.audio.srcObject = playback;
        // Chrome only feeds remote WebRTC audio into Web Audio when an element holds the stream;
        // keep it muted and play through the AudioWorklet ring buffer instead.
        options.audio.muted = nativePlayback ? outputMuted : true;
        void setupPlayback(playback).then((ok) => {
          if (!ok) options.audio.muted = outputMuted;
          void resumePlayback();
        });
      });
      connection.addEventListener("connectionstatechange", () => {
        if (connection.connectionState === "failed") fail("Voice media connection failed. Start a new call to retry.");
        else if (connection.connectionState === "closed") fail("Voice media connection closed");
        else activate();
      });
      channel = connection.createDataChannel("oai-events");
      channel.addEventListener("open", activate);
      channel.addEventListener("message", ({ data }) => {
        try {
          const event: LiveEvent = JSON.parse(data);
          if (event.type === "session.started") {
            activate();
          }
        } catch {
          fail("Invalid voice session event");
        }
      });
      channel.addEventListener("error", () => fail("Voice media connection failed"));
      channel.addEventListener("close", stop);
      await connection.setLocalDescription(await connection.createOffer());
      if (!starting()) return;
      await gatherCandidates(connection);
      if (!starting()) return;
      const sdp = connection.localDescription?.sdp;
      if (!sdp) throw new Error("Missing voice session offer");
      socket = new WebSocket(options.url);
      deadline = setTimeout(() => fail("Voice session did not start"), 50_000);
      socket.onopen = () => {
        if (!starting()) return release();
        send({ type: "app.start", sdp });
      };
      socket.onmessage = ({ data }) => {
        try {
          const event: LiveEvent = JSON.parse(data);
          if (event.type === "gateway.session.created") {
            void applyAnswer(event).catch(() => fail("Voice media negotiation failed"));
          } else if (event.type === "session.started") {
            activate();
          } else if (event.type === "session.input_transcript.delta") {
            userTranscriptSinceBarge = true;
            tel.lastActivity = Date.now();
          } else if (event.type === "gateway.heartbeat.ack") {
            lastAck = Date.now();
          } else if (event.type === "session.closed") {
            finalized =
              typeof event.usage?.seconds === "number" &&
              Number.isFinite(event.usage.seconds) &&
              event.usage.seconds >= 0;
            reportUnexpectedClosure(event.reason);
            options.onEvent(event);
            return release();
          } else if (
            event.type === "gateway.session.closing" ||
            event.type === "gateway.error" ||
            event.type === "app.error"
          ) {
            if (event.type === "gateway.session.closing") reportUnexpectedClosure(event.reason);
            options.onEvent(event);
            return stop();
          }
          options.onEvent(event);
        } catch {
          fail("Invalid voice event");
        }
      };
      socket.onerror = () => fail("Voice connection failed");
      socket.onclose = () => {
        if (state !== "stopping" && state !== "closed") {
          options.onEvent({ type: "app.error", error: { message: "Voice control connection closed" } });
        }
        release();
      };
    } catch (error) {
      fail(error instanceof Error ? error.message : "Microphone startup failed");
    }
  }

  return { start, stop, setMuted, setOutputMuted, resumePlayback };
}
