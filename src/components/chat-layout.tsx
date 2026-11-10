import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ArrowLeft, MessageSquare, X } from "lucide-react";
import { listThreads, createThread, deleteThread } from "@/lib/chat.functions";
import { getVisitorId } from "@/lib/visitor";
import { getFocusable, wrapTabFocus } from "@/lib/focus-trap";

export const threadsKey = ["threads"] as const;

type Thread = { id: string; title: string };

function ThreadNavigation({ threads, activeId, onDelete, onNavigate }: {
  threads: Thread[];
  activeId?: string | undefined;
  onDelete: (id: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Saved conversations" className="mt-6 flex-1 space-y-1 overflow-y-auto px-3 pb-5">
      <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Conversation archive</p>
      {threads.length === 0 && <p className="px-3 text-sm leading-relaxed text-muted-foreground">Your conversations will appear here.</p>}
      {threads.map((t) => (
        <div key={t.id} className={`group flex min-w-0 items-center border-l-2 transition-colors ${activeId === t.id ? "border-signal bg-sidebar-accent" : "border-transparent hover:bg-sidebar-accent/50"}`}>
          <Link to="/chat/$threadId" params={{ threadId: t.id }} onClick={onNavigate} aria-current={activeId === t.id ? "page" : undefined} className="min-w-0 flex-1 truncate px-3 py-3 text-sm text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground">
            {t.title}
          </Link>
          <button type="button" aria-label="Delete chat" title={`Delete ${t.title}`} onClick={() => onDelete(t.id)} className="mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </nav>
  );
}

export function ChatLayout() {
  const visitorId = getVisitorId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const { data: threads = [] } = useQuery({ queryKey: threadsKey, queryFn: () => listThreads({ data: { visitorId } }) });
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const onNew = async () => {
    const t = await createThread({ data: { visitorId } });
    await qc.invalidateQueries({ queryKey: threadsKey });
    setMobileOpen(false);
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  };
  const onDelete = async (id: string) => {
    await deleteThread({ data: { visitorId, threadId: id } });
    await qc.invalidateQueries({ queryKey: threadsKey });
    if (params.threadId === id) {
      setMobileOpen(false);
      navigate({ to: "/chat" });
    }
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    getFocusable(drawerRef.current!)[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      else if (drawerRef.current) wrapTabFocus(event, drawerRef.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuRef.current?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center justify-between px-5 pb-5 pt-6">
          <Link to="/" className="flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-signal"><ArrowLeft className="h-4 w-4" aria-hidden="true" />portfolio</Link>
          <Link to="/eval" className="flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-signal">eval</Link>
        </div>
        <div className="mx-5 mb-5 border-t border-hairline pt-6">
          <p className="font-serif text-3xl italic tracking-[-0.03em]">Private signal.</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Saved only in this browser</p>
        </div>
        <button type="button" onClick={onNew} className="mx-5 flex min-h-12 items-center justify-between border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          <span className="flex items-center gap-2"><Plus className="h-4 w-4" aria-hidden="true" />New chat</span>
          <span className="font-mono text-[10px] opacity-60">01</span>
        </button>
        <ThreadNavigation threads={threads} activeId={params.threadId} onDelete={onDelete} />
        <p className="border-t border-hairline px-5 py-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Anonymous · cited · multilingual</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top flex h-16 shrink-0 items-center gap-2 border-b border-hairline bg-background px-3 md:hidden">
          <button ref={menuRef} type="button" aria-label="Open conversations" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="grid h-11 w-11 place-items-center rounded-full border border-hairline text-foreground">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 px-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Private session</p>
            <p className="truncate text-sm font-medium">Conversations</p>
          </div>
          <button type="button" aria-label="New chat" onClick={onNew} className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="h-4 w-4" aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 flex-1"><Outlet /></div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" aria-label="Close conversations" onClick={() => setMobileOpen(false)} className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm" />
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Conversations" className="chat-drawer safe-top safe-bottom absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col border-r border-hairline bg-sidebar shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div><p className="font-serif text-3xl italic">Your signal.</p><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Conversation archive</p></div>
              <button type="button" aria-label="Close conversations" onClick={() => setMobileOpen(false)} className="grid h-11 w-11 place-items-center rounded-full border border-hairline"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <div className="p-4">
              <button type="button" onClick={onNew} className="flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" aria-hidden="true" />New chat</button>
            </div>
            <ThreadNavigation threads={threads} activeId={params.threadId} onDelete={onDelete} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
