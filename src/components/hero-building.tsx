import { useEffect, useRef } from "react";
import { BUILDING_VIEW_BOX, WINDOW_LIGHT_GROUPS } from "@/lib/hero-media";

export function HeroBuilding() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let intersecting = true;
    const syncPausedState = () => {
      root.dataset["paused"] = String(!intersecting || document.visibilityState === "hidden");
    };
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          if (!entry) return;
          intersecting = entry.isIntersecting;
          syncPausedState();
        });

    observer?.observe(root);
    document.addEventListener("visibilitychange", syncPausedState);
    syncPausedState();

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", syncPausedState);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="hero-building"
      data-testid="hero-building"
      data-paused="false"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <div className="hero-building__frame" data-testid="hero-building-frame">
        <picture>
          <source
            type="image/avif"
            media="(prefers-reduced-data: reduce)"
            srcSet="/images/noir-building-900.avif"
          />
          <source
            type="image/avif"
            srcSet="/images/noir-building-900.avif 900w, /images/noir-building-1800.avif 1800w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/images/noir-building-900.webp 900w, /images/noir-building-1800.webp 1800w"
            sizes="100vw"
          />
          <img
            className="hero-building__image"
            src="/images/noir-building-1800.jpg"
            width="1800"
            height="1200"
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            style={{ objectFit: "cover", objectPosition: "50% 50%" }}
          />
        </picture>

        <svg
          id="window-lights"
          data-testid="window-lights"
          className="hero-building__windows"
          viewBox={BUILDING_VIEW_BOX}
          preserveAspectRatio="xMidYMid slice"
        >
          {WINDOW_LIGHT_GROUPS.map((group) => (
            <g key={group.id} className={`hero-building__window-group hero-building__window-group--${group.id}`}>
              {group.polygons.map((polygon, index) => (
                <polygon
                  key={index}
                  className="hero-building__window"
                  points={polygon.map((point) => point.join(",")).join(" ")}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="hero-building__sunlight" data-testid="sunlight" style={{ pointerEvents: "none" }} />
      <div className="hero-building__scrim" />
    </div>
  );
}
