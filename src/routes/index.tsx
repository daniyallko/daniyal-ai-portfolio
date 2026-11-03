import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, MapPin, Terminal, Globe, Phone, GraduationCap } from "lucide-react";
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

const card = "rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40";
const label = "font-mono text-xs uppercase tracking-widest text-muted-foreground";

function Index() {
  const featured = projects.find((p) => p.featured)!;
  const others = projects.filter((p) => !p.featured);
  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-mono text-sm text-primary">~/daniyal</span>
        <nav className="flex items-center gap-5 font-mono text-sm text-muted-foreground">
          <a href={`mailto:${profile.email}`} className="hover:text-foreground">email</a>
          <a href={profile.website} target="_blank" rel="noreferrer" className="hover:text-foreground">website</a>
          <Link to="/chat" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90">ask_ai()</Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-20 md:grid-cols-6">
        <section className={`${card} md:col-span-4 md:row-span-2 flex flex-col justify-between`}>
          <div>
            <p className={label}>$ whoami</p>
            <h1 className="mt-4 text-5xl font-bold tracking-tight md:text-6xl">{profile.name}</h1>
            <p className="mt-2 text-xl text-primary">{profile.title}</p>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{profile.tagline}</p>
            <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">{profile.summary}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profile.location}</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{profile.availability}</span>
          </div>
        </section>

        <Link to="/chat" className={`${card} md:col-span-2 md:row-span-2 group flex flex-col justify-between bg-accent`}>
          <div>
            <Terminal className="h-7 w-7 text-primary" />
            <h2 className="mt-4 text-2xl font-semibold">Recruiter? Ask my AI.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A RAG assistant over my experience, with hybrid search and cited sources you can inspect.
            </p>
          </div>
          <div className="mt-6 rounded-md border border-border bg-background/60 p-3 font-mono text-xs text-muted-foreground">
            <span className="text-primary">&gt;</span> What RAG systems has he shipped?
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />
          </div>
          <span className="mt-4 flex items-center gap-1 font-mono text-sm text-primary">start chat <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
        </Link>

        {stats.map((s) => (
          <div key={s.label} className={`${card} md:col-span-3 lg:col-span-3 xl:col-span-3`} style={{ gridColumn: undefined }}>
            <p className="font-mono text-4xl font-bold text-primary">{s.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </div>
        )).reduce<React.ReactNode[]>((acc, el, i) => (acc.push(<div key={i} className="contents md:[&>*]:col-span-3 lg:[&>*]:col-span-3">{el}</div>), acc), [])}

        <section className={`${card} md:col-span-4`}>
          <p className={label}>featured project</p>
          <h2 className="mt-3 text-3xl font-semibold">{featured.name}</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{featured.kind}</p>
          <p className="mt-4 text-lg">{featured.blurb}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{featured.details}</p>
          <Tags tags={featured.tags} />
        </section>

        <section className={`${card} md:col-span-2`}>
          <p className={label}>contact</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><a className="flex items-center gap-2 hover:text-primary" href={`mailto:${profile.email}`}><Mail className="h-4 w-4" />{profile.email}</a></li>
            <li><a className="flex items-center gap-2 hover:text-primary" href={`tel:${profile.phone.replace(/\s/g, "")}`}><Phone className="h-4 w-4" />{profile.phone}</a></li>
            <li><a className="flex items-center gap-2 hover:text-primary" href={profile.website} target="_blank" rel="noreferrer"><Globe className="h-4 w-4" />daniyal.online</a></li>
          </ul>
          <div className="mt-6 border-t border-border pt-4">
            <p className="flex items-center gap-2 text-sm font-medium"><GraduationCap className="h-4 w-4 text-primary" />{education.degree}</p>
            <p className="mt-1 text-xs text-muted-foreground">{education.school} · {education.period}</p>
          </div>
        </section>

        {others.map((p) => (
          <section key={p.id} className={`${card} md:col-span-2`}>
            <p className="font-mono text-xs text-muted-foreground">{p.kind}</p>
            <h3 className="mt-2 text-xl font-semibold">{p.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{p.blurb}</p>
            <Tags tags={p.tags} />
          </section>
        ))}

        <section className={`${card} md:col-span-6`}>
          <p className={label}>experience</p>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            {experience.map((e) => (
              <div key={e.id} className="border-l-2 border-primary/50 pl-4">
                <p className="font-mono text-xs text-muted-foreground">{e.period}</p>
                <h3 className="mt-1 font-semibold">{e.role}</h3>
                <p className="text-sm text-primary">{e.company}</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {e.bullets.slice(0, 3).map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className={`${card} md:col-span-6`}>
          <p className={label}>tech stack</p>
          <div className="mt-4 grid gap-6 md:grid-cols-4">
            {skills.map((s) => (
              <div key={s.group}>
                <h3 className="text-sm font-semibold">{s.group}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.items.map((i) => <span key={i} className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground">{i}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {tags.map((t) => <span key={t} className="rounded bg-accent px-2 py-0.5 font-mono text-xs text-accent-foreground">{t}</span>)}
    </div>
  );
}
