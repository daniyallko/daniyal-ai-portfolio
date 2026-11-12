import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "@/components/count-up";
import { ProjectFlow } from "@/components/project-flow";

const values = ["5+", "1,000+", "100k+", "99.9%", "10k+"];

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let observers: MockIntersectionObserver[];

class MockIntersectionObserver {
  constructor(readonly callback: IntersectionObserverCallback) {
    observers.push(this);
  }

  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  intersect(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function runFrame(time: number) {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(time));
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  observers = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CountUp", () => {
  it.each(values)("shows %s immediately with reduced motion", (value) => {
    render(<CountUp value={value} reducedMotion />);

    expect(screen.getByText(value, { selector: ".sr-only" })).toHaveTextContent(value);
    expect(observers).toHaveLength(0);
    expect(frames.size).toBe(0);
  });

  it("renders the final value during SSR", () => {
    const html = renderToString(<CountUp value="1,000+" reducedMotion={false} />);

    expect(html).toContain("sr-only");
    expect(html).toContain("1,000+");
  });

  it.each(values)("animates once to the exact final string %s", (value) => {
    const view = render(<CountUp value={value} reducedMotion={false} />);
    const accessibleValue = screen.getByText(value, { selector: ".sr-only" });

    act(() => observers[0]!.intersect(accessibleValue));
    act(() => runFrame(0));
    act(() => runFrame(500));
    act(() => runFrame(1200));

    expect(accessibleValue).toHaveTextContent(value);
    expect(view.container.querySelector('[aria-hidden="true"]')).toHaveTextContent(value);
    expect(frames.size).toBe(0);
    view.unmount();
  });
});

describe("ProjectFlow", () => {
  it("renders fact-derived steps in order", () => {
    const steps = ["Speech-to-text", "Streaming LLM", "Text-to-speech"];
    render(<ProjectFlow steps={steps} />);

    const flow = screen.getByRole("list", { name: "System path" });
    expect(flow).toHaveClass("project-flow");
    expect([...flow.children].map((step) => step.textContent)).toEqual([
      "01Speech-to-text",
      "02Streaming LLM",
      "03Text-to-speech",
    ]);
  });
});
