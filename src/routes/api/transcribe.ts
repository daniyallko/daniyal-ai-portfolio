import { createFileRoute } from "@tanstack/react-router";
import { transcribeAudio, GatewayError } from "@lovable.dev/ai-gateway";

const MAX_BYTES = 10 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof Blob) || file.size === 0)
          return Response.json({ error: "No audio received" }, { status: 400 });
        if (file.size > MAX_BYTES)
          return Response.json({ error: "Recording is too long" }, { status: 413 });
        try {
          const { enforceRateLimit } = await import("@/server/rate-limit.server");
          const limited = await enforceRateLimit(request, [
            { scope: "transcribe:ip:minute", limit: 10, windowSeconds: 60 },
            { scope: "transcribe:ip:day", limit: 40, windowSeconds: 86_400 },
          ]);
          if (limited) return limited;
          const named = file;
          const res = await transcribeAudio({ model: "openai/gpt-transcribe", file: named });
          const out = res as unknown as { text?: string; language?: string };
          return Response.json({ text: out.text?.trim() ?? "", language: out.language ?? null });
        } catch (e) {
          console.error(e);
          return Response.json(
            { error: e instanceof GatewayError ? e.message : "Transcription failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
