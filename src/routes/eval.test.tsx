import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { golden } from "@/lib/golden";
import type { EvalResult } from "./api/eval";
import { Route } from "./eval";

const mocks = vi.hoisted(() => ({ listEvalRuns: vi.fn(), fetch: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/eval.functions", () => ({ listEvalRuns: mocks.listEvalRuns }));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

const EvalPage = Route.options.component!;
const first = golden[0]!;
const result: EvalResult = {
  id: first.id,
  question: first.question,
  answer: "AI BotKit uses hybrid retrieval and rerank in production.",
  retrieved: [...first.expectedChunks],
  expected: [...first.expectedChunks],
  recall: 1,
  mrr: 1,
  facts: 1,
  missing: [],
  citeCoverage: 1,
  citations: 2,
  invalidCitations: 0,
  quality: 1,
  latency: { retrieve: 25, firstToken: 120, total: 900 },
};
const summary = {
  cases: 1,
  quality: 1,
  facts: 1,
  citeCoverage: 1,
  recall: 1,
  mrr: 1,
  latencyAvg: 900,
  latencyP95: 900,
  firstTokenAvg: 120,
};
const savedRun = {
  id: "run-1",
  model: "test-model",
  created_at: "2026-11-09T00:00:00Z",
  summary: JSON.stringify(summary),
  results: JSON.stringify([result]),
};

function renderEval() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EvalPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.listEvalRuns.mockResolvedValue([savedRun]);
});

describe("EvalPage", () => {
  it("provides a labelled results scroll region and keyboard-operable case details", async () => {
    renderEval();
    const region = await screen.findByRole("region", { name: "Golden case results" });
    expect(region).toHaveClass("overflow-x-auto");
    expect(region).toHaveAttribute("tabindex", "0");

    const trigger = await within(region).findByRole("button", {
      name: `Details for ${first.question}`,
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(region).getByText(/AI BotKit uses hybrid retrieval/)).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: " " });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves run and stop actions with request cancellation", async () => {
    mocks.fetch.mockImplementation(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    renderEval();

    fireEvent.click(await screen.findByRole("button", { name: "Run evaluation" }));
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/eval",
        expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Stop evaluation/ }));
    expect(await screen.findByRole("button", { name: "Run evaluation" })).toBeInTheDocument();
  });

  it("announces evaluation failures and keeps golden ordering", async () => {
    mocks.fetch.mockResolvedValue(new Response(null));
    renderEval();

    fireEvent.click(await screen.findByRole("button", { name: "Run evaluation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No response");
    const questions = screen
      .getAllByRole("button", { name: /^Details for / })
      .map((el) => el.getAttribute("aria-label"));
    expect(questions).toEqual(golden.map((g) => `Details for ${g.question}`));
  });
});
