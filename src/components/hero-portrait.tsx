import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useRef, type ReactElement } from "react";
import { particleBudget } from "@/lib/particle-face";

interface HeroPortraitProps {
  paused?: boolean;
}

interface ConnectionLike {
  saveData?: boolean;
  addEventListener?: EventTarget["addEventListener"];
  removeEventListener?: EventTarget["removeEventListener"];
}

function StaticPortrait(): ReactElement {
  return (
    <img
      className="hero-portrait__fallback"
      src="/images/generic-face.svg"
      width="600"
      height="600"
      alt=""
      role="presentation"
      fetchPriority="high"
      decoding="async"
    />
  );
}

function StaticRoot({ paused }: { paused: boolean }): ReactElement {
  return (
    <div
      className="hero-portrait"
      data-testid="hero-portrait"
      data-enhanced="false"
      data-paused={String(paused)}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <StaticPortrait />
    </div>
  );
}

function LivePortrait({ paused }: { paused: boolean }): ReactElement {
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
        const { mountParticleFace } = await import(
          "@/components/particle-face-engine"
        );
        if (disposed || ticket !== generation) return;
        disposeEngine = mountParticleFace(host, {
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
      const count = particleBudget({
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
      className="hero-portrait"
      data-testid="hero-portrait"
      data-enhanced="false"
      data-paused={String(paused)}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <StaticPortrait />
      <div ref={hostRef} className="hero-portrait__stage" />
    </div>
  );
}

export function HeroPortrait({ paused = false }: HeroPortraitProps): ReactElement {
  return (
    <ClientOnly fallback={<StaticRoot paused={paused} />}>
      <LivePortrait paused={paused} />
    </ClientOnly>
  );
}
