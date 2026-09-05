import { useQuery } from "@tanstack/react-query";
import { getActivePlan } from "@/lib/active-plan.functions";
import { GlowCard } from "@/components/GlowCard";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";

type Copy = {
  loadFailed: string;
  tryAgain: string;
  noPlan: string;
  noPlanHint: string;
  generate: string;
  staleHint: string;
  regenerate: string;
  weeks: string;
  sessions: string;
  weekStructure: string;
  trainingDays: string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      loadFailed: "Could not load your active program.",
      tryAgain: "Try again in a moment.",
      noPlan: "You do not have an active training program yet.",
      noPlanHint: "Generate one in the AI Builder and it will appear here automatically.",
      generate: "Generate program",
      staleHint: "The AI Builder data has not changed. Generate a new program so it can be loaded.",
      regenerate: "Generate again",
      weeks: "weeks",
      sessions: "sessions",
      weekStructure: "Week structure",
      trainingDays: "Training days",
    };
  }
  return {
    loadFailed: "Nepavyko įkelti aktyvios programos.",
    tryAgain: "Pabandyk dar kartą po akimirkos.",
    noPlan: "Aktyvios treniruočių programos dar nėra.",
    noPlanHint: "Sugeneruok programą AI Builder ir ji automatiškai atsiras čia.",
    generate: "Generuoti programą",
    staleHint:
      "AI Builder duomenys nebuvo pakeisti. Sugeneruok naują programą, kad ją būtų galima įkelti.",
    regenerate: "Generuoti iš naujo",
    weeks: "savaitės",
    sessions: "treniruotės",
    weekStructure: "Savaitės struktūra",
    trainingDays: "Treniruočių dienos",
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
      <div className="grid gap-4">
        <GlowCard className="panel p-6">
          <div className="h-6 w-56 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
        </GlowCard>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <GlowCard key={item} className="panel h-40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError)
    return (
      <GlowCard className="panel p-6">
        <p className="text-sm text-destructive">{copy.loadFailed}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.tryAgain}</p>
      </GlowCard>
    );

  if (!data || data.status === "NO_ACTIVE_PLAN")
    return (
      <GlowCard className="panel p-6">
        <p className="text-lg font-semibold">{copy.noPlan}</p>
        <p className="mt-2 text-sm text-muted-foreground">{copy.noPlanHint}</p>
        <Button asChild className="mt-5 rounded-full">
          <Link to="/onboarding">{copy.generate}</Link>
        </Button>
      </GlowCard>
    );

  if (data.status === "INVALID_PLAN")
    return (
      <GlowCard className="panel p-6">
        <p className="text-lg font-semibold">Programos duomenys nebegalioja.</p>
        <p className="mt-2 text-sm text-muted-foreground">{copy.staleHint}</p>
        <Button asChild className="mt-5 rounded-full">
          <Link to="/onboarding">{copy.regenerate}</Link>
        </Button>
      </GlowCard>
    );

  const { plan } = data;
  return (
    <div className="grid gap-6">
      <GlowCard className="panel p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
          Aktyvi programa
        </p>
        <h1 className="mt-2 text-3xl shine-text">{plan.title}</h1>
        {plan.goal && (
          <p className="mt-2 text-sm font-medium text-muted-foreground">Tikslas: {plan.goal}</p>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-2xl font-bold">{plan.weeks}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {copy.weeks}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">{plan.daysPerWeek}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              dienos / sav.
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">{plan.data.days.length}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {copy.sessions}
            </div>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
          {plan.data.summary}
        </p>
      </GlowCard>
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
              {copy.weekStructure}
            </p>
            <h2 className="mt-1 text-2xl">{copy.trainingDays}</h2>
          </div>
          <span className="text-sm text-muted-foreground">{plan.data.days.length} dienos</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plan.data.days.map((day) => (
            <GlowCard key={day.day} className="panel lift p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  Diena {day.day}
                </span>
                <span className="text-xs text-muted-foreground">~{day.estimated_minutes} min</span>
              </div>
              <h3 className="mt-2 text-xl font-semibold">{day.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{day.focus}</p>
              <div className="mt-4 space-y-2">
                {day.exercises.map((exercise) => (
                  <div
                    key={`${day.day}-${exercise.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="truncate">{exercise.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {exercise.sets} × {exercise.reps}
                    </span>
                  </div>
                ))}
              </div>
            </GlowCard>
          ))}
        </div>
      </section>
    </div>
  );
}
