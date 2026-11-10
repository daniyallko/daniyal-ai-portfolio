import { fireEvent, render, screen } from "@testing-library/react";
import { createElement as h, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/__root";

const mocks = vi.hoisted(() => ({ invalidate: vi.fn(), reset: vi.fn(), report: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  createRootRouteWithContext: () => (options: unknown) => ({ options }),
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) =>
    h("a", { href: to, ...props }, children),
  useRouter: () => ({ invalidate: mocks.invalidate }),
  Outlet: () => null,
  HeadContent: () => null,
  Scripts: () => null,
}));
vi.mock("@/lib/lovable-error-reporting", () => ({ reportLovableError: mocks.report }));
vi.mock("@/components/ambient-cursor-glow", () => ({ AmbientCursorGlow: () => null }));
vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => h("button", { type: "button" }, "Theme"),
}));

const NotFound = Route.options.notFoundComponent!;
const RootError = Route.options.errorComponent;
if (!RootError) throw new Error("Root error component is required");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("root recovery surfaces", () => {
  it("renders not-found recovery in a main landmark", () => {
    render(h(NotFound));
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go home/i })).toHaveAttribute("href", "/");
  });

  it("reports root errors and preserves retry plus home recovery", () => {
    const error = new Error("render failed");
    render(h(RootError, { error, reset: mocks.reset }));

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(mocks.report).toHaveBeenCalledWith(error, { boundary: "tanstack_root_error_component" });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.invalidate).toHaveBeenCalled();
    expect(mocks.reset).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /go home/i })).toHaveAttribute("href", "/");
  });
});
