import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message); else navigate({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
      setMsg(error ? error.message : "Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border border-border bg-card p-6">
        <div className="font-mono text-xs text-primary">$ admin --{mode === "in" ? "login" : "register"}</div>
        <h1 className="text-xl font-semibold">{mode === "in" ? "Sign in" : "Create owner account"}</h1>
        <input type="email" required placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-input bg-background px-3 py-2 font-mono text-sm" />
        <input type="password" required minLength={8} placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-input bg-background px-3 py-2 font-mono text-sm" />
        <button disabled={busy} className="w-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}</button>
        {msg && <p className="font-mono text-xs text-muted-foreground">{msg}</p>}
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="font-mono text-xs text-muted-foreground hover:text-foreground">
          {mode === "in" ? "first time? create the owner account" : "have an account? sign in"}
        </button>
      </form>
    </div>
  );
}
