import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useRef, type ReactElement } from "react";
import { axonBudget } from "@/lib/axon-field";

interface AxonHeroProps {
  paused?: boolean;
}

interface ConnectionLike {
  saveData?: boolean;
  addEventListener?: EventTarget["addEventListener"];
  removeEventListener?: EventTarget["removeEventListener"];
}

function StaticRing(): ReactElement {
  return <span className="axon-hero__fallback" role="presentation" />;
}

function StaticRoot({ paused }: { paused: boolean }): ReactElement {
  return (
    <div
      className="axon-hero"
      data-testid="axon-hero"
      data-enhanced="false"
      data-paused={String(paused)}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <StaticRing />
    </div>
  );
}

function LiveRing({ paused }: { paused: boolean }): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const syncPauseRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
    syncPauseRef.current();
  }, [paused]);

  useEffect(() => {
    const root = rootRef.current;
    const host = hostRef.current;
    if (!root || !host) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dataQuery = window.matchMedia("(prefers-reduced-data: reduce)");
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    const queries = [motionQuery, dataQuery, coarseQuery];
    const connection = (navigator as Navigator & { connection?: ConnectionLike })
      .connection;
    let activeCount = 0;
    let generation = 0;
    let disposed = false;
    let blocked = false;
    let disposeEngine: (() => void) | null = null;

    const stop = () => {
      generation += 1;
      activeCount = 0;
      disposeEngine?.();
      disposeEngine = null;
      host.replaceChildren();
      root.dataset["enhanced"] = "false";
    };

    const start = async (count: number) => {
      const ticket = ++generation;
      activeCount = count;
      try {
        const { mountAxonField } = await import("@/components/axon-field-engine");
        if (disposed || ticket !== generation) return;
        disposeEngine = mountAxonField(host, {
          count,
          onReady: () => {
            if (!disposed && ticket === generation) {
              root.dataset["enhanced"] = "true";
            }
          },
          onContextLoss: () => {
            blocked = true;
            stop();
          },
        });
      } catch {
        if (!disposed && ticket === generation) {
          blocked = true;
          stop();
        }
      }
    };

    const syncEligibility = () => {
      const count = axonBudget({
        width: window.innerWidth,
        coarse: coarseQuery.matches,
        reducedMotion: motionQuery.matches,
        reducedData: dataQuery.matches || Boolean(connection?.saveData),
      });
      root.dataset["budget"] = String(count);
      if (count === 0) {
        if (activeCount !== 0) stop();
        return;
      }
      if (blocked || count === activeCount) return;
      stop();
      void start(count);
    };

    let intersecting = true;
    const syncPausedState = () => {
      root.dataset["paused"] = String(
        pausedRef.current || !intersecting || document.visibilityState === "hidden",
      );
    };
    syncPauseRef.current = syncPausedState;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            if (!entry) return;
            intersecting = entry.isIntersecting;
            syncPausedState();
          });
    observer?.observe(root);
    document.addEventListener("visibilitychange", syncPausedState);
    for (const query of queries) query.addEventListener("change", syncEligibility);
    connection?.addEventListener?.("change", syncEligibility);
    window.addEventListener("resize", syncEligibility, { passive: true });
    syncPausedState();
    syncEligibility();

    return () => {
      disposed = true;
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", syncPausedState);
      for (const query of queries)
        query.removeEventListener("change", syncEligibility);
      connection?.removeEventListener?.("change", syncEligibility);
      window.removeEventListener("resize", syncEligibility);
      syncPauseRef.current = () => {};
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="axon-hero"
      data-testid="axon-hero"
      data-enhanced="false"
      data-paused={String(paused)}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <StaticRing />
      <div ref={hostRef} className="axon-hero__stage" />
    </div>
  );
}

export function AxonHero({ paused = false }: AxonHeroProps): ReactElement {
  return (
    <ClientOnly fallback={<StaticRoot paused={paused} />}>
      <LiveRing paused={paused} />
    </ClientOnly>
  );
}
