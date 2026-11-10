import { useEffect, useRef } from "react";

/** Decorative canvas: glowing fireflies in dark mode, fluttering butterflies in light mode. */
type Critter = { x: number; y: number; vx: number; vy: number; phase: number; size: number; hue: number };

const BUTTERFLY_COLORS = ["#E5A93C", "#D9774B", "#6C8EBF", "#B8860B", "#8A6FB0"];

export function AmbientCritters() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const make = (n: number): Critter[] =>
      Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2, size: 0.7 + Math.random() * 0.6,
        hue: Math.floor(Math.random() * BUTTERFLY_COLORS.length),
      }));
    const count = w < 640 ? 14 : 26;
    const flies = make(count);
    const butterflies = make(Math.round(count / 2.5));

    const move = (c: Critter, speed: number, t: number) => {
      c.vx += (Math.random() - 0.5) * 0.05 * speed;
      c.vy += (Math.random() - 0.5) * 0.05 * speed + Math.sin(t / 900 + c.phase) * 0.004;
      const max = 0.7 * speed;
      c.vx = Math.max(-max, Math.min(max, c.vx));
      c.vy = Math.max(-max, Math.min(max, c.vy));
      c.x += c.vx; c.y += c.vy;
      if (c.x < -30) c.x = w + 30; if (c.x > w + 30) c.x = -30;
      if (c.y < -30) c.y = h + 30; if (c.y > h + 30) c.y = -30;
    };

    const drawFirefly = (c: Critter, t: number) => {
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(t / 700 + c.phase * 3));
      const r = 10 * c.size;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, `rgba(255, 226, 140, ${0.9 * pulse})`);
      g.addColorStop(0.3, `rgba(229, 169, 60, ${0.45 * pulse})`);
      g.addColorStop(1, "rgba(229, 169, 60, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 245, 210, ${pulse})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, 1.4 * c.size, 0, Math.PI * 2); ctx.fill();
    };

    const drawButterfly = (c: Critter, t: number) => {
      const flap = Math.abs(Math.sin(t / 110 + c.phase));
      const s = 9 * c.size;
      const color = BUTTERFLY_COLORS[c.hue]!;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.atan2(c.vy, c.vx) + Math.PI / 2);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = color;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side * (0.25 + 0.75 * flap), 1);
        ctx.beginPath(); ctx.ellipse(s * 0.6, -s * 0.35, s * 0.65, s * 0.5, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.45, s * 0.4, s * 0.4, s * 0.32, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#2A2620";
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.1, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const frame = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const light = document.documentElement.dataset["theme"] === "light";
      if (light) for (const b of butterflies) { if (!reduced) move(b, 1.6, t); drawButterfly(b, reduced ? 0 : t); }
      else for (const f of flies) { if (!reduced) move(f, 0.6, t); drawFirefly(f, reduced ? 0 : t); }
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const obs = new MutationObserver(() => reduced && requestAnimationFrame(frame));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { cancelAnimationFrame(raf); obs.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-20 h-full w-full" />;
}
