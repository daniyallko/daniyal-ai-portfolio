import ReactMarkdown from "react-markdown";
import { useRef, type ComponentProps } from "react";
import { Bug, Loader2, Pause, Volume2 } from "lucide-react";
import type { Msg } from "./chat-types";

type MarkdownComponents = NonNullable<ComponentProps<typeof ReactMarkdown>["components"]>;

export function AssistantMessage({
  m,
  onCite,
  onDev,
  onAsk,
  onSpeak,
  speakState,
  speakDisabled,
}: {
  m: Msg;
  onCite: (n: number) => void;
  onDev: () => void;
  onAsk?: (question: string) => void;
  onSpeak: () => void;
  speakState: "idle" | "loading" | "playing";
  speakDisabled: boolean;
}) {
  const md = linkifyContacts(m.content.replace(/\[(\d+)\](?!\()/g, "[$1](#cite-$1)"));
  const canSpeak = m.content.trim().length > 0;
  const latest = useRef({ m, onCite, onAsk });
  latest.current = { m, onCite, onAsk };
  const components = useRef<MarkdownComponents | null>(null);
  if (!components.current) {
    components.current = {
      pre: ({ children }) => (
        <div
          role="region"
          aria-label="Code block"
          tabIndex={0}
          className="max-w-full min-w-0 overflow-x-auto rounded-sm border border-hairline bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <pre className="m-0 min-w-max p-4">{children}</pre>
        </div>
      ),
      a: ({ href, children }) => {
        const n = href?.startsWith("#cite-") ? Number(href.slice(6)) : null;
        if (n == null && href === "#ask") {
          const label = flatText(children);
          return (
            <button
              type="button"
              onClick={() => latest.current.onAsk?.(label)}
              className="not-prose my-0.5 inline-flex min-h-10 items-center rounded-sm border border-hairline px-3 text-left text-sm text-foreground transition-colors hover:border-primary hover:text-signal focus-visible:outline-2 focus-visible:outline-primary"
            >
              {children}
            </button>
          );
        }
        if (n == null && href === "/api/public/resume")
          return (
            <a
              href={href}
              download
              className="not-prose my-1 inline-flex min-h-10 items-center gap-2 rounded-sm border border-primary px-3 font-mono text-xs text-signal no-underline transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              ↓ {children}
            </a>
          );
        if (n == null && (href?.startsWith("mailto:") || href?.startsWith("tel:")))
          return (
            <a href={href} className="text-signal underline decoration-hairline underline-offset-4 hover:decoration-signal">
              {children}
            </a>
          );
        if (n == null)
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-signal underline decoration-hairline underline-offset-4 transition-colors hover:decoration-signal"
            >
              {children}
            </a>
          );
        const { m: current, onCite: cite } = latest.current;
        const src = current.sources?.find((s) => s.n === n);
        return (
          <button
            type="button"
            onClick={() => cite(n)}
            title={src?.title}
            className="chat-citation mx-1 inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-accent px-1 align-text-top font-mono text-[11px] font-bold text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {n}
          </button>
        );
      },
    };
  }
  return (
    <article className="assistant-message group relative min-w-0" aria-label="Assistant answer">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="grid h-5 w-5 place-items-center border border-hairline font-serif text-sm italic text-signal">
          d
        </span>
        <span>Portfolio intelligence</span>
      </div>
      <div
        className="prose-chat min-w-0 text-[16px] leading-[1.75] text-foreground/95"
        style={{ overflowWrap: "anywhere" }}
      >
        <ReactMarkdown components={components.current}>{md}</ReactMarkdown>
      </div>
      {m.error && (
        <p
          role="alert"
          className="mt-4 rounded-sm border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {m.error}
        </p>
      )}
      {(canSpeak || m.sources?.length || m.debug) && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
          {canSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              disabled={speakDisabled && speakState === "idle"}
              aria-label={
                speakState === "playing" ? "Stop playing this answer" : "Listen to this answer"
              }
              title={speakState === "playing" ? "Stop" : "Listen to this answer"}
              aria-pressed={speakState === "playing"}
              className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 font-mono text-[11px] transition-colors disabled:opacity-40 sm:min-h-9 ${speakState === "playing" ? "border-primary bg-accent text-accent-foreground" : "border-hairline text-muted-foreground hover:border-primary hover:text-foreground"}`}
            >
              {speakState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : speakState === "playing" ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              {speakState === "loading"
                ? "readying…"
                : speakState === "playing"
                  ? "stop"
                  : "listen"}
            </button>
          )}
          {m.sources?.map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => onCite(s.n)}
              title={s.title}
              className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-full border border-hairline px-3 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground sm:min-h-9"
            >
              <span className="text-signal">[{s.n}]</span>{" "}
              <span className="max-w-[180px] truncate">{s.title}</span>
            </button>
          ))}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={onDev}
              className="flex min-h-11 items-center gap-1.5 rounded-full px-3 font-mono text-[11px] text-muted-foreground transition-colors hover:text-signal sm:min-h-9"
            >
              <Bug className="h-3.5 w-3.5" />
              inspect
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** Turn plain owner email/phone mentions into clickable links (skips ones already inside markdown links). */
export function linkifyContacts(text: string): string {
  return text
    .replace(/(?<![[(:])daniyallko@gmail\.com(?![\]])/g, "[daniyallko@gmail.com](mailto:daniyallko@gmail.com)")
    .replace(/(?<![[(:+\d])\+?91[\s-]?7007[\s-]?644[\s-]?677(?![\]\d])/g, "[+91 7007644677](tel:+917007644677)");
}

function flatText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatText).join("");
  if (node && typeof node === "object" && "props" in node)
    return flatText((node as { props: { children?: unknown } }).props.children);
  return "";
}
