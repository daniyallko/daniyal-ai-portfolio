import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { AssistantRequest } from "@/components/home-hero";
import type { ThreadControl } from "@/components/thread-view";
import { createThread, listThreads } from "@/lib/chat.functions";
import { getVisitorId } from "@/lib/visitor";
import { wrapTabFocus } from "@/lib/focus-trap";
import { overlayDurationMs, type OverlayEntry } from "@/lib/overlay-motion";

const loadThreadView = () => import("@/components/thread-view");
const ThreadView = lazy(() => loadThreadView().then((m) => ({ default: m.ThreadView })));

export function useInlineAssistant(): {
  go: (request?: AssistantRequest) => void;
  node: ReactNode;
  open: boolean;
} {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<OverlayEntry>("empty");
  const [error, setError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const control = useRef<ThreadControl | null>(null);
  const pending = useRef<AssistantRequest | null>(null);
  const initializing = useRef<Promise<string> | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  const initialize = useCallback((): Promise<string> => {
    if (threadId) return Promise.resolve(threadId);
    if (initializing.current) return initializing.current;
    const request = listThreads({ data: { visitorId: getVisitorId() } })
      .then(async (threads) => {
        if (threads[0]) return threads[0].id;
        const thread = await createThread({ data: { visitorId: getVisitorId() } });
        return thread.id;
      })
      .then((id) => {
        setThreadId((current) => current ?? id);
        return id;
      });
    initializing.current = request;
    void request.catch(() => {
      if (initializing.current === request) initializing.current = null;
    });
    return request;
  }, [threadId]);

  useEffect(() => {
    const boot = () => {
      void loadThreadView();
      void fetch("/voice-worklets.js").catch(() => {});
      void initialize().catch(() => {});
    };
    const w = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(boot);
      return () => w.cancelIdleCallback?.(id);
    }
    const id = setTimeout(boot, 200);
    return () => clearTimeout(id);
  }, []);

  const flush = useCallback(() => {
    const currentControl = control.current;
    const request = pending.current;
    if (!request || !currentControl?.ready) return false;
    pending.current = null;
    if (request.call) currentControl.startCall();
    else if (request.q) currentControl.send(request.q);
    return true;
  }, []);

  const ensureThread = useCallback(() => {
    if (threadId) return;
    void initialize()
      .then(() => {
        setError(null);
      })
      .catch(() => {
        setError("Couldn't open the assistant. Check your connection and try again.");
      });
  }, [threadId, initialize]);

  const go = useCallback(
    (request?: AssistantRequest) => {
      pending.current = request ?? null;
      trigger.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setEntry(request?.call ? "voice" : request?.q ? "message" : "empty");
      setError(null);
      setOpen(true);
      if (flush()) return;
      ensureThread();
    },
    [ensureThread, flush],
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      if (!pending.current || flush()) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [open, threadId, flush]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const sourceDialog =
          event.target instanceof Element ? event.target.closest('[role="dialog"]') : null;
        if (sourceDialog && sourceDialog !== overlay.current) return;
        if (overlay.current?.querySelector('[role="dialog"]')) return;
        event.preventDefault();
        close();
        return;
      }
      if (overlay.current) wrapTabFocus(event, overlay.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger.current?.focus();
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || !overlay.current || overlay.current.contains(document.activeElement)) return;
    const frame = requestAnimationFrame(() => {
      const target = overlay.current?.querySelector<HTMLElement>(
        "button:not(:disabled), textarea, a[href]",
      );
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, threadId, error]);

  const loading = (
    <div className="assistant-boot" role="status">
      <span className="assistant-boot__mark" aria-hidden>
        d
      </span>
      <p>Opening assistant…</p>
      <button type="button" onClick={close}>
        Close
      </button>
    </div>
  );
  const failure = (
    <div className="assistant-boot" role="alert">
      <span className="assistant-boot__mark" aria-hidden>
        d
      </span>
      <h2>Assistant unavailable</h2>
      <p>{error}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="assistant-boot__primary"
          onClick={() => {
            setError(null);
            if (!flush()) ensureThread();
          }}
        >
          Retry
        </button>
        <button type="button" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );

  const node =
    threadId || open || error ? (
      <div
        ref={overlay}
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-label="Daniyal's AI assistant"
        aria-hidden={!open}
        inert={!open ? true : undefined}
        data-open={String(open)}
        data-entry={entry}
        className="assistant-overlay"
        style={
          { "--overlay-duration": `${overlayDurationMs(entry, reducedMotion)}ms` } as CSSProperties
        }
      >
        {error ? (
          failure
        ) : threadId ? (
          <Suspense fallback={loading}>
            <ThreadView
              threadId={threadId}
              embed={{ active: open, onClose: close, controlRef: control }}
            />
          </Suspense>
        ) : (
          loading
        )}
      </div>
    ) : null;

  return { go, node, open };
}
