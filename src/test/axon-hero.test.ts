import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxonHero } from "@/components/axon-hero";

const { mountMock, disposeMock } = vi.hoisted(() => ({
  mountMock: vi.fn(),
  disposeMock: vi.fn(),
}));

vi.mock("@/components/axon-field-engine", () => ({
  mountAxonField: (
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
  Object.defineProperty(document, "readyState", { configurable: true, value: "complete" });
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

function engage(pointerType = "mouse", eventType: "move" | "down" = "move") {
  const root = screen.getByTestId("axon-hero");
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 1440,
    bottom: 900,
    width: 1440,
    height: 900,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  if (eventType === "down") {
    fireEvent.pointerDown(window, { clientX: 720, clientY: 450, pointerType });
  } else {
    fireEvent.pointerMove(window, { clientX: 720, clientY: 450, pointerType });
  }
}

function renderEngaged(props: { paused?: boolean } = {}) {
  const view = render(createElement(AxonHero, props));
  engage();
  return view;
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

describe("AxonHero lifecycle", () => {
  it("activates automatically after the idle prefetch without pointer intent", async () => {
    let idle: IdleRequestCallback | undefined;
    const requestIdle = vi.fn((callback: IdleRequestCallback) => {
      idle = callback;
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", requestIdle);
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    render(createElement(AxonHero));
    await act(async () => Promise.resolve());
    expect(mountMock).not.toHaveBeenCalled();
    expect(requestIdle).toHaveBeenCalledTimes(1);

    await act(async () => {
      idle?.({ didTimeout: false, timeRemaining: () => 50 });
      await Promise.resolve();
    });
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-enhanced", "true");
  });

  it("mounts immediately on touch intent inside the hero", async () => {
    coarsePointer = true;
    render(createElement(AxonHero));
    expect(mountMock).not.toHaveBeenCalled();
    engage("touch", "down");
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    expect(mountMock.mock.calls[0]![1].count).toBe(16384);
    expect(mountMock.mock.calls[0]![1]).toEqual(
      expect.objectContaining({
        simulationSize: 256,
        dyeSize: 512,
        pressureIterations: 5,
        pixelRatio: 1,
        frameRate: 60,
      }),
    );
  });

  it("keeps a static portrait and never enhances for reduced motion", () => {
    reducedMotion = true;
    renderEngaged();
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-enhanced", "false");
    const fallbacks = screen.getAllByRole("presentation", { hidden: true });
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]).toHaveClass("axon-hero__fallback");
    expect(mountMock).not.toHaveBeenCalled();
  });

  it("mounts one eligible desktop renderer and disposes it on unmount", async () => {
    const { unmount } = renderEngaged();
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    expect(mountMock.mock.calls[0]![1].count).toBe(262144);
    expect(mountMock.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ pressureIterations: 5, pixelRatio: 1.25, frameRate: 60 }),
    );
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-enhanced", "true");
    unmount();
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).toHaveBeenCalled();
  });

  it("uses the mobile budget for coarse pointers", async () => {
    coarsePointer = true;
    renderEngaged();
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    expect(mountMock.mock.calls[0]![1].count).toBe(16384);
    expect(mountMock.mock.calls[0]![1]).toEqual(
      expect.objectContaining({
        simulationSize: 256,
        dyeSize: 512,
        pressureIterations: 5,
        pixelRatio: 1,
        frameRate: 60,
      }),
    );
  });

  it("disposes a live renderer when reduced data changes", async () => {
    renderEngaged();
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    act(() => {
      reducedData = true;
      changeMedia("(prefers-reduced-data: reduce)");
    });
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-enhanced", "false");
  });

  it("disposes and restores the renderer on live save-data changes", async () => {
    renderEngaged();
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));

    act(() => {
      connection.saveData = true;
      connection.dispatchEvent(new Event("change"));
    });
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-budget", "0");
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-enhanced", "false");

    act(() => {
      connection.saveData = false;
      connection.dispatchEvent(new Event("change"));
    });
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-budget", "262144");
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-enhanced", "true");
  });

  it("keeps the static fallback until the engine reports its first ready frame", async () => {
    autoReady = false;
    renderEngaged();
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    const root = screen.getByTestId("axon-hero");
    expect(root).toHaveAttribute("data-enhanced", "false");

    const options = mountMock.mock.calls[0]![1];
    expect(options.onReady).toEqual(expect.any(Function));
    act(() => options.onReady());
    expect(root).toHaveAttribute("data-enhanced", "true");
  });

  it("pauses and resumes for the external assistant state", async () => {
    const view = renderEngaged({ paused: false });
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    const root = screen.getByTestId("axon-hero");

    view.rerender(createElement(AxonHero, { paused: true }));
    expect(root).toHaveAttribute("data-paused", "true");
    view.rerender(createElement(AxonHero, { paused: false }));
    expect(root).toHaveAttribute("data-paused", "false");
    expect(mountMock).toHaveBeenCalledTimes(1);
  });

  it("exposes offscreen and hidden-document pause state", async () => {
    renderEngaged();
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    const root = screen.getByTestId("axon-hero");
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
    renderEngaged();
    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    act(() => mountMock.mock.calls[0]![1].onContextLoss());
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("axon-hero")).toHaveAttribute("data-enhanced", "false");
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
  });
});

describe("client-only renderer contracts", () => {
  it("loads Three.js only behind ClientOnly and a dynamic engine import", () => {
    const source = readFileSync(resolve("src/components/axon-hero.tsx"), "utf8");
    expect(source).toContain("ClientOnly");
    expect(source).toMatch(/import\(\s*"@\/components\/axon-field-engine"\s*\)/);
    expect(source).not.toMatch(/from ["']three["']/);
    expect(source).toContain("addEventListener");
    expect(source).toContain("visibilitychange");
  });

  it("gates rendering on wrapper pause state and announces readiness after a frame", () => {
    const source = readFileSync(resolve("src/components/axon-field-engine.ts"), "utf8");
    expect(source).toContain('attributeFilter: ["data-paused"]');
    expect(source).toContain("renderer.render(scene, camera);");
    expect(source).toMatch(/renderer\.render\(scene, camera\);[\s\S]*onReady\(\)/);
  });

  it("places one rendered static ring behind all hero content in both themes", () => {
    const css = readFileSync(resolve("src/styles.css"), "utf8");
    const hero = readFileSync(resolve("src/components/home-hero.tsx"), "utf8");
    expect(css).toMatch(
      /\.axon-hero\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*z-index:\s*0;/s,
    );
    expect(css).toMatch(
      /\.axon-hero__fallback\s*\{[^}]*background-image:\s*url\("\/images\/axon-ring\.webp"\);/s,
    );
    expect(css).toContain("background-size: auto 100%;");
    expect(css).toMatch(
      /\[data-theme="dark"\] \.axon-hero__fallback\s*\{[^}]*axon-ring-dark\.webp/s,
    );
    expect(css).toMatch(
      /@media \(max-aspect-ratio: 3\/5\)\s*\{[^}]*\.axon-hero__fallback[^}]*axon-ring-narrow\.webp/s,
    );
    expect(css).toMatch(
      /@media \(max-aspect-ratio: 3\/5\)\s*\{[\s\S]*?\[data-theme="dark"\] \.axon-hero__fallback[^}]*axon-ring-narrow-dark\.webp/,
    );
    expect(css).toMatch(/\.hero-copy::before\s*\{[^}]*background:/s);
    expect(hero).toContain('className="hero-visual relative hidden lg:block lg:min-h-[36rem]"');
    expect(css).toMatch(/\.hero-copy\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*2;/s);
    expect(hero.indexOf("<AxonHero")).toBeLessThan(hero.indexOf('className="hero-copy'));
    expect(hero).not.toContain("generic-face");
  });

  it("preloads the matching rendered fallback with the initial document", () => {
    const source = readFileSync(resolve("src/routes/__root.tsx"), "utf8");
    for (const name of [
      "axon-ring",
      "axon-ring-dark",
      "axon-ring-narrow",
      "axon-ring-narrow-dark",
    ]) {
      expect(source).toContain(`href: "/images/${name}.webp"`);
    }
    expect(source).toContain('rel: "preload"');
    expect(source).toContain('as: "image"');
    expect(source).toMatch(
      /href: "\/images\/axon-ring\.webp",\s*as: "image"/,
    );
    expect(source).toMatch(
      /href: "\/images\/axon-ring-narrow\.webp",\s*as: "image"/,
    );
    expect(source).toContain('media: "(min-aspect-ratio: 3/5) and (prefers-color-scheme: light)"');
    expect(source).toContain('media: "(max-aspect-ratio: 3/5) and (prefers-color-scheme: dark)"');
  });

  it("caps DPR and disposes every owned Three.js resource", () => {
    const source = readFileSync(resolve("src/components/axon-field-engine.ts"), "utf8");
    expect(source).toContain("Math.min(window.devicePixelRatio");
    expect(source).toContain("Math.min(window.devicePixelRatio || 1, pixelRatio)");
    expect(source).toContain("const frameInterval = 1000 / frameRate");
    expect(source).toContain("new THREE.BufferGeometry");
    expect(source).toContain("new THREE.Points");
    expect(source).toContain("geometry.dispose()");
    expect(source).toContain("material.dispose()");
    expect(source).toContain("renderer.dispose()");
    expect(source).toContain("cancelAnimationFrame");
    expect(source).toContain("webglcontextlost");
  });
});
