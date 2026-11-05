import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminDeleteKbDoc, adminListKb, adminReindexKb, adminSaveKbDoc } from "@/lib/admin.functions";

type Draft = { id?: string; title: string; section: string; content: string; source_type: "text" | "pdf" };
const empty: Draft = { title: "", section: "Documents", content: "", source_type: "text" };

export function AdminKb() {
  const qc = useQueryClient();
  const kb = useQuery({ queryKey: ["admin-kb"], queryFn: () => adminListKb() });
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const run = async (label: string, fn: () => Promise<{ chunks: number; ms: number }>) => {
    setBusy(label); setStatus("");
    try {
      const r = await fn();
      setStatus(`${label} ok — corpus ${r.chunks} chunks, embedded + cache warmed in ${r.ms}ms`);
      await qc.invalidateQueries({ queryKey: ["admin-kb"] });
      return true;
    } catch (e) { setStatus(`${label} failed: ${(e as Error).message}`); return false; }
    finally { setBusy(null); }
  };

  const onPdf = async (file: File) => {
    setBusy("Reading PDF"); setStatus("");
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: false });
      const content = (Array.isArray(text) ? text : [text]).join("\n\n").trim();
      if (!content) throw new Error("No selectable text found (scanned PDF?)");
      setDraft({ ...draft, title: draft.title || file.name.replace(/\.pdf$/i, ""), content, source_type: "pdf" });
      setStatus(`Extracted ${content.length.toLocaleString()} characters — review, then save.`);
    } catch (e) { setStatus(`PDF failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  };

  const save = async () => {
    if (await run(draft.id ? "Update" : "Add", () => adminSaveKbDoc({ data: draft }))) setDraft(empty);
  };

  const docs = kb.data?.docs ?? [];
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_420px]">
      <div className="overflow-y-auto border-r border-border p-4">
        <div className="mb-3 flex items-center justify-between font-mono text-xs">
          <span className="text-muted-foreground">added sources — {docs.length}</span>
          <button disabled={!!busy} onClick={() => run("Reindex", () => adminReindexKb())} className="border border-border px-2 py-1 hover:border-primary disabled:opacity-50">reindex + warm cache</button>
        </div>
        {docs.map((d) => (
          <div key={d.id} className="mb-2 border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm">{d.title}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{d.section} · {d.source_type} · {d.chunks} chunks · {d.content.length.toLocaleString()} chars</div>
              </div>
              <div className="flex shrink-0 gap-2 font-mono text-[11px]">
                <button onClick={() => setDraft({ id: d.id, title: d.title, section: d.section, content: d.content, source_type: d.source_type === "pdf" ? "pdf" : "text" })} className="text-muted-foreground hover:text-foreground">edit</button>
                <button disabled={!!busy} onClick={() => confirm(`Delete "${d.title}"?`) && run("Delete", () => adminDeleteKbDoc({ data: { id: d.id } }))} className="text-destructive">delete</button>
              </div>
            </div>
          </div>
        ))}
        {!docs.length && !kb.isLoading && <p className="text-xs text-muted-foreground">No added sources yet.</p>}
        <details className="mt-6">
          <summary className="cursor-pointer font-mono text-xs text-muted-foreground">built-in portfolio chunks ({kb.data?.base.length ?? 0}) — edited in code</summary>
          {(kb.data?.base ?? []).map((c) => (
            <div key={c.id} className="mt-2 border border-border p-2 text-xs"><span className="font-mono text-primary">{c.section}</span> · {c.title}<p className="mt-1 text-muted-foreground">{c.text}</p></div>
          ))}
        </details>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto p-4 font-mono text-xs">
        <span className="text-muted-foreground">{draft.id ? "edit source" : "new source"}</span>
        <label className="cursor-pointer border border-dashed border-border p-3 text-center hover:border-primary">
          upload PDF
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); e.target.value = ""; }} />
        </label>
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="title" className="border border-border bg-background px-2 py-1.5" />
        <input value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} placeholder="section (e.g. Projects, Certifications)" className="border border-border bg-background px-2 py-1.5" />
        <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="paste text, or upload a PDF above" className="min-h-[320px] flex-1 border border-border bg-background p-2 font-sans text-sm" />
        <div className="flex gap-2">
          <button disabled={!!busy || !draft.title.trim() || draft.content.trim().length < 20} onClick={save} className="flex-1 bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{busy ?? (draft.id ? "update + reindex" : "add + reindex")}</button>
          {(draft.id || draft.content) && <button onClick={() => setDraft(empty)} className="border border-border px-3">cancel</button>}
        </div>
        {status && <p className={status.includes("failed") ? "text-destructive" : "text-primary"}>{status}</p>}
      </div>
    </div>
  );
}
