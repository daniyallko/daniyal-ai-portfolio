import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroBuilding } from "./hero-building";
import { BUILDING_VIEW_BOX, WINDOW_LIGHT_GROUPS } from "@/lib/hero-media";

let observerCallback: IntersectionObserverCallback;
let visibility: DocumentVisibilityState;
const observe = vi.fn();
const disconnect = vi.fn();
const originalIntersectionObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  visibility = "visible";
  observe.mockClear();
  disconnect.mockClear();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "0px";
      thresholds = [0];
    },
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: originalIntersectionObserver,
  });
});

describe("HeroBuilding", () => {
  it("uses one eager local image and shared geometrically aligned media frame", () => {
    const { container } = render(<HeroBuilding />);
    const root = screen.getByTestId("hero-building");
    const images = container.querySelectorAll("img");
    const image = images[0]!;
    const frame = screen.getByTestId("hero-building-frame");
    const svg = screen.getByTestId("window-lights");

    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveStyle({ pointerEvents: "none" });
    expect(images).toHaveLength(1);
    expect(image).toHaveAttribute("src", "/images/noir-building-1800.jpg");
    expect(image).toHaveAttribute("width", "1800");
    expect(image).toHaveAttribute("height", "1200");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveStyle({ objectFit: "cover", objectPosition: "50% 50%" });
    expect(frame).toContainElement(image);
    expect(frame).toContainElement(svg);
    expect(svg).toHaveAttribute("viewBox", BUILDING_VIEW_BOX);
    expect(svg).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");
    expect(container.querySelector('source[type="image/avif"]')).toHaveAttribute("srcset", expect.stringContaining("noir-building-900.avif"));
    expect(container.querySelector('source[type="image/webp"]')).toHaveAttribute("srcset", expect.stringContaining("noir-building-1800.webp"));
    expect(container.querySelector('source[media*="prefers-reduced-data"]')).toHaveAttribute("srcset", "/images/noir-building-900.avif");
    expect(container.innerHTML).not.toContain("unsplash.com");
  });

  it("renders every traced window and pointer-inert sunlight without percentages", () => {
    const { container } = render(<HeroBuilding />);
    const polygons = container.querySelectorAll("#window-lights polygon");
    const expected = WINDOW_LIGHT_GROUPS.flatMap((group) => group.polygons);

    expect(polygons).toHaveLength(expected.length);
    polygons.forEach((polygon, index) => {
      expect(polygon).toHaveAttribute("points", expected[index]!.map((point) => point.join(",")).join(" "));
    });
    expect(screen.getByTestId("sunlight")).toHaveStyle({ pointerEvents: "none" });
  });

  it("pauses ambient effects offscreen and while the document is hidden", () => {
    const { unmount } = render(<HeroBuilding />);
    const root = screen.getByTestId("hero-building");
    expect(observe).toHaveBeenCalledWith(root);
    expect(root).toHaveAttribute("data-paused", "false");

    act(() => observerCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(root).toHaveAttribute("data-paused", "true");
    act(() => observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(root).toHaveAttribute("data-paused", "false");

    visibility = "hidden";
    fireEvent(document, new Event("visibilitychange"));
    expect(root).toHaveAttribute("data-paused", "true");
    visibility = "visible";
    fireEvent(document, new Event("visibilitychange"));
    expect(root).toHaveAttribute("data-paused", "false");

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
