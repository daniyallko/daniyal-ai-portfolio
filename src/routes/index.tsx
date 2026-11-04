import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import { profile, stats, experience, projects, skills, education } from "@/lib/portfolio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mohd Daniyal — Full Stack AI Engineer | Agentic AI, RAG, Voice AI" },
      { name: "description", content: "Mohd Daniyal builds production agentic AI, advanced RAG and voice AI. Ask his AI assistant anything about his work." },
      { property: "og:title", content: "Mohd Daniyal — Full Stack AI Engineer" },
      { property: "og:description", content: "Agentic AI, advanced RAG and voice AI engineer. 5+ years, AI BotKit on 1,000+ websites." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const cell = "bg-background p-6";
const label = "font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

function SectionHead({ n, title, meta }: { n: string; title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border px-6 py-3 font-mono text-xs">
      <span><span className="text-primary">{n}</span> <span className="text-foreground">{title}</span></span>
      {meta && <span className="text-muted-foreground">{meta}</span>}
    </div>
  );
}

// Co-browsing actions from the assistant: /?hl=<element id> or /?skill=<tech>.
function useCoBrowse() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const hl = q.get("hl");
    const skill = q.get("skill")?.toLowerCase();
    const targets: Element[] = [];
    if (hl) { const el = document.getElementById(hl); if (el) targets.push(el); }
    if (skill) {
      document.querySelectorAll<HTMLElement>("[data-skill]").forEach((el) => {
        if (el.dataset.skill!.toLowerCase().includes(skill) || el.dataset.group!.toLowerCase().includes(skill)) targets.push(el);
      });
    }
    if (!targets.length) return;
    targets[0]!.scrollIntoView({ behavior: "smooth", block: "center" });
    targets.forEach((el) => el.classList.add("hl-pulse"));
    const t = setTimeout(() => targets.forEach((el) => el.classList.remove("hl-pulse")), 3200);
    return () => clearTimeout(t);
  }, []);
}

function Index() {
  useCoBrowse();
  const featured = projects.find((p) => p.featured)!;
  const others = projects.filter((p) => !p.featured);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 font-mono text-xs">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 bg-primary" />
            <span className="text-foreground">daniyal</span>
            <span className="text-muted-foreground">/ portfolio — v2026.11</span>
          </span>
          <nav className="flex items-center gap-6 text-muted-foreground">
            <a href="#work" className="hover:text-foreground">work</a>
            <a href="#log" className="hover:text-foreground">log</a>
            <a href="#stack" className="hover:text-foreground">stack</a>
            <Link to="/chat" className="border border-primary px-3 py-1 text-primary hover:bg-primary hover:text-primary-foreground">ask_ai() →</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl border-x border-border">
        {/* Hero */}
        <section className="grid border-b border-border md:grid-cols-[1fr_340px]">
          <div className="border-b border-border p-6 md:border-b-0 md:border-r md:p-10">
            <p className={label}>$ whoami</p>
            <h1 className="mt-6 text-6xl font-bold leading-[0.9] tracking-[-0.04em] md:text-8xl">
              {profile.name.split(" ").map((w, i) => <span key={w} className="block">{w}{i === 1 && <span className="text-primary">.</span>}</span>)}
            </h1>
            <p className="mt-8 font-mono text-sm text-primary">{profile.title}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{profile.tagline}</p>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{profile.summary}</p>
          </div>
          <div className="flex flex-col font-mono text-xs">
            <dl id="contact" className="divide-y divide-border border-b border-border">
              {[
                ["location", profile.location],
                ["status", profile.availability],
                ["email", profile.email],
                ["phone", profile.phone],
                ["edu", `${education.degree}`],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[72px_1fr] gap-2 px-5 py-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-words text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            <Link to="/chat" className="group flex flex-1 flex-col justify-between p-5 hover:bg-accent">
              <div>
                <p className={label}>recruiter_assistant</p>
                <p className="mt-3 font-sans text-xl font-semibold text-foreground">Interrogate my résumé.</p>
                <p className="mt-2 text-muted-foreground">Hybrid BM25 + vector retrieval, cited answers, voice mode.</p>
              </div>
              <div className="mt-5 border border-border bg-card px-3 py-2 text-muted-foreground">
                <span className="text-primary">&gt;</span> what RAG systems has he shipped?
                <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />
              </div>
              <span className="mt-4 flex items-center gap-1 text-primary">open session <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
            </Link>
          </div>
        </section>

        {/* Metrics */}
        <section className="grid grid-cols-2 gap-px border-b border-border bg-border md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`${cell} py-5`}>
              <p className="font-mono text-[10px] text-muted-foreground">M{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Work */}
        <section id="work" className="border-b border-border">
          <SectionHead n="01" title="selected_work" meta={`${projects.length} entries`} />
          <article id={`proj-${featured.id}`} className="grid gap-px bg-border md:grid-cols-[1fr_1fr]">
            <div className={`${cell} md:p-8`}>
              <p className="font-mono text-xs text-primary">★ featured · {featured.kind}</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight">{featured.name}</h2>
              <p className="mt-4 text-lg leading-snug">{featured.blurb}</p>
            </div>
            <div className={`${cell} md:p-8`}>
              <p className="text-sm leading-relaxed text-muted-foreground">{featured.details}</p>
              <Tags tags={featured.tags} />
            </div>
          </article>
          <ol className="divide-y divide-border border-t border-border">
            {others.map((p, i) => (
              <li key={p.id} id={`proj-${p.id}`} className="grid gap-2 px-6 py-5 transition-colors hover:bg-card md:grid-cols-[48px_220px_1fr_auto] md:items-baseline md:gap-6">
                <span className="font-mono text-xs text-muted-foreground">{String(i + 2).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="font-mono text-[11px] text-muted-foreground">{p.kind}</p>
                </div>
                <p className="text-sm text-muted-foreground">{p.blurb}</p>
                <div className="flex flex-wrap gap-1 md:justify-end">
                  {p.tags.slice(0, 3).map((t) => <Tag key={t} t={t} />)}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Experience log */}
        <section id="log" className="border-b border-border">
          <SectionHead n="02" title="experience.log" meta={`${experience.length} roles`} />
          <div className="divide-y divide-border">
            {experience.map((e) => (
              <div key={e.id} className="grid gap-4 px-6 py-6 md:grid-cols-[200px_1fr]">
                <div className="font-mono text-xs">
                  <p className="text-muted-foreground">{e.period}</p>
                  <p className="mt-1 text-primary">@{e.company}</p>
                </div>
                <div>
                  <h3 className="font-semibold">{e.role}</h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {e.bullets.slice(0, 3).map((b) => (
                      <li key={b} className="grid grid-cols-[16px_1fr]"><span className="font-mono text-primary">–</span>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section id="stack" className="border-b border-border">
          <SectionHead n="03" title="stack" />
          <div className="grid gap-px bg-border md:grid-cols-4">
            {skills.map((s) => (
              <div key={s.group} className={cell}>
                <p className={label}>{s.group}</p>
                <ul className="mt-4 space-y-1 font-mono text-xs text-foreground">
                  {s.items.map((i) => <li key={i} data-skill={i} data-group={s.group}><span className="text-muted-foreground">·</span> {i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 font-mono text-xs text-muted-foreground">
          <span>{education.school} · {education.period}</span>
          <span className="flex gap-5">
            <a href={`mailto:${profile.email}`} className="hover:text-primary">email</a>
            <a href={profile.website} target="_blank" rel="noreferrer" className="hover:text-primary">website ↗</a>
            <Link to="/chat" className="text-primary">ask_ai()</Link>
          </span>
        </footer>
      </main>
    </div>
  );
}

function Tag({ t }: { t: string }) {
  return <span className="border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{t}</span>;
}

function Tags({ tags }: { tags: string[] }) {
  return <div className="mt-5 flex flex-wrap gap-1">{tags.map((t) => <Tag key={t} t={t} />)}</div>;
}
