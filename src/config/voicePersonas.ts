// Central registry of selectable AI voices. Browser-safe; the server validates ids against it.
// `liveVoice` is used for real-time calls, `ttsVoice` for read-aloud and previews.
// Both underlying models are multilingual and pick native pronunciation per language.

export type VoicePersona = {
  id: string;
  name: string;
  tagline: string;
  gender: "male" | "female";
  badge: string;
  liveVoice: "cedar" | "marin" | "ash" | "coral";
  ttsVoice: "Charon" | "Kore" | "Orus" | "Leda";
  rate: number;
  liveModel: "openai/gpt-live-1";
  ttsModel: "google/gemini-3.1-flash-tts-preview";
};

const base = {
  liveModel: "openai/gpt-live-1",
  ttsModel: "google/gemini-3.1-flash-tts-preview",
} as const;

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    ...base,
    id: "architect",
    name: "Technical Architect",
    tagline: "Measured, precise",
    gender: "male",
    badge: "TA",
    liveVoice: "cedar",
    ttsVoice: "Charon",
    rate: 1.0,
  },
  {
    ...base,
    id: "lead",
    name: "Engineering Lead",
    tagline: "Clear, confident",
    gender: "female",
    badge: "EL",
    liveVoice: "marin",
    ttsVoice: "Kore",
    rate: 1.0,
  },
  {
    ...base,
    id: "executive",
    name: "Executive Brief",
    tagline: "Crisp, to the point",
    gender: "male",
    badge: "EB",
    liveVoice: "ash",
    ttsVoice: "Orus",
    rate: 1.1,
  },
  {
    ...base,
    id: "peer",
    name: "Conversational Peer",
    tagline: "Relaxed, friendly",
    gender: "female",
    badge: "CP",
    liveVoice: "coral",
    ttsVoice: "Leda",
    rate: 0.95,
  },
];

export const DEFAULT_PERSONA_ID = "lead";

export function getPersona(id: string | null | undefined): VoicePersona {
  return (
    VOICE_PERSONAS.find((p) => p.id === id) ??
    VOICE_PERSONAS.find((p) => p.id === DEFAULT_PERSONA_ID)!
  );
}
