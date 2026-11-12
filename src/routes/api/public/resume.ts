import { createFileRoute } from "@tanstack/react-router";

// Public download of the owner's resume (single fixed file uploaded from /admin).
export const Route = createFileRoute("/api/public/resume")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("resume").download("resume.pdf");
        if (error || !data) return new Response("Resume not available yet", { status: 404 });
        return new Response(data, {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="Mohd-Daniyal-Resume.pdf"',
            "cache-control": "no-cache",
          },
        });
      },
    },
  },
});
