import { useEffect, useRef, useState } from "react";

const METRIC = /^(\D*)([\d,]+(?:\.\d+)?)(.*)$/;
const DURATION = 1100;

export function CountUp({
  value,
  reducedMotion,
}: {
  value: string;
  reducedMotion: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (reducedMotion) {
      setShown(value);
      return;
    }

    const match = value.match(METRIC);
    const element = root.current;
    if (!match || !element) {
      setShown(value);
      return;
    }

    const [, prefix = "", numeric = "", suffix = ""] = match;
    const target = Number(numeric.replace(/,/g, ""));
    const decimals = numeric.includes(".") ? (numeric.split(".")[1]?.length ?? 0) : 0;
    const formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const format = (amount: number) => `${prefix}${formatter.format(amount)}${suffix}`;
    let frame = 0;
    let observer: IntersectionObserver | undefined;
    let started = false;

    const animate = () => {
      if (started) return;
      started = true;
      observer?.disconnect();
      let start: number | undefined;
      const tick = (now: number) => {
        start ??= now;
        const progress = Math.min((now - start) / DURATION, 1);
        const eased = 1 - (1 - progress) ** 3;
        setShown(progress === 1 ? value : format(Math.round(target * eased)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) animate();
      });
      observer.observe(element);
    } else {
      animate();
    }

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [reducedMotion, value]);

  return (
    <span ref={root}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
