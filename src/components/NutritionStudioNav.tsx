import { Link, useLocation } from "@tanstack/react-router";
import { Apple, CalendarDays, Pill } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";

const MODES = [
  { to: "/nutrition", icon: Apple, lt: "Žurnalas", en: "Intake" },
  { to: "/meal-plan", icon: CalendarDays, lt: "Planas", en: "Plan" },
  { to: "/supplements", icon: Pill, lt: "Papildai", en: "Supplements" },
] as const;

export function NutritionStudioNav() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const location = useLocation();
  return (
    <section className="fl-nutrition-nav">
      <div className="fl-nutrition-nav-label">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
            NUTRITION INTELLIGENCE
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {english
              ? "One nutrition system: intake, planning and supplements."
              : "Viena mitybos sistema: žurnalas, planavimas ir papildai."}
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
