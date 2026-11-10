import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { profile, stats, experience, projects, skills, education } from "@/lib/portfolio";
import { ThemeToggle } from "@/components/theme-toggle";
import { HomeHero } from "@/components/home-hero";
import { useInlineAssistant } from "@/hooks/use-inline-assistant";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mohd Daniyal — Full Stack AI Engineer | Agentic AI, RAG, Voice AI" },
      {
        name: "description",
        content:
          "Mohd Daniyal builds production agentic AI, advanced RAG and voice AI. Talk to his AI assistant by text or live voice.",
      },
      { property: "og:title", content: "Mohd Daniyal — Full Stack AI Engineer" },
      {
        property: "og:description",
        content:
          "Agentic AI, advanced RAG and voice AI engineer. 5+ years, AI BotKit on 1,000+ websites.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    root.classList.add("motion-ready");
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return () => root.classList.remove("motion-ready");
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -80px 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => {
      io.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);
}

// Co-browsing actions from the assistant: /?hl=<element id> or /?skill=<tech>.
function useCoBrowse() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const hl = q.get("hl");
    const skill = q.get("skill")?.toLowerCase();
    const targets: Element[] = [];
    if (hl) {
      const el = document.getElementById(hl);
      if (el) targets.push(el);
    }
    if (skill) {
      document.querySelectorAll<HTMLElement>("[data-skill]").forEach((el) => {
        if (
          el.dataset["skill"]!.toLowerCase().includes(skill) ||
          el.dataset["group"]!.toLowerCase().includes(skill)
        )
          targets.push(el);
      });
    }
    if (!targets.length) return;
    document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in"));
    targets[0]!.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
    targets.forEach((el) => el.classList.add("hl-pulse"));
    document.documentElement.dataset["cobrowseHit"] = targets
      .map((el) => el.id || (el as HTMLElement).dataset["skill"] || "")
      .join(",");
    const t = setTimeout(() => targets.forEach((el) => el.classList.remove("hl-pulse")), 3200);
    return () => clearTimeout(t);
  }, []);
}

const trackSpot = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};

function Index() {
  useCoBrowse();
  useReveal();
  const featured = projects.find((p) => p.featured)!;
  const others = projects.filter((p) => !p.featured);
  const assistant = useInlineAssistant();
  return (
    <>
      {assistant.node}
      <div
        className="relative min-h-[100dvh] overflow-x-clip"
        inert={assistant.open ? true : undefined}
        aria-hidden={assistant.open || undefined}
      >
        <header className="safe-top sticky top-0 z-30 border-b border-hairline bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 px-5 pb-3 text-sm sm:px-8 xl:px-12">
            <a href="#top" className="flex min-h-11 min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-hairline bg-card font-serif text-lg italic text-signal">
                d
              </span>
              <span className="hidden truncate font-medium tracking-[-0.02em] min-[420px]:inline">
                Mohd Daniyal
              </span>
            </a>
            <nav
              aria-label="Primary"
              className="flex items-center gap-1.5 text-muted-foreground sm:gap-4"
            >
              <a
                href="#work"
                className="hidden min-h-11 items-center px-2 py-2 transition-colors hover:text-foreground md:flex"
              >
                Work
              </a>
              <a
                href="#log"
                className="hidden min-h-11 items-center px-2 py-2 transition-colors hover:text-foreground md:flex"
              >
                Experience
              </a>
              <a
                href="#stack"
                className="hidden min-h-11 items-center px-2 py-2 transition-colors hover:text-foreground md:flex"
              >
                Stack
              </a>
              <ThemeToggle />
              <button
                type="button"
                onClick={() => assistant.go()}
                className="flex min-h-11 items-center rounded-full border border-hairline px-3.5 text-xs text-foreground transition-colors hover:border-primary hover:text-signal sm:px-4 sm:text-sm"
              >
                <span className="sm:hidden">Assistant</span>
                <span className="hidden sm:inline">Open assistant</span>
              </button>
            </nav>
          </div>
        </header>

        <main id="top" className="relative z-10">
          <HomeHero onOpen={assistant.go} />
          <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:border-x lg:border-hairline">
            <section
              aria-label="Career statistics"
              className="grid grid-cols-2 border-y border-hairline md:grid-cols-4"
            >
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  style={{ "--i": i } as React.CSSProperties}
                  className="reveal relative border-hairline px-1 py-8 odd:border-r md:border-r md:px-6 md:py-10 md:last:border-r-0"
                >
                  <span aria-hidden className="font-mono text-[10px] tracking-[0.16em] text-signal">
                    0{i + 1}
                  </span>
                  <p className="tnum mt-5 text-[clamp(2.4rem,4vw,4rem)] font-semibold leading-none tracking-[-0.055em]">
                    {s.value}
                  </p>
                  <p className="mt-3 max-w-[18ch] text-sm leading-snug text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </section>

            <section id="work" className="py-20 md:py-28">
              <SectionTitle
                index="01"
                title="Selected work"
                sub={`${projects.length} systems, from production platforms to personal builds.`}
              />
              <article
                id={`proj-${featured.id}`}
                onPointerMove={trackSpot}
                className="spot surface reveal relative mt-12 grid gap-8 overflow-hidden rounded-sm p-6 md:grid-cols-[1.2fr_0.8fr] md:p-10 lg:p-14"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-2 -top-8 font-mono text-[9rem] leading-none tracking-[-0.1em] text-foreground/[0.035]"
                >
                  01
                </span>
                <div className="relative">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
                    Featured · {featured.kind}
                  </p>
                  <h3 className="mt-5 max-w-[10ch] text-[clamp(2.8rem,5vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.06em]">
                    {featured.name}
                  </h3>
                  <p className="mt-7 max-w-[38ch] text-lg leading-snug text-foreground/90">
                    {featured.blurb}
                  </p>
                </div>
                <div className="relative md:border-l md:border-hairline md:pl-8 lg:pl-12">
                  <p className="text-[15px] leading-relaxed text-muted-foreground">
                    {featured.details}
                  </p>
                  <Tags tags={featured.tags} />
                </div>
              </article>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {others.map((p, i) => (
                  <article
                    key={p.id}
                    id={`proj-${p.id}`}
                    onPointerMove={trackSpot}
                    style={{ "--i": i } as React.CSSProperties}
                    className="spot surface reveal group flex flex-col rounded-sm p-6 transition-transform duration-300 hover:-translate-y-1 md:p-7"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {p.kind}
                      </p>
                      <span aria-hidden className="font-mono text-[10px] text-signal">
                        0{i + 2}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold tracking-tight">{p.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {p.blurb}
                    </p>
                    <Tags tags={p.tags.slice(0, 3)} />
                  </article>
                ))}
              </div>
            </section>

            <section id="log" className="border-t border-hairline py-20 md:py-28">
              <SectionTitle
                index="02"
                title="Experience"
                sub="Where the systems above were built and run."
              />
              <ol className="relative mt-12 border-l border-hairline pl-5 md:ml-2 md:pl-8">
                {experience.map((e, i) => (
                  <li
                    key={e.id}
                    style={{ "--i": i } as React.CSSProperties}
                    className="reveal relative grid gap-4 border-t border-hairline py-8 md:grid-cols-[220px_1fr] md:py-10"
                  >
                    <span
                      aria-hidden
                      className="absolute -left-[1.45rem] top-11 h-2 w-2 rounded-full bg-signal shadow-[0_0_0_5px_var(--background)] md:-left-[2.45rem]"
                    />
                    <div>
                      <p className="tnum font-mono text-xs text-muted-foreground">{e.period}</p>
                      <p className="mt-2 font-medium text-signal">{e.company}</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{e.role}</h3>
                      <ul className="mt-3 max-w-[68ch] space-y-2 text-[15px] leading-relaxed text-muted-foreground">
                        {e.bullets.slice(0, 3).map((b) => (
                          <li key={b} className="grid grid-cols-[18px_1fr]">
                            <span className="text-primary">–</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section id="stack" className="border-t border-hairline py-20 md:py-28">
              <SectionTitle
                index="03"
                title="Tech stack"
                sub="Tools used in production, grouped by where they sit."
              />
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {skills.map((s, i) => (
                  <div
                    key={s.group}
                    onPointerMove={trackSpot}
                    style={{ "--i": i } as React.CSSProperties}
                    className="spot surface reveal rounded-sm p-6"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-4">
                      <p className="text-sm font-medium text-foreground">{s.group}</p>
                      <span aria-hidden className="font-mono text-[10px] text-signal">
                        0{i + 1}
                      </span>
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {s.items.map((it) => (
                        <li
                          key={it}
                          data-skill={it}
                          data-group={s.group}
                          className="rounded-md border border-hairline px-2 py-1 font-mono text-[11px] text-muted-foreground"
                        >
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <footer
              id="contact"
              className="safe-bottom border-t border-hairline py-10 text-muted-foreground md:py-16"
            >
              <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
                    04 / Contact
                  </p>
                  <a
                    href={`mailto:${profile.email}`}
                    className="mt-5 inline-block max-w-full break-all text-[clamp(1.65rem,4vw,4rem)] font-medium leading-none tracking-[-0.045em] text-foreground underline decoration-hairline underline-offset-8 transition-colors hover:text-signal"
                  >
                    {profile.email}
                  </a>
                  <p className="mt-6 text-sm">
                    {education.degree} · {education.period}
                  </p>
                </div>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 w-fit items-center rounded-full border border-hairline px-5 text-sm text-foreground transition-colors hover:border-primary hover:text-signal"
                >
                  Website ↗
                </a>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </>
  );
}

function SectionTitle({ title, sub, index }: { title: string; sub: string; index: string }) {
  return (
    <div className="reveal grid gap-5 border-t border-hairline pt-5 md:grid-cols-[8rem_1fr]">
      <p aria-hidden className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
        {index} / Index
      </p>
      <div className="max-w-3xl">
        <h2 className="text-[clamp(2.5rem,5vw,5.5rem)] font-semibold leading-[0.9] tracking-[-0.055em]">
          {title}
        </h2>
        <p className="mt-5 max-w-[55ch] leading-relaxed text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-md border border-hairline px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
