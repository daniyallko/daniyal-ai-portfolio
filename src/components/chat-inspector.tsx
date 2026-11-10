import { useEffect, useRef } from "react";
import { Bug, FileText, X } from "lucide-react";
import { wrapTabFocus } from "@/lib/focus-trap";
import type { Msg } from "./chat-types";

export function InspectPanel({ m, tab, focus, setTab, onClose }: {
  m: Msg;
  tab: "sources" | "dev";
  focus?: number | undefined;
  setTab: (t: "sources" | "dev") => void;
  onClose: () => void;
}) {
  const focusRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [focus, tab]);
  const d = m.debug;
  const visibleTab = import.meta.env.DEV ? tab : "sources";
  const tabs = import.meta.env.DEV ? ["sources", "dev"] as const : ["sources"] as const;
  return (
    <aside
      ref={dialogRef}
      role="dialog"
      aria-label="Answer inspection"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
        if (event.key === "Tab" && window.matchMedia("(max-width: 1023px)").matches && dialogRef.current) {
          wrapTabFocus(event.nativeEvent, dialogRef.current);
          if (event.defaultPrevented) event.stopPropagation();
        }
      }}
      className="fixed inset-0 z-20 flex min-w-0 flex-col border-l border-hairline bg-sidebar lg:static lg:w-[420px] lg:shrink-0"
    >
      <div className="safe-top flex items-center gap-1 border-b border-hairline px-3 pb-3">
        <div role="tablist" aria-label="Inspection view" className="flex gap-1">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={visibleTab === t} onClick={() => setTab(t)} className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 font-mono text-[11px] transition-colors ${visibleTab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "sources" ? <FileText className="h-3.5 w-3.5" /> : <Bug className="h-3.5 w-3.5" />}{t === "sources" ? "sources" : "dev mode"}
            </button>
          ))}
        </div>
        <button ref={closeRef} type="button" aria-label="Close inspection" onClick={onClose} className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hairline text-muted-foreground transition-colors hover:border-primary hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="safe-bottom flex-1 space-y-3 overflow-y-auto px-4">
        {visibleTab === "sources" ? (
          m.sources?.length ? m.sources.map((s) => (
            <div key={s.n} data-source={s.n} data-focused={s.n === focus} ref={s.n === focus ? focusRef : undefined} className={`rounded-sm border p-4 transition-colors ${s.n === focus ? "border-primary bg-accent/30" : "border-hairline bg-card"}`}>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]"><span className="text-signal">[{s.n}]</span><span className="text-muted-foreground">{s.section}</span></div>
              <h2 className="mt-2 text-base font-semibold tracking-[-0.02em]">{s.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground" style={{ overflowWrap: "anywhere" }}>{s.text}</p>
              <p className="mt-4 font-mono text-[10px] text-muted-foreground" style={{ overflowWrap: "anywhere" }}>id: {s.id}</p>
            </div>
          )) : <p className="pt-8 text-center text-sm text-muted-foreground">No sources were retrieved.</p>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            <Kv k="model" v={d?.model ?? "—"} />
            <Kv k="retrieval query" v={d?.query ?? "—"} />
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(d?.timingsMs ?? {}).map(([k, v]) => <Kv key={k} k={`${k} ms`} v={String(v ?? "—")} />)}
            </div>
            {d?.usage != null && <Kv k="tokens" v={JSON.stringify(d.usage)} />}
            <div className="min-w-0">
              <p className="mb-2 leading-relaxed text-muted-foreground">hybrid ranking · BM25 + dense → RRF (k=60)</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px]">
                  <thead className="text-muted-foreground"><tr><th className="py-2 text-left">chunk</th><th>bm25</th><th>dense</th><th>rrf</th></tr></thead>
                  <tbody>
                    {d?.candidates?.map((c) => (
                      <tr key={c.id} className={c.kept ? "text-foreground" : "text-muted-foreground"}>
                        <td className="max-w-[150px] truncate py-2" title={c.title}>{c.kept ? "● " : "○ "}{c.id}</td>
                        <td className="text-center">{c.bm25}<span className="text-muted-foreground"> #{c.bm25Rank ?? "-"}</span></td>
                        <td className="text-center">{c.dense}<span className="text-muted-foreground"> #{c.denseRank ?? "-"}</span></td>
                        <td className="text-center text-signal">{c.rrf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 leading-relaxed text-muted-foreground">● passed relevance gate and sent to the model</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-sm border border-hairline bg-card p-3">
      <p className="text-muted-foreground">{k}</p>
      <p className="mt-1 text-foreground" style={{ overflowWrap: "anywhere" }}>{v}</p>
    </div>
  );
}
