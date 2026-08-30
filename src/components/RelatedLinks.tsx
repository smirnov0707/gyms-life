import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { RELATED, byRoute } from "@/lib/nav-map";
import { useI18n } from "@/lib/i18n";

/** Cross-feature footer so no page is a dead end. */
export function RelatedLinks({ from }: { from: string }) {
  const { t } = useI18n();
  const items = (RELATED[from] ?? []).map(byRoute).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("rel.title")}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item!.icon;
          return (
            <Link
              key={item!.to}
              to={item!.to}
              className="lift press group flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 transition-colors hover:border-primary/40"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="flex-1 truncate text-sm font-bold">{t(item!.key)}</span>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
