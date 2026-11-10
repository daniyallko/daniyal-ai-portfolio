import { describe, expect, it, vi } from "vitest";
import { getFocusable, wrapTabFocus } from "./focus-trap";

function fixture() {
  document.body.innerHTML = `
    <div id="dialog">
      <button id="first">First</button>
      <button id="disabled" disabled>Disabled</button>
      <button id="hidden" hidden>Hidden</button>
      <button id="css-hidden" style="display:none">Hidden CSS</button>
      <div inert><button id="inert">Inert</button></div>
      <a id="last" href="#work">Last</a>
    </div>`;
  return document.getElementById("dialog") as HTMLElement;
}

function tab(key = "Tab", shiftKey = false) {
  return { key, shiftKey, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

describe("focus trap", () => {
  it("returns only enabled visible focusable descendants", () => {
    expect(getFocusable(fixture()).map((el) => el.id)).toEqual(["first", "last"]);
  });

  it("wraps forward and backward at the boundaries", () => {
    const container = fixture();
    const first = document.getElementById("first") as HTMLElement;
    const last = document.getElementById("last") as HTMLElement;
    last.focus();
    const forward = tab();
    wrapTabFocus(forward, container);
    expect(forward.preventDefault).toHaveBeenCalledOnce();
    expect(first).toHaveFocus();
    const backward = tab("Tab", true);
    wrapTabFocus(backward, container);
    expect(backward.preventDefault).toHaveBeenCalledOnce();
    expect(last).toHaveFocus();
  });

  it("does nothing for empty containers or non-Tab keys", () => {
    document.body.innerHTML = "<div id='empty'></div>";
    const empty = document.getElementById("empty") as HTMLElement;
    const emptyTab = tab();
    wrapTabFocus(emptyTab, empty);
    expect(emptyTab.preventDefault).not.toHaveBeenCalled();
    const container = fixture();
    const enter = tab("Enter");
    wrapTabFocus(enter, container);
    expect(enter.preventDefault).not.toHaveBeenCalled();
  });
});
