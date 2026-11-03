import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { createThread, listThreads } from "@/lib/chat.functions";
import { getVisitorId } from "@/lib/visitor";

export const Route = createFileRoute("/chat/")({
  ssr: false,
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
  return <div className="flex h-full items-center justify-center font-mono text-sm text-muted-foreground">booting assistant…</div>;
}
