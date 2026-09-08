import type { ReactNode } from "react";

export function FutureLabPanel({
  eyebrow,
  title,
  children,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`fl-panel relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface/90 p-3.5 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/45 to-transparent"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-xs font-medium tracking-tight text-foreground">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="relative mt-3 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export function FutureLabEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-border/60 bg-surface-2/45 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
