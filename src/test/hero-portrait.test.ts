import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroPortrait } from "@/components/hero-portrait";

const { mountMock, disposeMock } = vi.hoisted(() => ({
  mountMock: vi.fn(),
  disposeMock: vi.fn(),
}));

vi.mock("@/components/particle-face-engine", () => ({
  mountParticleFace: (
    host: HTMLElement,
    options: {
      count: number;
      onReady: () => void;
      onContextLoss: () => void;
    },
  ) => {
    mountMock(host, options);
    const canvas = document.createElement("canvas");
    canvas.dataset["engineCanvas"] = "true";
    host.append(canvas);
    if (autoReady) options.onReady?.();
    return disposeMock;
  },
}));

type MediaListener = (event: MediaQueryListEvent) => void;
type ConnectionMock = EventTarget & { saveData: boolean };
let autoReady = true;
let connection: ConnectionMock;
const mediaListeners = new Map<string, Set<MediaListener>>();
let reducedMotion = false;
let reducedData = false;
let coarsePointer = false;
let intersectionCallback: IntersectionObserverCallback;
const observeMock = vi.fn();
const disconnectMock = vi.fn();

function installBrowserMocks() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      get matches() {
        if (query.includes("reduced-motion")) return reducedMotion;
        if (query.includes("reduced-data")) return reducedData;
        if (query.includes("pointer: coarse")) return coarsePointer;
        return false;
      },
      media: query,
      addEventListener: (_type: string, listener: MediaListener) => {
        const listeners = mediaListeners.get(query) ?? new Set();
        listeners.add(listener);
        mediaListeners.set(query, listeners);
      },
      removeEventListener: (_type: string, listener: MediaListener) => {
        mediaListeners.get(query)?.delete(listener);
      },
    }),
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  connection = Object.assign(new EventTarget(), { saveData: false });
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: connection,
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }
      observe = observeMock;
      disconnect = disconnectMock;
      unobserve = vi.fn();
      root = null;
      rootMargin = "0px";
      thresholds = [0];
      takeRecords = () => [];
    },
  );
}

function changeMedia(query: string) {
  for (const listener of mediaListeners.get(query) ?? []) {
    listener({ matches: true } as MediaQueryListEvent);
  }
}

beforeEach(() => {
  installBrowserMocks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mediaListeners.clear();
  reducedMotion = false;
  reducedData = false;
  coarsePointer = false;
  autoReady = true;
  vi.unstubAllGlobals();
});

describe("HeroPortrait lifecycle", () => {
  it("keeps a static portrait and never enhances for reduced motion", () => {
    reducedMotion = true;
    render(createElement(HeroPortrait));
    expect(screen.getByTestId("hero-portrait")).toHaveAttribute(
      "data-enhanced",
      "false",
    );
    const fallbacks = screen.getAllByRole("presentation", { hidden: true });
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]).toHaveAttribute("src", "/images/generic-face.svg");
    expect(mountMock).not.toHaveBeenCalled();
  });

  it("mounts one eligible desktop renderer and disposes it on unmount", async () => {
    const { unmount } = render(createElement(HeroPortrait));
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    expect(mountMock.mock.calls[0]![1].count).toBe(3000);
    expect(screen.getByTestId("hero-portrait")).toHaveAttribute(
      "data-enhanced",
      "true",
    );
    unmount();
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).toHaveBeenCalled();
  });

  it("disposes a live renderer when reduced data changes", async () => {
    render(createElement(HeroPortrait));
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    act(() => {
      reducedData = true;
      changeMedia("(prefers-reduced-data: reduce)");
    });
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("hero-portrait")).toHaveAttribute(
      "data-enhanced",
      "false",
    );
  });

  it("disposes and restores the renderer on live save-data changes", async () => {
    render(createElement(HeroPortrait));
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));

    act(() => {
      connection.saveData = true;
      connection.dispatchEvent(new Event("change"));
    });
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("hero-portrait")).toHaveAttribute("data-budget", "0");
    expect(screen.getByTestId("hero-portrait")).toHaveAttribute("data-enhanced", "false");

    act(() => {
      connection.saveData = false;
      connection.dispatchEvent(new Event("change"));
    });
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("hero-portrait")).toHaveAttribute("data-budget", "3000");
    expect(screen.getByTestId("hero-portrait")).toHaveAttribute("data-enhanced", "true");
  });

  it("keeps the static fallback until the engine reports its first ready frame", async () => {
    autoReady = false;
    render(createElement(HeroPortrait));
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    const root = screen.getByTestId("hero-portrait");
    expect(root).toHaveAttribute("data-enhanced", "false");

    const options = mountMock.mock.calls[0]![1];
    expect(options.onReady).toEqual(expect.any(Function));
    act(() => options.onReady());
    expect(root).toHaveAttribute("data-enhanced", "true");
  });

  it("pauses and resumes for the external assistant state", async () => {
    const view = render(createElement(HeroPortrait, { paused: false }));
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    const root = screen.getByTestId("hero-portrait");

    view.rerender(createElement(HeroPortrait, { paused: true }));
    expect(root).toHaveAttribute("data-paused", "true");
    view.rerender(createElement(HeroPortrait, { paused: false }));
    expect(root).toHaveAttribute("data-paused", "false");
    expect(mountMock).toHaveBeenCalledTimes(1);
  });

  it("exposes offscreen and hidden-document pause state", async () => {
    render(createElement(HeroPortrait));
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    const root = screen.getByTestId("hero-portrait");
    act(() => {
      intersectionCallback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(root).toHaveAttribute("data-paused", "true");
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(root).toHaveAttribute("data-paused", "true");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("restores the static portrait and removes WebGL after context loss", async () => {
    render(createElement(HeroPortrait));
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    act(() => mountMock.mock.calls[0]![1].onContextLoss());
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("hero-portrait")).toHaveAttribute(
      "data-enhanced",
      "false",
    );
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
  });
});

describe("client-only renderer contracts", () => {
  it("loads Three.js only behind ClientOnly and a dynamic engine import", () => {
    const source = readFileSync(resolve("src/components/hero-portrait.tsx"), "utf8");
    expect(source).toContain("ClientOnly");
    expect(source).toMatch(
      /import\(\s*"@\/components\/particle-face-engine"\s*\)/,
    );
    expect(source).not.toMatch(/from ["']three["']/);
    expect(source).toContain("addEventListener");
    expect(source).toContain("visibilitychange");
  });

  it("gates rendering on wrapper pause state and announces readiness after a frame", () => {
    const source = readFileSync(
      resolve("src/components/particle-face-engine.ts"),
      "utf8",
    );
    expect(source).toContain('attributeFilter: ["data-paused"]');
    expect(source).toContain("renderer.render(scene, camera);");
    expect(source).toMatch(/renderer\.render\(scene, camera\);[\s\S]*onReady\(\)/);
  });

  it("caps DPR and disposes every owned Three.js resource", () => {
    const source = readFileSync(
      resolve("src/components/particle-face-engine.ts"),
      "utf8",
    );
    expect(source).toContain("Math.min(window.devicePixelRatio");
    expect(source).toContain("count <= 1500 ? 1.5 : 2");
    expect(source).toContain("new THREE.BufferGeometry");
    expect(source).toContain("new THREE.Points");
    expect(source).toContain("geometry.dispose()");
    expect(source).toContain("material.dispose()");
    expect(source).toContain("renderer.dispose()");
    expect(source).toContain("cancelAnimationFrame");
    expect(source).toContain("webglcontextlost");
  });
});
