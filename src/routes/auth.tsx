import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin sign in — Mohd Daniyal" },
      { name: "description", content: "Owner sign-in for the portfolio admin console." },
      { property: "og:title", content: "Admin sign in — Mohd Daniyal" },
      { property: "og:description", content: "Owner sign-in for the portfolio admin console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setMessageKind("error"); setMsg(error.message); } else navigate({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
      setMessageKind(error ? "error" : "success");
      setMsg(error ? error.message : "Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  };

  const busyLabel = mode === "in" ? "Signing in…" : "Creating account…";

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background bg-grid">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_28%,var(--glow-a),transparent_42%)]" aria-hidden="true" />
      <header className="safe-top absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link to="/" className="group inline-flex min-h-11 items-center gap-3" aria-label="Back to portfolio">
          <span className="grid h-9 w-9 place-items-center border border-signal/50 bg-primary font-serif text-2xl italic text-primary-foreground">d</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors group-hover:text-signal sm:inline">Back to portfolio</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 pb-12 pt-28 sm:px-6 sm:pt-32 lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-20 lg:px-10 lg:py-28">
        <section className="max-w-xl" aria-labelledby="auth-intro">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal">Private access / owner console</p>
          <h1 id="auth-intro" className="mt-5 font-serif text-5xl leading-[0.96] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            Behind the<br /><span className="italic text-signal">signal.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
            A quiet control room for conversation insight, knowledge sources, and the systems behind Daniyal’s AI portfolio.
          </p>
          <div className="mt-8 hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground lg:flex">
            <LockKeyhole className="h-4 w-4 text-signal" aria-hidden="true" />
            Owner-only · encrypted authentication
          </div>
        </section>

        <section className="surface relative" aria-labelledby="auth-title">
          <div className="h-0.5 bg-gradient-to-r from-signal via-signal/30 to-transparent" aria-hidden="true" />
          <form onSubmit={submit} aria-busy={busy} className="space-y-5 p-5 sm:p-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">$ admin --{mode === "in" ? "login" : "register"}</p>
              <h2 id="auth-title" className="mt-3 font-serif text-3xl tracking-tight">{mode === "in" ? "Welcome back." : "Create owner access."}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "in" ? "Sign in to open your private console." : "The first account becomes the portfolio administrator."}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="auth-email" className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">Email address</label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={busy}
                aria-invalid={messageKind === "error" && !!msg}
                aria-describedby={msg ? "auth-message" : undefined}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full border border-input bg-background px-3.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/35 focus:border-signal focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="auth-password" className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">Password</label>
                <span className="font-mono text-[10px] text-muted-foreground">8+ characters</span>
              </div>
              <input
                id="auth-password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                placeholder="Your secure password"
                value={password}
                disabled={busy}
                aria-invalid={messageKind === "error" && !!msg}
                aria-describedby={msg ? "auth-message" : undefined}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full border border-input bg-background px-3.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/35 focus:border-signal focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-18px_var(--signal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:transform-none">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {busy ? busyLabel : mode === "in" ? "Sign in" : "Create account"}
              {!busy && <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
            </button>
            {busy && <p role="status" className="sr-only">{busyLabel}</p>}
            {msg && <p id="auth-message" role={messageKind === "error" ? "alert" : "status"} className={`border-l-2 py-1 pl-3 text-sm leading-6 ${messageKind === "error" ? "border-destructive text-destructive" : "border-signal text-signal"}`}>{msg}</p>}

            <button type="button" disabled={busy} onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="min-h-11 w-full cursor-pointer font-mono text-[11px] leading-5 text-muted-foreground underline decoration-hairline underline-offset-4 transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50">
              {mode === "in" ? "First time? Create the owner account" : "Have an account? Sign in"}
            </button>
          </form>
        </section>
      </div>
      <Link to="/" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-signal lg:inline-flex">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Return to public portfolio
      </Link>
    </main>
  );
}
