import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function WhyThisDisclosure({
  summary,
  children,
  className = "",
}: {
  summary: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group rounded-2xl border border-border bg-surface/70 ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-5">
        <span>{summary}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-border">{children}</div>
    </details>
  );
}
