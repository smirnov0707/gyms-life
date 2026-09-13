import { Link, useLocation } from "@tanstack/react-router";
import { Apple, CalendarDays, Pill } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";

const items = [
  { to: "/nutrition", icon: Apple, lt: "Šiandiena", en: "Today" },
  { to: "/meal-plan", icon: CalendarDays, lt: "Planas", en: "Plan" },
  { to: "/supplements", icon: Pill, lt: "Papildai", en: "Supplements" },
] as const;

export function NutritionStudioNav() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const location = useLocation();

  return (
    <section className="rounded-[2rem] border border-border bg-surface/85 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-400">
            GYMS.LIFE · NUTRITION STUDIO
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {english
              ? "One nutrition system: observe, plan and support."
              : "Viena mitybos sistema: stebėk, planuok ir palaikyk."}
          </p>
        </div>
        <nav
          aria-label={english ? "Nutrition Studio" : "Mitybos studija"}
          className="flex gap-1 rounded-full border border-border bg-surface-2 p-1"
        >
          {items.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors sm:px-4 ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {english ? item.en : item.lt}
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
