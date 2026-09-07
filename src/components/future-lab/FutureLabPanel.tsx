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
      className={`relative overflow-hidden rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88 p-4 shadow-[0_20px_70px_rgba(0,0,0,.25)] backdrop-blur-xl ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/45 to-transparent"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/75">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-sm font-semibold tracking-tight text-white">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="relative mt-3">{children}</div>
    </section>
  );
}

export function FutureLabEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-3 text-xs leading-relaxed text-slate-400">
      {children}
    </p>
  );
}
