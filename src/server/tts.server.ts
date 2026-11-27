import { generateSpeech } from "@lovable.dev/ai-gateway";
import { prepareForSpeech, readAloudSplit, SPEAK_MODEL } from "@/lib/speech";
import { getPersona } from "@/config/voicePersonas";
import { LANGUAGES, detectLanguage, type LangCode } from "@/lib/language";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "tts-cache";

async function pathFor(key: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${SPEAK_MODEL}|${key}`));
  return `${[...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("")}.wav`;
}

/** Persistent audio store: survives restarts so pre-recorded answers play instantly. */
export async function loadStoredAudio(key: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(await pathFor(key));
  if (error || !data) return null;
  return data.arrayBuffer();
}

export async function storeAudio(key: string, audio: ArrayBuffer): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(await pathFor(key), audio, { contentType: "audio/wav", upsert: true });
  if (error) console.error("TTS store failed", error.message);
}

export async function synthesize(text: string, voiceName: string, lang: LangCode, signal?: AbortSignal) {
  const res = await generateSpeech(
    {
      model: SPEAK_MODEL,
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          languageCode: LANGUAGES[lang].bcp47,
        },
      },
    },
    signal ? { signal } : {},
  );
  return { audio: await res.blob().then((b) => b.arrayBuffer()), contentType: res.contentType };
}

/** Pre-records read-aloud audio (default voice) for answer texts, exactly as the Listen button splits them. */
export async function prerenderAnswers(answers: string[]): Promise<{ recorded: number; existing: number; failed: number }> {
  const voice = getPersona(null).ttsVoice;
  const report = { recorded: 0, existing: 0, failed: 0 };
  for (const answer of answers) {
    const { first, rest } = readAloudSplit(prepareForSpeech(answer));
    for (const raw of [first, rest]) {
      const part = prepareForSpeech(raw);
      if (!part) continue;
      const lang = detectLanguage(part).code;
      const key = `${voice}|${lang}|${part}`;
      try {
        if (await loadStoredAudio(key)) {
          report.existing++;
          continue;
        }
        const { audio } = await synthesize(part, voice, lang);
        await storeAudio(key, audio);
        report.recorded++;
      } catch (e) {
        console.error("TTS prerender failed", e);
        report.failed++;
      }
    }
  }
  return report;
}
