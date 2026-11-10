import { useEffect, useRef } from "react";

/**
 * Ambient spotlight that follows the pointer. Zero React re-renders:
 * a passive pointermove listener writes --cursor-x/--cursor-y custom
 * properties through requestAnimationFrame; the gradient reads them in CSS.
 * Disabled entirely on coarse-pointer (touch) devices.
 */
export function AmbientCursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight * 0.3;
    const paint = () => {
      raf = 0;
      el.style.setProperty("--cursor-x", `${x}px`);
      el.style.setProperty("--cursor-y", `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} aria-hidden className="ambient-glow" />;
}
