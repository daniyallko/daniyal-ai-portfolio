import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, RotateCcw } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AmbientCursorGlow } from "@/components/ambient-cursor-glow";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { themeInitScript } from "@/lib/theme";

function RecoveryShell({
  code,
  eyebrow,
  title,
  copy,
  children,
}: {
  code: string;
  eyebrow: string;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background bg-grid px-4 py-28 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,var(--glow-a),transparent_46%)]"
        aria-hidden="true"
      />
      <header className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-3"
          aria-label="Daniyal portfolio home"
        >
          <span className="grid h-9 w-9 place-items-center border border-signal/50 bg-primary font-serif text-2xl italic text-primary-foreground">
            d
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            Mohd Daniyal / AI engineer
          </span>
        </Link>
        <ThemeToggle />
      </header>
      <section className="relative w-full max-w-2xl text-center" aria-labelledby="recovery-title">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal">{eyebrow}</p>
        <p
          className="pointer-events-none select-none font-serif text-[clamp(7rem,24vw,13rem)] leading-[0.8] tracking-[-0.06em] text-foreground/[0.07]"
          aria-hidden="true"
        >
          {code}
        </p>
        <h1
          id="recovery-title"
          className="-mt-5 font-serif text-4xl leading-tight tracking-[-0.025em] sm:-mt-8 sm:text-5xl"
        >
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
          {copy}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
      </section>
      <p className="absolute bottom-6 left-1/2 w-full -translate-x-1/2 px-4 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        Signal interrupted · route recovery available
      </p>
    </main>
  );
}

function NotFoundComponent() {
  return (
    <RecoveryShell
      code="404"
      eyebrow="Error / route not found"
      title="Page not found. Signal lost."
      copy="The page you’re looking for doesn’t exist or has moved. Return to the portfolio, or pick up the conversation with Daniyal’s AI."
    >
      <Link
        to="/"
        className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:transform-none"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Go home
      </Link>
      <Link
        to="/chat"
        className="inline-flex min-h-12 items-center justify-center gap-2 border border-hairline bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Ask Daniyal’s AI
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </RecoveryShell>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <RecoveryShell
      code="500"
      eyebrow="Error / render interrupted"
      title="This page didn’t load."
      copy="Something interrupted this view. Retry the route without losing your place, or return to the public portfolio."
    >
      <button
        type="button"
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:transform-none"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
      <a
        href="/"
        className="inline-flex min-h-12 items-center justify-center gap-2 border border-hairline bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Go home
      </a>
    </RecoveryShell>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "Mohd Daniyal — Full Stack AI Engineer" },
      {
        name: "description",
        content:
          "Portfolio of Mohd Daniyal, Full Stack AI Engineer in agentic AI, RAG and voice AI.",
      },
      { name: "author", content: "Mohd Daniyal" },
      { name: "theme-color", content: "#08090B" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      {
        rel: "preload",
        href: "/images/axon-ring.svg",
        as: "image",
        crossOrigin: "anonymous",
        media: "(min-aspect-ratio: 3/5)",
      },
      {
        rel: "preload",
        href: "/images/axon-ring-narrow.svg",
        as: "image",
        crossOrigin: "anonymous",
        media: "(max-aspect-ratio: 3/5)",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (
      !window.location.pathname.startsWith("/admin") &&
      !window.location.pathname.startsWith("/auth")
    ) {
      void import("@/lib/rag-browser").then(({ warmBrowser }) => warmBrowser());
    }
    const path = window.location.pathname;
    if (path.startsWith("/admin") || path.startsWith("/auth")) return;
    void import("@/lib/visit.functions")
      .then(async ({ trackVisit }) => {
        const { getVisitorId } = await import("@/lib/visitor");
        await trackVisit({
          data: {
            visitorId: getVisitorId(),
            path,
            referrer: document.referrer.slice(0, 500) || undefined,
            language: navigator.language,
          },
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub?.();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <AmbientCursorGlow />
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
