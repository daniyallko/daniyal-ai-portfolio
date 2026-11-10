import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type Listener = (event: MediaQueryListEvent) => void;
let systemDark = true;
const listeners = new Set<Listener>();

function emitSystemTheme() {
  const event = { matches: systemDark } as MediaQueryListEvent;
  listeners.forEach((listener) => listener(event));
}

beforeEach(() => {
  window.localStorage.clear();
  systemDark = true;
  listeners.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() { return systemDark; },
      media: query,
      onchange: null,
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
      addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
      dispatchEvent: () => true,
    })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

function renderToggle() {
  return render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
}

describe("ThemeProvider and ThemeToggle", () => {
  it("toggles root state, color scheme, accessible action, and saved preference", async () => {
    renderToggle();
    const button = await screen.findByRole("button", { name: "Switch to light theme" });
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("w-11");
    fireEvent.click(button);
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("light"));
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeTruthy();
  });

  it("follows OS changes only without an explicit preference", async () => {
    renderToggle();
    await screen.findByRole("button", { name: "Switch to light theme" });
    systemDark = false;
    emitSystemTheme();
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("light"));

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("dark"));
    systemDark = true;
    emitSystemTheme();
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("ignores an invalid saved value and follows the OS", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    systemDark = false;
    renderToggle();
    await screen.findByRole("button", { name: "Switch to dark theme" });
    expect(document.documentElement.dataset["theme"]).toBe("light");
  });

  it("does not throw when storage is denied", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Denied"); });
    renderToggle();
    const button = await screen.findByRole("button", { name: "Switch to light theme" });
    expect(() => fireEvent.click(button)).not.toThrow();
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("light"));
  });
});
