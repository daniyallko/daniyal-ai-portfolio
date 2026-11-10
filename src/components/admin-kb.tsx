import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, FileText, FileUp, LoaderCircle, Pencil, RefreshCw, Trash2, XCircle } from "lucide-react";
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
  const failed = status.toLowerCase().includes("failed");
  const saveLabel = busy === "Add" ? "Adding…" : busy === "Update" ? "Updating…" : draft.id ? "Update + reindex" : "Add + reindex";

  return (
    <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_480px]">
      <section className="min-h-0 border-b border-hairline xl:overflow-y-auto xl:border-b-0 xl:border-r" aria-label="Knowledge base sources">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-4 sm:px-6">
          <div><h2 className="font-serif text-2xl">Added sources <span className="font-sans text-sm text-muted-foreground">/ {docs.length}</span></h2><p className="mt-1 text-xs text-muted-foreground">Owner-added evidence joins the next retrieval corpus.</p></div>
          <button type="button" disabled={!!busy} onClick={() => run("Reindex", () => adminReindexKb())} className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-hairline px-3 font-mono text-[11px] transition-colors hover:border-signal/60 hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${busy === "Reindex" ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />{busy === "Reindex" ? "Reindexing…" : "Reindex + warm cache"}
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {kb.isLoading ? <p role="status" className="flex min-h-32 items-center justify-center gap-2 font-mono text-xs text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin text-signal motion-reduce:animate-none" aria-hidden="true" />Loading knowledge base…</p> : kb.isError ? <p role="alert" className="border-l-2 border-destructive bg-destructive/10 p-4 text-sm text-destructive">{(kb.error as Error).message}</p> : (
            <>
              {docs.map((d) => (
                <article key={d.id} className="mb-3 border border-hairline bg-card p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-base font-medium leading-6" style={{ overflowWrap: "anywhere" }}>{d.title}</h3>
                      <p className="mt-1 font-mono text-[10px] leading-5 text-muted-foreground" style={{ overflowWrap: "anywhere" }}>{d.section} · {d.source_type} · {d.chunks} chunks · {d.content.length.toLocaleString()} chars</p>
                    </div>
                    <div className="flex shrink-0 gap-2 font-mono text-[11px]">
                      <button type="button" aria-label={`Edit "${d.title}"`} onClick={() => setDraft({ id: d.id, title: d.title, section: d.section, content: d.content, source_type: d.source_type === "pdf" ? "pdf" : "text" })} className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-hairline px-3 text-muted-foreground transition-colors hover:border-signal/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>
                      <button type="button" aria-label={`Delete "${d.title}"`} disabled={!!busy} onClick={() => confirm(`Delete "${d.title}"?`) && run("Delete", () => adminDeleteKbDoc({ data: { id: d.id } }))} className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-destructive/30 px-3 text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete</button>
                    </div>
                  </div>
                </article>
              ))}
              {!docs.length && <div className="border border-dashed border-hairline px-5 py-10 text-center"><FileText className="mx-auto h-6 w-6 text-signal" aria-hidden="true" /><h3 className="mt-3 font-serif text-2xl">No added sources yet</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Upload a PDF or paste a reviewed source in the editor. Saving embeds it into the recruiter knowledge base.</p></div>}
              <details className="group mt-6 border border-hairline bg-card">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><span>Built-in portfolio chunks ({kb.data?.base.length ?? 0}) <span className="text-muted-foreground">— edited in code</span></span><span aria-hidden="true" className="text-signal transition-transform group-open:rotate-45">+</span></summary>
                <div className="border-t border-hairline p-3">
                  {(kb.data?.base ?? []).map((c) => (
                    <article key={c.id} className="mb-2 border border-hairline bg-background p-3 text-xs last:mb-0"><p className="font-mono text-[10px] leading-5"><span className="text-signal">{c.section}</span> <span className="text-muted-foreground">·</span> {c.title}</p><p className="mt-2 whitespace-pre-wrap leading-6 text-muted-foreground" style={{ overflowWrap: "anywhere" }}>{c.text}</p></article>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-5 bg-card/40 p-4 sm:p-6 xl:overflow-y-auto" aria-label={draft.id ? "Edit knowledge base source" : "Add knowledge base source"} aria-busy={!!busy}>
        <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">{draft.id ? "Edit source" : "New source"}</p><h2 className="mt-2 font-serif text-3xl">{draft.id ? "Refine the evidence." : "Add to the signal."}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Review extracted text before saving. Every write re-embeds the corpus and warms its cache.</p></div>

        <div>
          <label htmlFor="kb-pdf" className={`flex min-h-24 items-center justify-center gap-3 border border-dashed border-hairline bg-background px-4 py-4 text-center transition-colors focus-within:border-ring ${busy ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-signal/70"}`}>
            <FileUp className="h-5 w-5 shrink-0 text-signal" aria-hidden="true" /><span><span className="block text-sm font-medium">{busy === "Reading PDF" ? "Reading PDF…" : "Upload PDF"}</span><span className="mt-1 block text-xs text-muted-foreground">Text is extracted locally for your review.</span></span>
          </label>
          <input id="kb-pdf" aria-label="Upload PDF" type="file" accept="application/pdf" disabled={!!busy} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); e.target.value = ""; }} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div><label htmlFor="kb-title" className="mb-2 block font-mono text-[11px] text-muted-foreground">Source title</label><input id="kb-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. AWS certification" disabled={!!busy} className="min-h-12 w-full border border-hairline bg-background px-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" /></div>
          <div><label htmlFor="kb-section" className="mb-2 block font-mono text-[11px] text-muted-foreground">Section</label><input id="kb-section" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} placeholder="Projects, Certifications…" disabled={!!busy} className="min-h-12 w-full border border-hairline bg-background px-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" /></div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col"><div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="kb-content" className="font-mono text-[11px] text-muted-foreground">Source content</label><span className="font-mono text-[10px] text-muted-foreground">{draft.content.length.toLocaleString()} chars</span></div><textarea id="kb-content" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Paste text, or upload a PDF above" disabled={!!busy} className="min-h-[280px] w-full flex-1 resize-y border border-hairline bg-background p-3 font-sans text-base leading-7 outline-none transition-colors placeholder:text-muted-foreground focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm xl:min-h-[320px]" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Minimum 20 characters. Blank lines are preserved.</p></div>

        <div className="flex flex-col-reverse gap-2 min-[400px]:flex-row">
          <button type="button" disabled={!!busy || !draft.title.trim() || draft.content.trim().length < 20} onClick={save} className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-signal hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45">{(busy === "Add" || busy === "Update") && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{saveLabel}</button>
          {(draft.id || draft.content) && <button type="button" disabled={!!busy} onClick={() => setDraft(empty)} className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-hairline px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"><XCircle className="h-4 w-4" aria-hidden="true" />Cancel</button>}
        </div>

        {busy && <p role="status" className="sr-only">{busy} in progress</p>}
        {status && <p role={failed ? "alert" : "status"} className={`flex items-start gap-2 border-l-2 p-3 text-sm leading-6 ${failed ? "border-destructive bg-destructive/10 text-destructive" : "border-signal bg-accent/30 text-foreground"}`} style={{ overflowWrap: "anywhere" }}>{failed ? <XCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-signal" aria-hidden="true" />}<span>{status}</span></p>}
      </section>
    </div>
  );
}
