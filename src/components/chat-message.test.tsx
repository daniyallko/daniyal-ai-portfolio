import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantMessage } from "./chat-message";
import type { Msg } from "./chat-types";

const sources = [
  { n: 1, id: "project-atlas", section: "Projects", title: "Project Atlas", text: "Atlas details" },
  { n: 2, id: "stack-rag", section: "Stack", title: "Advanced RAG", text: "RAG details" },
];

function message(content = "Alpha [1] beta [2]"): Msg {
  return { id: "answer-1", role: "assistant", content, sources, debug: { model: "test-model" } };
}

afterEach(() => vi.unstubAllEnvs());

describe("AssistantMessage", () => {
  it("hides development inspection in production while preserving sources", () => {
    vi.stubEnv("DEV", false);
    render(
      <AssistantMessage
        m={message()}
        onCite={vi.fn()}
        onDev={vi.fn()}
        onSpeak={vi.fn()}
        speakState="idle"
        speakDisabled={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "inspect" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Project Atlas/ })).toBeInTheDocument();
  });

  it("wraps long content and preserves citations and external links", () => {
    const onCite = vi.fn();
    const long = "x".repeat(600);
    const { container } = render(
      <AssistantMessage
        m={message(`${long} [1] then [2] [engineering](https://example.com)`)}
        onCite={onCite}
        onDev={vi.fn()}
        onSpeak={vi.fn()}
        speakState="idle"
        speakDisabled={false}
      />,
    );

    expect(container.querySelector(".prose-chat")).toHaveStyle({ overflowWrap: "anywhere" });
    const external = screen.getByRole("link", { name: "engineering" });
    expect(external).toHaveAttribute("href", "https://example.com");
    expect(external).toHaveAttribute("target", "_blank");
    fireEvent.click(screen.getByRole("button", { name: /^1$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^2$/ }));
    expect(onCite.mock.calls).toEqual([[1], [2]]);
    expect(screen.getByRole("button", { name: /Project Atlas/ })).toHaveTextContent(
      "Project Atlas",
    );
  });

  it("gives fenced code a bounded labelled keyboard scroll region", () => {
    render(
      <AssistantMessage
        m={message("```ts\nconst answer = 'a very long line of code';\n```")}
        onCite={vi.fn()}
        onDev={vi.fn()}
        onSpeak={vi.fn()}
        speakState="idle"
        speakDisabled={false}
      />,
    );
    const region = screen.getByRole("region", { name: "Code block" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("max-w-full", "overflow-x-auto");
    expect(region.querySelector("pre code")).toHaveClass("language-ts");
  });

  it("exposes loading, playing, and disabled listen states", () => {
    const onSpeak = vi.fn();
    const view = render(
      <AssistantMessage
        m={message()}
        onCite={vi.fn()}
        onDev={vi.fn()}
        onSpeak={onSpeak}
        speakState="loading"
        speakDisabled={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Listen to this answer" })).toHaveTextContent(
      "readying…",
    );
    view.rerender(
      <AssistantMessage
        m={message()}
        onCite={vi.fn()}
        onDev={vi.fn()}
        onSpeak={onSpeak}
        speakState="playing"
        speakDisabled={true}
      />,
    );
    const stop = screen.getByRole("button", { name: "Stop playing this answer" });
    expect(stop).toBeEnabled();
    fireEvent.click(stop);
    expect(onSpeak).toHaveBeenCalledOnce();
    view.rerender(
      <AssistantMessage
        m={message()}
        onCite={vi.fn()}
        onDev={vi.fn()}
        onSpeak={onSpeak}
        speakState="idle"
        speakDisabled={true}
      />,
    );
    expect(screen.getByRole("button", { name: "Listen to this answer" })).toBeDisabled();
  });

  it("shows answer errors without adding another listen control for empty answers", () => {
    render(
      <AssistantMessage
        m={{ id: "bad", role: "assistant", content: "", error: "Request failed" }}
        onCite={vi.fn()}
        onDev={vi.fn()}
        onSpeak={vi.fn()}
        speakState="idle"
        speakDisabled={false}
      />,
    );
    expect(screen.getByText("Request failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Listen to this answer" })).not.toBeInTheDocument();
  });
});
