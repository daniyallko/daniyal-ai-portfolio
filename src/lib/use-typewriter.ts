import { useEffect, useState } from "react";

/**
 * Cycles through phrases with a typewriter effect. Returns the currently
 * typed prefix. Runs only while `enabled`; cheap placeholder-only updates.
 */
export function useTypewriter(phrases: readonly string[], enabled: boolean): string {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!enabled || phrases.length === 0) {
      setText("");
      return;
    }
    let phrase = 0;
    let char = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const p = phrases[phrase]!;
      if (!deleting) {
        char += 1;
        setText(p.slice(0, char));
        if (char >= p.length) {
          deleting = true;
          timer = window.setTimeout(tick, 2400);
          return;
        }
        timer = window.setTimeout(tick, 30 + Math.random() * 42);
      } else {
        char -= 2;
        if (char <= 0) {
          char = 0;
          deleting = false;
          phrase = (phrase + 1) % phrases.length;
          setText("");
          timer = window.setTimeout(tick, 420);
          return;
        }
        setText(p.slice(0, char));
        timer = window.setTimeout(tick, 15);
      }
    };
    timer = window.setTimeout(tick, 500);
    return () => window.clearTimeout(timer);
  }, [enabled, phrases]);
  return enabled ? text : "";
}
