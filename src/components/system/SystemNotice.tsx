import type { ReactNode } from "react";
import { CircleDot } from "lucide-react";
import "@/styles/system-notice.css";

/** One reusable, theme-aware operational surface; no invented live status. */
export function SystemNotice({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className="gl-system-notice border border-border bg-surface text-foreground"
      data-system-notice
    >
      <div className="gl-system-notice__eyebrow text-muted-foreground">
        <CircleDot className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{eyebrow}</span>
      </div>
      <h3 className="gl-system-notice__title">{title}</h3>
      {children ? (
        <div className="gl-system-notice__body text-muted-foreground">{children}</div>
      ) : null}
      {actions ? <div className="gl-system-notice__actions">{actions}</div> : null}
    </section>
  );
}
