import { useState } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AdminResume() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.type !== "application/pdf") return setStatus("Please choose a PDF file.");
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.storage
      .from("resume")
      .upload("resume.pdf", file, { upsert: true, contentType: "application/pdf" });
    setBusy(false);
    setStatus(error ? `Upload failed: ${error.message}` : "Resume uploaded. Visitors can download it now.");
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Resume</h2>
      <p className="text-sm text-muted-foreground">
        Upload a PDF. It replaces the current resume used by the top bar button and the assistant.
      </p>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-hairline px-4 font-mono text-xs transition-colors hover:border-primary hover:text-signal">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {busy ? "Uploading…" : "Choose PDF"}
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </label>
      <a href="/api/public/resume" className="ml-3 text-sm text-signal underline underline-offset-4">
        Download current
      </a>
      {status && <p role="status" className="text-sm">{status}</p>}
    </div>
  );
}
