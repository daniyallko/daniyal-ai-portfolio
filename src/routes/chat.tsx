import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { listThreads, createThread, deleteThread } from "@/lib/chat.functions";
import { getVisitorId } from "@/lib/visitor";

export const Route = createFileRoute("/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ask Daniyal's AI — Recruiter Assistant" },
      { name: "description", content: "Chat with an AI assistant that answers questions about Mohd Daniyal's experience, with cited sources." },
      { property: "og:title", content: "Ask Daniyal's AI — Recruiter Assistant" },
      { property: "og:description", content: "RAG assistant over Mohd Daniyal's portfolio, with inline citations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatLayout,
});

export const threadsKey = ["threads"] as const;

function ChatLayout() {
  const visitorId = getVisitorId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const { data: threads = [] } = useQuery({ queryKey: threadsKey, queryFn: () => listThreads({ data: { visitorId } }) });

  const onNew = async () => {
    const t = await createThread({ data: { visitorId } });
    await qc.invalidateQueries({ queryKey: threadsKey });
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  };
  const onDelete = async (id: string) => {
    await deleteThread({ data: { visitorId, threadId: id } });
    await qc.invalidateQueries({ queryKey: threadsKey });
    if (params.threadId === id) navigate({ to: "/chat" });
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />portfolio</Link>
        </div>
        <button onClick={onNew} className="mx-3 flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New chat
        </button>
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {threads.map((t) => (
            <div key={t.id} className={`group flex items-center rounded-md ${params.threadId === t.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}>
              <Link to="/chat/$threadId" params={{ threadId: t.id }} className="flex-1 truncate px-3 py-2 text-sm">{t.title}</Link>
              <button aria-label="Delete chat" onClick={() => onDelete(t.id)} className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1"><Outlet /></div>
    </div>
  );
}
