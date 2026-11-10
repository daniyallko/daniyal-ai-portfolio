import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { InspectPanel } from "./chat-inspector";
import { AssistantMessage } from "./chat-message";
import type { Msg } from "./chat-types";

const message: Msg = {
  id: "answer-1",
  role: "assistant",
  content: "Answer [1] [2]",
  sources: [
    {
      n: 1,
      id: "project-atlas",
      section: "Projects",
      title: "Project Atlas",
      text: "Atlas details",
    },
    { n: 2, id: "stack-rag", section: "Stack", title: "Advanced RAG", text: "RAG details" },
  ],
  debug: {
    model: "test-model",
    query: "atlas",
    timingsMs: { retrieve: 12 },
    candidates: [
      {
        id: "project-atlas",
        title: "Project Atlas",
        bm25: 4,
        dense: 3,
        bm25Rank: 1,
        denseRank: 1,
        rrf: 0.03,
        kept: true,
      },
    ],
  },
};

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
function mockViewport(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches,
    media: "(max-width: 1023px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("InspectPanel", () => {
  it("keeps production inspection on sources without retrieval internals", () => {
    vi.stubEnv("DEV", false);
    render(<InspectPanel m={message} tab="dev" setTab={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Atlas details")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "dev mode" })).not.toBeInTheDocument();
    expect(screen.queryByText("test-model")).not.toBeInTheDocument();
    expect(screen.queryByText(/hybrid ranking/)).not.toBeInTheDocument();
  });

  it("uses dialog semantics, a mobile full-screen layout, and focused sources", () => {
    render(<InspectPanel m={message} tab="sources" focus={2} setTab={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Answer inspection" });
    expect(dialog).toHaveClass("inset-0", "lg:static");
    expect(screen.getByText("RAG details").closest("[data-source]")).toHaveAttribute(
      "data-focused",
      "true",
    );
    expect(screen.getByText("Atlas details").closest("[data-source]")).toHaveAttribute(
      "data-focused",
      "false",
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("switches to development details and closes", () => {
    const setTab = vi.fn();
    const onClose = vi.fn();
    render(<InspectPanel m={message} tab="sources" setTab={setTab} onClose={onClose} />);
    fireEvent.click(screen.getByRole("tab", { name: "dev mode" }));
    expect(setTab).toHaveBeenCalledWith("dev");
    fireEvent.click(screen.getByRole("button", { name: "Close inspection" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders development values and an empty-source state", () => {
    const view = render(<InspectPanel m={message} tab="dev" setTab={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("test-model")).toBeInTheDocument();
    expect(screen.getByText("hybrid ranking · BM25 + dense → RRF (k=60)")).toBeInTheDocument();
    view.rerender(
      <InspectPanel
        m={{ ...message, sources: [] }}
        tab="sources"
        setTab={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("No sources were retrieved.")).toBeInTheDocument();
  });

  it("preserves the citation DOM and restores focus through the real message renderer", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <AssistantMessage
            m={message}
            onCite={() => setOpen(true)}
            onDev={vi.fn()}
            onSpeak={vi.fn()}
            speakState="idle"
            speakDisabled={false}
          />
          {open && (
            <InspectPanel
              m={message}
              tab="sources"
              setTab={vi.fn()}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      );
    }
    const view = render(<Harness />);
    const citation = view.container.querySelector<HTMLButtonElement>(".chat-citation")!;
    citation.focus();
    fireEvent.click(citation);
    expect(screen.getByRole("button", { name: "Close inspection" })).toHaveFocus();
    expect(view.container.querySelector(".chat-citation")).toBe(citation);

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Answer inspection" }), { key: "Escape" });
    expect(citation).toHaveFocus();
  });

  it("contains mobile keyboard focus, closes on Escape, and restores the invoking control", () => {
    mockViewport(true);
    const onClose = vi.fn();
    const view = render(<button type="button">Citation trigger</button>);
    const trigger = screen.getByRole("button", { name: "Citation trigger" });
    trigger.focus();
    view.rerender(
      <>
        <button type="button">Citation trigger</button>
        <InspectPanel m={message} tab="sources" setTab={vi.fn()} onClose={onClose} />
      </>,
    );

    const dialog = screen.getByRole("dialog", { name: "Answer inspection" });
    const close = screen.getByRole("button", { name: "Close inspection" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(screen.getByRole("tab", { name: "sources" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();

    view.rerender(<button type="button">Citation trigger</button>);
    expect(trigger).toHaveFocus();
  });

  it("makes mobile inspection modal and isolates then restores background controls", () => {
    mockViewport(true);
    const view = render(<button type="button">Background citation</button>);
    const trigger = screen.getByRole("button", { name: "Background citation" });
    view.rerender(
      <>
        <button type="button">Background citation</button>
        <InspectPanel m={message} tab="sources" setTab={vi.fn()} onClose={vi.fn()} />
      </>,
    );

    const dialog = screen.getByRole("dialog", { name: "Answer inspection" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(trigger).toHaveAttribute("inert");

    view.rerender(<button type="button">Background citation</button>);
    expect(trigger).not.toHaveAttribute("inert");
  });

  it("keeps desktop inspection docked without modal semantics or inert background", () => {
    mockViewport(false);
    render(
      <>
        <button type="button">Background citation</button>
        <InspectPanel m={message} tab="sources" setTab={vi.fn()} onClose={vi.fn()} />
      </>,
    );
    expect(screen.getByRole("dialog", { name: "Answer inspection" })).not.toHaveAttribute(
      "aria-modal",
    );
    expect(screen.getByRole("button", { name: "Background citation" })).not.toHaveAttribute(
      "inert",
    );
  });

  it("makes hybrid ranking keyboard-scrollable with an accessible region name", () => {
    render(<InspectPanel m={message} tab="dev" setTab={vi.fn()} onClose={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Hybrid retrieval ranking" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("overflow-x-auto");
    expect(region.querySelector("table")).toBeInTheDocument();
  });
});
