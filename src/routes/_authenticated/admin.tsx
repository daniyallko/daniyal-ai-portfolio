import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminGetThread, adminListVisitors, amIAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminKb } from "@/components/admin-kb";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — visitor sessions" },
      { name: "description", content: "Owner view of all portfolio visitor sessions and chats." },
      { property: "og:title", content: "Admin console — visitor sessions" },
      { property: "og:description", content: "Owner view of all portfolio visitor sessions and chats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const fmt = (s: string) => new Date(s).toLocaleString();

function AdminPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const role = useQuery({ queryKey: ["am-admin"], queryFn: () => amIAdmin() });
  const visitors = useQuery({ queryKey: ["admin-visitors"], queryFn: () => adminListVisitors(), enabled: !!role.data?.admin, refetchInterval: 30000 });
  const [tab, setTab] = useState<"sessions" | "kb">("sessions");
  const [vid, setVid] = useState<string | null>(null);
  const [tid, setTid] = useState<string | null>(null);
  const msgs = useQuery({ queryKey: ["admin-thread", tid], queryFn: () => adminGetThread({ data: { threadId: tid! } }), enabled: !!tid });

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (role.isLoading) return <div className="p-8 font-mono text-sm text-muted-foreground">checking access…</div>;
  if (!role.data?.admin) return (
    <div className="p-8 font-mono text-sm">
      <p className="text-destructive">This account is not the admin.</p>
      <button onClick={signOut} className="mt-4 text-muted-foreground hover:text-foreground">sign out</button>
    </div>
  );

  const list = visitors.data ?? [];
  const current = list.find((v) => v.id === vid);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 font-mono text-xs">
        <span className="flex gap-4"><span className="text-primary">●</span>
          <button onClick={() => setTab("sessions")} className={tab === "sessions" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>sessions ({list.length})</button>
          <button onClick={() => setTab("kb")} className={tab === "kb" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>knowledge base</button></span>
        <button onClick={signOut} className="text-muted-foreground hover:text-foreground">sign out</button>
      </header>
      {tab === "kb" ? <AdminKb /> : <div className="grid min-h-0 flex-1 grid-cols-[300px_260px_1fr]">
        <ul className="overflow-y-auto border-r border-border">
          {list.map((v) => (
            <li key={v.id}>
              <button onClick={() => { setVid(v.id); setTid(v.threads[0]?.id ?? null); }} className={`w-full border-b border-border px-3 py-2 text-left ${vid === v.id ? "bg-accent" : "hover:bg-accent/50"}`}>
                <div className="flex justify-between font-mono text-xs"><span>{v.id.slice(0, 8)}</span><span className="text-muted-foreground">{v.threads.length} chats</span></div>
                <div className="truncate text-xs text-muted-foreground">{[v.country, v.ip].filter(Boolean).join(" · ") || "—"}</div>
                <div className="font-mono text-[10px] text-muted-foreground">last {fmt(v.last_seen)}</div>
              </button>
            </li>
          ))}
        </ul>
        <div className="overflow-y-auto border-r border-border">
          {current ? (
            <>
              <dl className="space-y-1 border-b border-border p-3 font-mono text-[11px]">
                {([["first seen", fmt(current.first_seen)], ["visits", current.visits], ["country", current.country], ["city", current.city], ["ip", current.ip], ["language", current.language], ["landing", current.landing_path], ["referrer", current.referrer], ["device", current.user_agent]] as const).map(([k, val]) => val ? <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{String(val)}</dd></div> : null)}
              </dl>
              {current.threads.map((t) => (
                <button key={t.id} onClick={() => setTid(t.id)} className={`block w-full truncate border-b border-border px-3 py-2 text-left text-sm ${tid === t.id ? "bg-accent" : "hover:bg-accent/50"}`}>{t.title}</button>
              ))}
              {!current.threads.length && <p className="p-3 text-xs text-muted-foreground">No chats yet.</p>}
            </>
          ) : <p className="p-3 text-xs text-muted-foreground">Pick a visitor.</p>}
        </div>
        <div className="overflow-y-auto p-4">
          {tid ? (msgs.data ?? []).map((m) => (
            <div key={m.id} className={`mb-3 border border-border p-3 ${m.role === "user" ? "border-primary/40" : ""}`}>
              <div className="mb-1 font-mono text-[10px] text-muted-foreground">{m.role === "user" ? "visitor" : "assistant"}{m.voice ? " · voice" : ""} · {fmt(m.created_at)}</div>
              <div className="whitespace-pre-wrap text-sm">{m.content}</div>
            </div>
          )) : <p className="text-xs text-muted-foreground">Pick a chat.</p>}
        </div>
      </div>}
    </div>
  );
}
