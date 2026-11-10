export type OverlayEntry = "message" | "empty" | "voice";

export function overlayDurationMs(entry: OverlayEntry, reducedMotion: boolean): 0 | 300 | 900 {
  if (reducedMotion || entry === "voice") return 0;
  return entry === "message" ? 900 : 300;
}
