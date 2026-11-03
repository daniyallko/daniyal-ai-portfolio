import { createFileRoute } from "@tanstack/react-router";
import { transcribeAudio, GatewayError } from "@lovable.dev/ai-gateway";

const MAX_BYTES = 10 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "No audio received" }, { status: 400 });
        if (file.size > MAX_BYTES) return Response.json({ error: "Recording is too long" }, { status: 413 });
        try {
          const named = file instanceof File ? file : new File([file], "audio.webm", { type: file.type || "audio/webm" });
          const res = await transcribeAudio({ model: "openai/gpt-transcribe", file: named, language: "en" });
          const text = (res as unknown as { text?: string }).text?.trim() ?? "";
          return Response.json({ text });
        } catch (e) {
          console.error(e);
          return Response.json({ error: e instanceof GatewayError ? e.message : "Transcription failed" }, { status: 502 });
        }
      },
    },
  },
});
