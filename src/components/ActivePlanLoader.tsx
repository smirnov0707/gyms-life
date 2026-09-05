import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, ChevronDown, Clock3, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActivePlan } from "@/lib/active-plan.functions";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";

type Copy = {
  loadFailed: string;
  tryAgain: string;
  noPlan: string;
  noPlanHint: string;
  generate: string;
  staleTitle: string;
  staleHint: string;
  regenerate: string;
  eyebrow: string;
  weeks: string;
  daysPerWeek: string;
  sessions: string;
  mission: string;
  todayAction: string;
  todayHint: string;
  openToday: string;
  inspectPlan: string;
  inspectPlanHint: string;
  day: string;
  minutes: string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      loadFailed: "Could not load your active program.",
      tryAgain: "Try again in a moment.",
      noPlan: "You do not have an active training program yet.",
      noPlanHint:
        "Build your first program and GYMS.LIFE will use it as the training strategy behind Today.",
      generate: "Build program",
      staleTitle: "Your training program needs to be rebuilt.",
      staleHint: "The stored plan no longer matches the current program contract.",
      regenerate: "Build again",
      eyebrow: "TRAINING SYSTEM",
      weeks: "weeks",
      daysPerWeek: "days / week",
      sessions: "sessions",
      mission: "Current mission",
      todayAction: "Your next action lives in Today",
      todayHint:
        "GYMS.LIFE combines this program with your current state before deciding what you should do now.",
      openToday: "Open today's decision",
      inspectPlan: "Inspect full training strategy",
      inspectPlanHint: "Program structure, session focus and prescribed exercise volume.",
      day: "Day",
      minutes: "min",
    };
  }

  return {
    loadFailed: "Nepavyko įkelti aktyvios programos.",
    tryAgain: "Pabandyk dar kartą po akimirkos.",
    noPlan: "Aktyvios treniruočių programos dar nėra.",
    noPlanHint:
      "Sukurk pirmą programą ir GYMS.LIFE naudos ją kaip treniruočių strategiją Today sprendimams.",
    generate: "Sukurti programą",
    staleTitle: "Treniruočių programą reikia sukurti iš naujo.",
    staleHint: "Išsaugota programa nebeatitinka dabartinio programos kontrakto.",
    regenerate: "Sukurti iš naujo",
    eyebrow: "TRENIRUOČIŲ SISTEMA",
    weeks: "savaitės",
    daysPerWeek: "dienos / sav.",
    sessions: "treniruotės",
    mission: "Dabartinė misija",
    todayAction: "Kitas tavo veiksmas yra Today",
    todayHint:
      "GYMS.LIFE sujungia šią programą su dabartine tavo būsena ir tik tada nusprendžia, ką geriausia daryti dabar.",
    openToday: "Atidaryti šiandienos sprendimą",
    inspectPlan: "Peržiūrėti visą treniruočių strategiją",
    inspectPlanHint: "Programos struktūra, treniruočių fokusas ir numatytas pratimų tūris.",
    day: "Diena",
    minutes: "min",
  };
}

export function ActivePlanLoader() {
  const { lang } = useI18n();
  const copy = copyFor(lang);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["active-plan"],
    queryFn: () => getActivePlan(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-[2rem] border border-border bg-foreground/[0.02]" />
        <div className="h-16 animate-pulse rounded-[1.5rem] border border-border bg-foreground/[0.02]" />
      </div>
    );
  }

  if (isError) {
    return (
      <section className="rounded-[2rem] border border-destructive/20 bg-destructive/[0.04] p-6">
        <p className="text-sm font-medium text-destructive">{copy.loadFailed}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.tryAgain}</p>
      </section>
    );
  }

  if (!data || data.status === "NO_ACTIVE_PLAN") {
    return (
      <section className="rounded-[2rem] border border-border bg-foreground/[0.02] p-6 sm:p-8">
        <p className="text-lg font-semibold text-foreground">{copy.noPlan}</p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {copy.noPlanHint}
        </p>
        <Button asChild className="mt-5 rounded-full">
          <Link to="/onboarding">{copy.generate}</Link>
        </Button>
      </section>
    );
  }

  if (data.status === "INVALID_PLAN") {
    return (
      <section className="rounded-[2rem] border border-amber-400/20 bg-amber-400/[0.04] p-6 sm:p-8">
        <p className="text-lg font-semibold text-foreground">{copy.staleTitle}</p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {copy.staleHint}
        </p>
        <Button asChild className="mt-5 rounded-full">
          <Link to="/onboarding">{copy.regenerate}</Link>
        </Button>
      </section>
    );
  }

  const { plan } = data;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] p-5 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(75% 120% at 0% 0%, rgba(16,185,129,.10), transparent 60%)",
          }}
        />

        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {plan.title}
          </h1>

          {plan.goal ? (
            <div className="mt-4 flex max-w-2xl items-start gap-2 text-sm leading-relaxed text-neutral-400">
              <Target className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600">
                  {copy.mission}
                </span>
                <p className="mt-1">{plan.goal}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-7 grid grid-cols-3 gap-3 border-y border-white/[0.06] py-5">
            <div>
              <p className="font-mono text-xl text-white">{plan.weeks}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-600">
                {copy.weeks}
              </p>
            </div>
            <div>
              <p className="font-mono text-xl text-white">{plan.daysPerWeek}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-600">
                {copy.daysPerWeek}
              </p>
            </div>
            <div>
              <p className="font-mono text-xl text-white">{plan.data.days.length}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-600">
                {copy.sessions}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <p className="text-lg font-medium text-white">{copy.todayAction}</p>
              <p className="mt-1 text-sm leading-relaxed text-neutral-500">{copy.todayHint}</p>
            </div>
            <Button asChild size="lg" className="rounded-full px-6">
              <Link to="/">
                {copy.openToday}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <details className="group rounded-[1.75rem] border border-border bg-foreground/[0.02]">
        <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{copy.inspectPlan}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {copy.inspectPlanHint}
              </p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
        </summary>

        <div className="border-t border-border p-4 sm:p-6">
          {plan.data.summary ? (
            <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {plan.data.summary}
            </p>
          ) : null}

          <div className="divide-y divide-white/[0.06]">
            {plan.data.days.map((day) => (
              <article key={day.day} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-400 light:text-emerald-700">
                      {copy.day} {day.day}
                    </p>
                    <h2 className="mt-1 text-lg font-medium text-foreground">{day.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{day.focus}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" /> ~{day.estimated_minutes} {copy.minutes}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {day.exercises.map((exercise) => (
                    <div
                      key={`${day.day}-${exercise.slug}`}
                      className="rounded-xl border border-border bg-black/20 px-3 py-3"
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {exercise.name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {exercise.sets} × {exercise.reps}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {plan.daysPerWeek} {copy.daysPerWeek}
          </div>
        </div>
      </details>
    </div>
  );
}
