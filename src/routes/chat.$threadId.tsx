import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Bug, FileText, Square, Terminal, X, ArrowLeft } from "lucide-react";
import { getThread } from "@/lib/chat.functions";
import { getVisitorId } from "@/lib/visitor";

export const Route = createFileRoute("/chat/$threadId")({
  ssr: false,
  component: ThreadPage,
});

type Source = { n: number; id: string; section: string; title: string; text: string };
type Debug = {
  query?: string;
  model?: string;
  timingsMs?: Record<string, number | null>;
  usage?: unknown;
  candidates?: { id: string; title: string; bm25: number; dense: number; bm25Rank: number | null; denseRank: number | null; rrf: number; kept: boolean }[];
};
type Msg = { id: string; role: "user" | "assistant"; content: string; sources?: Source[] | undefined; debug?: Debug | undefined; error?: string | undefined };

const SUGGESTIONS = [
  "What RAG systems has Daniyal built in production?",
  "Is he open to relocating to the UAE?",
  "Summarize his experience with LangGraph and agents.",
  "What's his biggest infrastructure achievement?",
];

function ThreadPage() {
  const { threadId } = Route.useParams();
  return <ThreadView key={threadId} threadId={threadId} />;
}

function ThreadView({ threadId }: { threadId: string }) {
  const visitorId = getVisitorId();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState<"loading" | "ok" | "missing">("loading");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming">("idle");
  const [panel, setPanel] = useState<{ msgId: string; tab: "sources" | "dev"; focus?: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getThread({ data: { visitorId, threadId } }).then((t) => {
      if (!t) return setLoaded("missing");
      setMessages(t.messages.map((m) => ({ id: m.id, role: m.role as Msg["role"], content: m.content, sources: m.sources ? (JSON.parse(m.sources) as Source[]) : undefined, debug: m.debug ? (JSON.parse(m.debug) as Debug) : undefined })));
      setLoaded("ok");
    });
  }, [threadId, visitorId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);
  useEffect(() => { if (status === "idle") taRef.current?.focus(); }, [status, loaded]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || status !== "idle") return;
    setInput("");
    const aid = crypto.randomUUID();
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: message }]);
    setStatus("submitted");
    const ac = new AbortController();
    abortRef.current = ac;
    const patch = (fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m) => (m.id === aid ? fn(m) : m)));
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId, visitorId, message }), signal: ac.signal });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      setMessages((m) => [...m, { id: aid, role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "sources") patch((m) => ({ ...m, sources: ev.sources, debug: ev.debug }));
          else if (ev.type === "delta") { setStatus("streaming"); patch((m) => ({ ...m, content: m.content + ev.text })); }
          else if (ev.type === "done") patch((m) => ({ ...m, debug: ev.debug }));
          else if (ev.type === "error") patch((m) => ({ ...m, error: ev.message }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((m) => (m.some((x) => x.id === aid) ? m.map((x) => (x.id === aid ? { ...x, error: (e as Error).message } : x)) : [...m, { id: aid, role: "assistant", content: "", error: (e as Error).message }]));
      }
    } finally {
      setStatus("idle");
      abortRef.current = null;
      qc.invalidateQueries({ queryKey: ["threads"] });
    }
  };

  if (loaded === "missing")
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>This chat doesn't exist.</p>
        <Link to="/chat" className="text-primary">Start a new one</Link>
      </div>
    );

  const active = panel ? messages.find((m) => m.id === panel.msgId) : undefined;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-6 py-3">
          <Link to="/" className="md:hidden text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent"><Terminal className="h-4 w-4 text-primary" /></div>
          <div>
            <p className="text-sm font-semibold">daniyal.ai</p>
            <p className="font-mono text-xs text-muted-foreground">hybrid RAG · answers cite sources</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
            {loaded === "ok" && messages.length === 0 && (
              <div className="pt-10">
                <h1 className="text-3xl font-semibold">Ask me about Daniyal.</h1>
                <p className="mt-2 text-muted-foreground">I answer from his portfolio only, and every claim links to its source.</p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-lg border border-border bg-card p-3 text-left text-sm hover:border-primary/50">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">{m.content}</div>
                </div>
              ) : (
                <AssistantMessage key={m.id} m={m} onCite={(n) => setPanel({ msgId: m.id, tab: "sources", focus: n })} onDev={() => setPanel({ msgId: m.id, tab: "dev" })} />
              ),
            )}
            {status === "submitted" && (
              <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                <span className="inline-block h-3 w-1.5 animate-pulse bg-primary" /> retrieving sources…
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto w-full max-w-3xl px-6 pb-6">
          <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-2 focus-within:border-primary/60">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder="Ask about experience, projects, stack…"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            {status === "idle" ? (
              <button type="submit" aria-label="Send" disabled={!input.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
            ) : (
              <button type="button" aria-label="Stop" onClick={() => abortRef.current?.abort()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"><Square className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </form>
      </div>

      {panel && active && <InspectPanel m={active} tab={panel.tab} focus={panel.focus} setTab={(tab) => setPanel({ ...panel, tab })} onClose={() => setPanel(null)} />}
    </div>
  );
}

function AssistantMessage({ m, onCite, onDev }: { m: Msg; onCite: (n: number) => void; onDev: () => void }) {
  const md = m.content.replace(/\[(\d+)\](?!\()/g, "[$1](#cite-$1)");
  return (
    <div className="space-y-2">
      <div className="prose-chat text-[15px] leading-relaxed">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => {
              const n = href?.startsWith("#cite-") ? Number(href.slice(6)) : null;
              if (n == null) return <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">{children}</a>;
              const src = m.sources?.find((s) => s.n === n);
              return (
                <button type="button" onClick={() => onCite(n)} title={src?.title} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-accent px-1 align-text-top font-mono text-[11px] font-bold text-accent-foreground hover:bg-primary hover:text-primary-foreground">
                  {n}
                </button>
              );
            },
          }}
        >
          {md}
        </ReactMarkdown>
      </div>
      {m.error && <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{m.error}</p>}
      {(m.sources?.length || m.debug) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {m.sources?.map((s) => (
            <button key={s.n} onClick={() => onCite(s.n)} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground">
              <span className="text-primary">[{s.n}]</span> <span className="max-w-[180px] truncate">{s.title}</span>
            </button>
          ))}
          <button onClick={onDev} className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground hover:text-primary"><Bug className="h-3.5 w-3.5" />inspect</button>
        </div>
      )}
    </div>
  );
}

function InspectPanel({ m, tab, focus, setTab, onClose }: { m: Msg; tab: "sources" | "dev"; focus?: number | undefined; setTab: (t: "sources" | "dev") => void; onClose: () => void }) {
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => { focusRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [focus, tab]);
  const d = m.debug;
  return (
    <aside className="fixed inset-0 z-20 flex flex-col border-l border-border bg-sidebar lg:static lg:w-[420px]">
      <div className="flex items-center gap-1 border-b border-border p-2">
        {(["sources", "dev"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs ${tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "sources" ? <FileText className="h-3.5 w-3.5" /> : <Bug className="h-3.5 w-3.5" />}{t === "sources" ? "sources" : "dev mode"}
          </button>
        ))}
        <button aria-label="Close" onClick={onClose} className="ml-auto rounded p-1.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {tab === "sources" ? (
          m.sources?.length ? m.sources.map((s) => (
            <div key={s.n} ref={s.n === focus ? focusRef : undefined} className={`rounded-lg border p-3 ${s.n === focus ? "border-primary" : "border-border"} bg-card`}>
              <div className="flex items-center gap-2 font-mono text-xs"><span className="text-primary">[{s.n}]</span><span className="text-muted-foreground">{s.section}</span></div>
              <p className="mt-1 text-sm font-semibold">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">id: {s.id}</p>
            </div>
          )) : <p className="text-sm text-muted-foreground">No sources were retrieved.</p>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            <Kv k="model" v={d?.model ?? "—"} />
            <Kv k="retrieval query" v={d?.query ?? "—"} />
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(d?.timingsMs ?? {}).map(([k, v]) => <Kv key={k} k={`${k} ms`} v={String(v ?? "—")} />)}
            </div>
            {d?.usage != null && <Kv k="tokens" v={JSON.stringify(d.usage)} />}
            <div>
              <p className="mb-2 text-muted-foreground">hybrid ranking · BM25 + dense → RRF (k=60)</p>
              <table className="w-full">
                <thead className="text-muted-foreground"><tr><th className="py-1 text-left">chunk</th><th>bm25</th><th>dense</th><th>rrf</th></tr></thead>
                <tbody>
                  {d?.candidates?.map((c) => (
                    <tr key={c.id} className={c.kept ? "text-foreground" : "text-muted-foreground/60"}>
                      <td className="max-w-[150px] truncate py-1" title={c.title}>{c.kept ? "● " : "○ "}{c.id}</td>
                      <td className="text-center">{c.bm25}<span className="text-muted-foreground"> #{c.bm25Rank ?? "-"}</span></td>
                      <td className="text-center">{c.dense}<span className="text-muted-foreground"> #{c.denseRank ?? "-"}</span></td>
                      <td className="text-center text-primary">{c.rrf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-muted-foreground">● passed relevance gate and sent to the model</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <p className="text-muted-foreground">{k}</p>
      <p className="mt-0.5 break-words text-foreground">{v}</p>
    </div>
  );
}
