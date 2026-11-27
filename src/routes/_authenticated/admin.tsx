import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronRight,
  Database,
  LoaderCircle,
  LogOut,
  MessagesSquare,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { adminGetThread, adminListVisitors, amIAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminKb } from "@/components/admin-kb";
import { AdminResume } from "@/components/admin-resume";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/_authenticated/admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Admin console — visitor sessions" },
      { name: "description", content: "Owner view of all portfolio visitor sessions and chats." },
      { property: "og:title", content: "Admin console — visitor sessions" },
      {
        property: "og:description",
        content: "Owner view of all portfolio visitor sessions and chats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const fmt = (s: string) => new Date(s).toLocaleString();

function AccessShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background bg-grid px-4 py-24">
      <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center border border-signal/50 bg-primary font-serif text-2xl italic text-primary-foreground">
            d
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Owner console
          </span>
        </div>
        <ThemeToggle />
      </div>
      <section className="surface w-full max-w-md p-6 text-center sm:p-8" aria-label="Admin access">
        {children}
      </section>
    </main>
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const role = useQuery({ queryKey: ["am-admin"], queryFn: () => amIAdmin() });
  const visitors = useQuery({
    queryKey: ["admin-visitors"],
    queryFn: () => adminListVisitors(),
    enabled: !!role.data?.admin,
    refetchInterval: 30000,
  });
  const [tab, setTab] = useState<"sessions" | "kb" | "resume">("sessions");
  const [vid, setVid] = useState<string | null>(null);
  const [tid, setTid] = useState<string | null>(null);
  const msgs = useQuery({
    queryKey: ["admin-thread", tid],
    queryFn: () => adminGetThread({ data: { threadId: tid! } }),
    enabled: !!tid,
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (role.isLoading)
    return (
      <AccessShell>
        <LoaderCircle
          className="mx-auto h-6 w-6 animate-spin text-signal motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p
          role="status"
          className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground"
        >
          Checking access…
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Verifying owner permissions before loading private sessions.
        </p>
      </AccessShell>
    );
  if (!role.data?.admin)
    return (
      <AccessShell>
        <ShieldAlert className="mx-auto h-7 w-7 text-destructive" aria-hidden="true" />
        <h1 className="mt-5 font-serif text-3xl">Owner access required.</h1>
        <p
          role="alert"
          className="mt-3 border-l-2 border-destructive pl-3 text-left text-sm leading-6 text-destructive"
        >
          This account is not the admin. Sign out and return with the owner account.
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </AccessShell>
    );

  const list = visitors.data ?? [];
  const current = list.find((v) => v.id === vid);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background bg-grid lg:h-[100dvh] lg:overflow-hidden">
      <header className="shrink-0 border-b border-hairline bg-card/85">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-signal/50 bg-primary font-serif text-2xl italic text-primary-foreground">
              d
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
                Owner console
              </p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Private signal / live visitor intelligence
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-hairline px-3 font-mono text-[11px] text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden min-[400px]:inline">Sign out</span>
              <span className="sr-only min-[400px]:hidden">Sign out</span>
            </button>
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 px-4 sm:px-6">
          <div role="tablist" aria-label="Owner console sections" className="flex gap-1">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "sessions"}
              aria-controls="admin-sessions-panel"
              onClick={() => setTab("sessions")}
              className={`inline-flex min-h-12 cursor-pointer items-center gap-2 border-b-2 px-3 font-mono text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${tab === "sessions" ? "border-signal text-signal" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <MessagesSquare className="h-4 w-4" aria-hidden="true" />
              Sessions ({list.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "kb"}
              aria-controls="admin-kb-panel"
              onClick={() => setTab("kb")}
              className={`inline-flex min-h-12 cursor-pointer items-center gap-2 border-b-2 px-3 font-mono text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${tab === "kb" ? "border-signal text-signal" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Database className="h-4 w-4" aria-hidden="true" />
              Knowledge base
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "resume"}
              onClick={() => setTab("resume")}
              className={`inline-flex min-h-12 cursor-pointer items-center gap-2 border-b-2 px-3 font-mono text-[11px] transition-colors ${tab === "resume" ? "border-signal text-signal" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Resume
            </button>
          </div>
          <span className="hidden items-center gap-2 pb-4 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground md:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
            Admin verified
          </span>
        </div>
      </header>

      {tab === "resume" ? (
        <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
          <AdminResume />
        </div>
      ) : tab === "kb" ? (
        <div id="admin-kb-panel" role="tabpanel" className="flex min-h-0 flex-1 flex-col">
          <AdminKb />
        </div>
      ) : (
        <div id="admin-sessions-panel" role="tabpanel" className="flex min-h-0 flex-1 flex-col">
          {visitors.isLoading ? (
            <div
              role="status"
              className="flex flex-1 items-center justify-center gap-3 p-8 font-mono text-xs text-muted-foreground"
            >
              <LoaderCircle
                className="h-4 w-4 animate-spin text-signal motion-reduce:animate-none"
                aria-hidden="true"
              />
              Loading visitor sessions…
            </div>
          ) : visitors.isError ? (
            <p
              role="alert"
              className="m-4 border-l-2 border-destructive bg-destructive/10 p-4 text-sm text-destructive"
            >
              {(visitors.error as Error).message}
            </p>
          ) : !list.length ? (
            <section
              className="flex flex-1 items-center justify-center p-6 text-center"
              aria-label="Empty visitor sessions"
            >
              <div className="max-w-sm">
                <Users className="mx-auto h-7 w-7 text-signal" aria-hidden="true" />
                <h1 className="mt-4 font-serif text-3xl">No visitor sessions yet</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  New visits and conversations will appear here automatically. The list refreshes
                  every 30 seconds.
                </p>
              </div>
            </section>
          ) : (
            <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_300px_minmax(0,1fr)] xl:grid-cols-[300px_320px_minmax(0,1fr)]">
              <section
                className="min-h-0 border-b border-hairline lg:border-b-0 lg:border-r"
                aria-label="Visitors"
              >
                <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Visitors
                  </h2>
                  <span className="font-mono text-[10px] text-signal">{list.length} total</span>
                </div>
                <ul className="max-h-80 overflow-y-auto lg:max-h-none lg:h-[calc(100%-41px)]">
                  {list.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        aria-pressed={vid === v.id}
                        aria-label={`Visitor ${v.id.slice(0, 8)}, ${v.threads.length} chats`}
                        onClick={() => {
                          setVid(v.id);
                          setTid(v.threads[0]?.id ?? null);
                        }}
                        className={`min-h-24 w-full cursor-pointer border-b border-l-2 border-hairline px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${vid === v.id ? "border-l-signal bg-accent/50" : "border-l-transparent hover:bg-accent/25"}`}
                      >
                        <span className="flex items-center justify-between gap-3 font-mono text-xs">
                          <span className="text-foreground">{v.id.slice(0, 8)}</span>
                          <span className="text-muted-foreground">{v.threads.length} chats</span>
                        </span>
                        <span
                          className="mt-1 block text-xs text-muted-foreground"
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {[v.country, v.ip].filter(Boolean).join(" · ") || "Location unavailable"}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                          last {fmt(v.last_seen)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                className="min-h-0 border-b border-hairline lg:border-b-0 lg:border-r"
                aria-label="Visitor details and conversations"
              >
                {current ? (
                  <div className="max-h-[34rem] overflow-y-auto lg:max-h-none lg:h-full">
                    <div className="border-b border-hairline px-4 py-3">
                      <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Visitor / {current.id.slice(0, 8)}
                      </h2>
                    </div>
                    <dl className="grid grid-cols-[minmax(72px,auto)_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-hairline p-4 font-mono text-[10px] leading-5">
                      {(
                        [
                          ["first seen", fmt(current.first_seen)],
                          ["visits", current.visits],
                          ["country", current.country],
                          ["city", current.city],
                          ["ip", current.ip],
                          ["language", current.language],
                          ["landing", current.landing_path],
                          ["referrer", current.referrer],
                          ["device", current.user_agent],
                        ] as const
                      ).map(([k, val]) =>
                        val ? (
                          <div key={k} className="col-span-2 grid grid-cols-subgrid">
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd style={{ overflowWrap: "anywhere" }}>{String(val)}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                    <div className="px-4 pb-2 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Conversations / {current.threads.length}
                    </div>
                    {current.threads.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        aria-pressed={tid === t.id}
                        onClick={() => setTid(t.id)}
                        className={`flex min-h-14 w-full cursor-pointer items-center gap-3 border-b border-l-2 border-hairline px-4 py-3 text-left text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${tid === t.id ? "border-l-signal bg-accent/50 text-foreground" : "border-l-transparent hover:bg-accent/25"}`}
                      >
                        <span className="min-w-0 flex-1" style={{ overflowWrap: "anywhere" }}>
                          {t.title}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                    {!current.threads.length && (
                      <p className="p-4 text-sm leading-6 text-muted-foreground">
                        No chats yet. Conversation threads will appear after this visitor starts
                        chatting.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-40 items-center justify-center p-6 text-center">
                    <div>
                      <Users className="mx-auto h-5 w-5 text-signal" aria-hidden="true" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        Pick a visitor to inspect metadata and conversations.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className="min-h-0 overflow-y-auto" aria-label="Conversation messages">
                <div className="sticky top-0 z-10 border-b border-hairline bg-card/95 px-4 py-3 backdrop-blur">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Message transcript
                  </h2>
                </div>
                <div className="p-3 sm:p-5">
                  {tid ? (
                    msgs.isLoading ? (
                      <p
                        role="status"
                        className="flex items-center gap-2 p-3 font-mono text-xs text-muted-foreground"
                      >
                        <LoaderCircle
                          className="h-4 w-4 animate-spin text-signal motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        Loading conversation…
                      </p>
                    ) : msgs.isError ? (
                      <p
                        role="alert"
                        className="border-l-2 border-destructive bg-destructive/10 p-4 text-sm text-destructive"
                      >
                        {(msgs.error as Error).message}
                      </p>
                    ) : (msgs.data ?? []).length ? (
                      (msgs.data ?? []).map((m) => (
                        <article
                          key={m.id}
                          className={`mb-3 border border-hairline border-l-2 bg-card p-4 ${m.role === "user" ? "border-l-signal" : "border-l-foreground/25"}`}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            <span className={m.role === "user" ? "text-signal" : ""}>
                              {m.role === "user" ? "visitor" : "assistant"}
                            </span>
                            {m.voice && <span>· voice</span>}
                            <span>· {fmt(m.created_at)}</span>
                          </div>
                          <div
                            className="whitespace-pre-wrap text-sm leading-7"
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {m.content}
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="p-3 text-sm text-muted-foreground">
                        No messages in this conversation.
                      </p>
                    )
                  ) : (
                    <div className="flex min-h-48 items-center justify-center text-center">
                      <div>
                        <MessagesSquare
                          className="mx-auto h-5 w-5 text-signal"
                          aria-hidden="true"
                        />
                        <p className="mt-3 text-sm text-muted-foreground">
                          Pick a chat to read its transcript.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
