import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AmbientCursorGlow } from "./ambient-cursor-glow";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AmbientCursorGlow", () => {
  it.each(["(pointer: coarse)", "(prefers-reduced-motion: reduce)"])("does not subscribe to pointer movement when %s matches", (query) => {
    vi.stubGlobal("matchMedia", vi.fn((candidate: string) => ({ matches: candidate.includes(query) })));
    const addEventListener = vi.spyOn(window, "addEventListener");

    render(<AmbientCursorGlow />);

    expect(addEventListener).not.toHaveBeenCalledWith("pointermove", expect.any(Function), expect.anything());
  });
});
