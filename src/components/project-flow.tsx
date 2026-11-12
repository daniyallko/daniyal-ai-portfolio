export function ProjectFlow({ steps }: { steps: string[] }) {
  return (
    <ol
      aria-label="System path"
      className="project-flow mt-6 space-y-3 border-t border-hairline pt-5"
    >
      {steps.map((step, index) => (
        <li
          key={step}
          className="grid grid-cols-[1.75rem_1fr] items-baseline gap-2 text-xs leading-relaxed text-muted-foreground"
        >
          <span aria-hidden="true" className="tnum font-mono text-[10px] text-signal">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
