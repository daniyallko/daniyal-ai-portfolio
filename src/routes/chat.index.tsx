import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { createThread, listThreads } from "@/lib/chat.functions";
import { getVisitorId } from "@/lib/visitor";

export const Route = createFileRoute("/chat/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Start a Portfolio Chat — Mohd Daniyal" },
    { name: "description", content: "Open your saved recruiter conversation with Mohd Daniyal’s portfolio assistant." },
    { property: "og:title", content: "Start a Portfolio Chat — Mohd Daniyal" },
    { property: "og:description", content: "Your private session for cited answers about Daniyal’s work." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const visitorId = getVisitorId();
      const threads = await listThreads({ data: { visitorId } });
      const id = threads[0]?.id ?? (await createThread({ data: { visitorId } })).id;
      navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
    })();
  }, [navigate]);
  return (
    <div className="assistant-boot" role="status">
      <span className="assistant-boot__mark" aria-hidden="true">d</span>
      <Loader2 className="h-4 w-4 animate-spin text-signal motion-reduce:animate-none" aria-hidden="true" />
      <div>
        <h1 className="text-xl font-semibold text-foreground">Opening your private session</h1>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em]">Restoring cited conversations…</p>
      </div>
    </div>
  );
}
