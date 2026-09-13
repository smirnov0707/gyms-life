import { Link, useLocation } from "@tanstack/react-router";
import { Apple, CalendarDays, Pill } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";

const MODES = [
  { to: "/nutrition", icon: Apple, lt: "Šiandien", en: "Today" },
  { to: "/meal-plan", icon: CalendarDays, lt: "Planas", en: "Plan" },
  { to: "/supplements", icon: Pill, lt: "Papildai", en: "Supplements" },
] as const;

export function NutritionStudioNav() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const location = useLocation();
  return (
    <section className="rounded-[2rem] border border-border bg-surface/85 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 px-2 pb-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-400">
            NUTRITION INTELLIGENCE
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {english
              ? "One nutrition system, three working modes."
              : "Viena mitybos sistema, trys darbo režimai."}
          </p>
        </div>
      </div>
      <nav
        className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1"
        aria-label={english ? "Nutrition modes" : "Mitybos režimai"}
      >
        {MODES.map(({ to, icon: Icon, lt, en }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold transition-colors ${active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="size-4" />
              {english ? en : lt}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
