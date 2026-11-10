const FOCUSABLE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "audio[controls]",
  "video[controls]",
  "[contenteditable='true']",
  "[tabindex]",
].join(",");

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.matches(":disabled") || el.tabIndex < 0 || el.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    for (let node: HTMLElement | null = el; node && node !== container.parentElement; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  });
}

export function wrapTabFocus(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== "Tab") return;
  const items = getFocusable(container);
  if (!items.length) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement;
  const outside = !container.contains(active);
  if ((event.shiftKey && (active === first || outside)) || (!event.shiftKey && active === last) || outside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
