import { createFileRoute } from "@tanstack/react-router";
import { GatewayError } from "@lovable.dev/ai-gateway";
import { prepareForSpeech } from "@/lib/speech";
import { VOICE_PERSONAS, getPersona } from "@/config/voicePersonas";
import { LANGUAGES, detectLanguage, isLangCode } from "@/lib/language";

// Repeated clicks on the same answer shouldn't re-bill the speech model.
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 80;
const cache = new Map<string, { audio: ArrayBuffer; at: number }>();

function remember(key: string, audio: ArrayBuffer) {
  cache.set(key, { audio, at: Date.now() });
  for (const [k, v] of cache) {
    if (Date.now() - v.at > TTL_MS) cache.delete(k);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export const Route = createFileRoute("/api/speak")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          text?: unknown;
          voice?: unknown;
          lang?: unknown;
        } | null;
        const text = prepareForSpeech(typeof body?.text === "string" ? body.text : "");
        if (!text) return Response.json({ error: "Nothing to read aloud" }, { status: 400 });

        // Bind the persona's voice and the language so the synthesizer uses native pronunciation.
        const voiceName = VOICE_PERSONAS.some((p) => p.ttsVoice === body?.voice)
          ? (body!.voice as string)
          : getPersona(null).ttsVoice;
        const lang = isLangCode(body?.lang) ? body.lang : detectLanguage(text).code;
        const key = `${voiceName}|${lang}|${text}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) {
          return new Response(hit.audio, {
            headers: {
              "content-type": "audio/wav",
              "cache-control": "no-store",
              "x-voice": voiceName,
              "x-lang": lang,
            },
          });
        }

        try {
          const store = await import("@/server/tts.server");
          const stored = await store.loadStoredAudio(key);
          if (stored) {
            remember(key, stored);
            return new Response(stored, {
              headers: { "content-type": "audio/wav", "cache-control": "no-store", "x-voice": voiceName, "x-lang": lang, "x-tts-cache": "stored" },
            });
          }
          const { enforceRateLimit } = await import("@/server/rate-limit.server");
          const limited = await enforceRateLimit(request, [
            { scope: "speak:ip:minute", limit: 30, windowSeconds: 60 },
            { scope: "speak:ip:day", limit: 200, windowSeconds: 86_400 },
          ]);
          if (limited) return limited;
          const { audio, contentType } = await store.synthesize(text, voiceName, lang, request.signal);
          remember(key, audio);
          // Keep every synthesized clause so the next listener gets it instantly.
          const { defer } = await import("@/lib/background.server");
          await defer(request, store.storeAudio(key, audio));
          return new Response(audio, {
            headers: {
              "content-type": contentType || "audio/wav",
              "cache-control": "no-store",
              "x-voice": voiceName,
              "x-lang": lang,
            },
          });
        } catch (e) {
          if (request.signal.aborted || (e as Error)?.name === "AbortError")
            return new Response(null, { status: 499 });
          console.error(e);
          return Response.json(
            { error: e instanceof GatewayError ? e.message : "Could not generate audio" },
            { status: 502 },
          );
        }
      },
    },
  },
});
