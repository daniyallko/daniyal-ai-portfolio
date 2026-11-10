import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { createThread, listThreads } from "@/lib/chat.functions";
import { getVisitorId } from "@/lib/visitor";

export const Route = createFileRoute("/chat/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Start a Portfolio Chat — Mohd Daniyal" },
      {
        name: "description",
        content: "Open your saved recruiter conversation with Mohd Daniyal’s portfolio assistant.",
      },
      { property: "og:title", content: "Start a Portfolio Chat — Mohd Daniyal" },
      {
        property: "og:description",
        content: "Your private session for cited answers about Daniyal’s work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const pending = useRef<Promise<string> | null>(null);
  useEffect(() => {
    let active = true;
    pending.current ??= (async () => {
      const visitorId = getVisitorId();
      const threads = await listThreads({ data: { visitorId } });
      return threads[0]?.id ?? (await createThread({ data: { visitorId } })).id;
    })();
    pending.current
      .then((id) => {
        if (active) navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
      })
      .catch(() => {
        if (!active) return;
        pending.current = null;
        setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, navigate]);
  if (failed)
    return (
      <div className="assistant-boot" role="alert">
        <span className="assistant-boot__mark" aria-hidden="true">
          d
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Chat unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
            className="mt-5 min-h-11 rounded-full border border-hairline px-5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  return (
    <div className="assistant-boot" role="status">
      <span className="assistant-boot__mark" aria-hidden="true">
        d
      </span>
      <Loader2
        className="h-4 w-4 animate-spin text-signal motion-reduce:animate-none"
        aria-hidden="true"
      />
      <div>
        <h1 className="text-xl font-semibold text-foreground">Opening your private session</h1>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em]">
          Restoring cited conversations…
        </p>
      </div>
    </div>
  );
}
