import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Brain, Dumbbell, HeartPulse, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { displayedMemoryContent, memoryEvidenceSummary } from "@/lib/user-memory.presentation";
import { getWeeklyIntelligenceReview } from "@/lib/weekly-intelligence.functions";
import type {
  WeeklyIntelligenceAction,
  WeeklyIntelligenceReview,
} from "@/lib/weekly-intelligence.schema";

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  unavailable: string;
  learning: string;
  discoveries: string;
  thisWeek: string;
  workouts: string;
  checkins: string;
  readiness: string;
  next: string;
  stillLearning: string;
  noGaps: string;
  action: Record<WeeklyIntelligenceAction, { title: string; cta: string }>;
  gap: Record<WeeklyIntelligenceReview["stillLearning"][number], string>;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "WEEKLY INTELLIGENCE",
      title: "What GYMS.LIFE learned this week",
      description: "A short review from your logged data — never a generated story.",
      loading: "Reviewing your verified data…",
      unavailable: "This weekly review is temporarily unavailable.",
      learning:
        "I am still learning your patterns. Log a few more real actions and the review will become more personal.",
      discoveries: "Observed patterns",
      thisWeek: "This week",
      workouts: "completed workouts",
      checkins: "readiness check-ins",
      readiness: "average readiness",
      next: "One useful next step",
      stillLearning: "Still learning",
      noGaps: "The current model has evidence across every tracked domain.",
      action: {
        start_training: { title: "Record a completed workout", cta: "Open training" },
        check_readiness: { title: "Add a readiness check-in", cta: "Check readiness" },
        log_nutrition: { title: "Log nutrition", cta: "Open nutrition" },
        log_body_metrics: { title: "Add a body measurement", cta: "Open progress" },
        set_training_rhythm: { title: "Set your usual training days", cta: "Set rhythm" },
        open_today: { title: "Follow today's decision", cta: "Open Today" },
      },
      gap: {
        training_data_unavailable: "Training data is temporarily unavailable.",
        no_completed_workouts_28d: "There are no completed workouts in the last 28 days.",
        recovery_data_unavailable: "Recovery data is temporarily unavailable.",
        no_recovery_checkins_7d: "There are no readiness check-ins in the last 7 days.",
        body_measurements_unavailable: "Body data is temporarily unavailable.",
        no_body_measurements_30d: "There are no body measurements in the last 30 days.",
        nutrition_data_unavailable: "Nutrition data is temporarily unavailable.",
        no_nutrition_logs_14d: "There are no nutrition logs in the last 14 days.",
        current_context_unavailable: "Current-life context is temporarily unavailable.",
        training_rhythm_data_unavailable: "Training-rhythm data is temporarily unavailable.",
        personalization_consent_required: "Personalized AI context is not enabled.",
        personalization_consent_unavailable: "Personalization consent is temporarily unavailable.",
      },
    };
  }

  return {
    eyebrow: "SAVAITĖS APŽVALGA",
    title: "Ką GYMS.LIFE pastebėjo šią savaitę",
    description: "Trumpa apžvalga iš tavo užregistruotų duomenų — ne sugeneruota istorija.",
    loading: "Tikrinami patvirtinti tavo duomenys…",
    unavailable: "Savaitinė apžvalga šiuo metu nepasiekiama.",
    learning:
      "Dar mokausi tavo dėsningumų. Užregistruok kelis realius veiksmus ir apžvalga taps asmeniškesnė.",
    discoveries: "Pastebėti dėsningumai",
    thisWeek: "Ši savaitė",
    workouts: "baigtos treniruotės",
    checkins: "pasiruošimo check-in'ai",
    readiness: "vid. pasiruošimas",
    next: "Vienas naudingas kitas žingsnis",
    stillLearning: "Ką dar mokomės suprasti",
    noGaps: "Dabartinis modelis turi duomenų iš visų stebimų sričių.",
    action: {
      start_training: { title: "Užregistruok baigtą treniruotę", cta: "Atidaryti treniruotes" },
      check_readiness: { title: "Įvertink šiandienos pasiruošimą", cta: "Įvertinti pasiruošimą" },
      log_nutrition: { title: "Užregistruok mitybą", cta: "Atidaryti mitybą" },
      log_body_metrics: { title: "Pridėk kūno matavimą", cta: "Atidaryti progresą" },
      set_training_rhythm: {
        title: "Nustatyk įprastas treniruočių dienas",
        cta: "Nustatyti ritmą",
      },
      open_today: { title: "Sek šiandienos sprendimą", cta: "Atidaryti šiandieną" },
    },
    gap: {
      training_data_unavailable: "Treniruočių duomenys laikinai nepasiekiami.",
      no_completed_workouts_28d: "Per pastarąsias 28 dienas nėra baigtų treniruočių.",
      recovery_data_unavailable: "Atsistatymo duomenys laikinai nepasiekiami.",
      no_recovery_checkins_7d: "Per pastarąsias 7 dienas nėra pasiruošimo check-in'ų.",
      body_measurements_unavailable: "Kūno duomenys laikinai nepasiekiami.",
      no_body_measurements_30d: "Per pastarąsias 30 dienų nėra kūno matavimų.",
      nutrition_data_unavailable: "Mitybos duomenys laikinai nepasiekiami.",
      no_nutrition_logs_14d: "Per pastarąsias 14 dienų nėra mitybos įrašų.",
      current_context_unavailable: "Dabartinis gyvenimo kontekstas laikinai nepasiekiamas.",
      training_rhythm_data_unavailable: "Treniruočių ritmo duomenys laikinai nepasiekiami.",
      personalization_consent_required: "Asmeninis AI kontekstas neįjungtas.",
      personalization_consent_unavailable: "Asmeninio konteksto sutikimas laikinai nepasiekiamas.",
    },
  };
}

const actionRoute: Record<
  WeeklyIntelligenceAction,
  "/" | "/training" | "/readiness" | "/nutrition" | "/progress" | "/me"
> = {
  start_training: "/training",
  check_readiness: "/readiness",
  log_nutrition: "/nutrition",
  log_body_metrics: "/progress",
  set_training_rhythm: "/me",
  open_today: "/",
};

function numberOrDash(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value}${suffix}`;
}

export function WeeklyIntelligenceReview() {
  const { lang } = useI18n();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);
  const { data, isError, isLoading } = useQuery({
    queryKey: ["weekly-intelligence-review", timeZone],
    queryFn: () => getWeeklyIntelligenceReview({ data: timeZone }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <section className="panel p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">{copy.unavailable}</p>;
  }

  const action = copy.action[data.nextAction.action];
  return (
    <section className="panel relative overflow-hidden p-6 md:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          <Sparkles className="size-4" /> {copy.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl">{copy.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {copy.description}
        </p>
      </div>

      <div className="relative mt-6 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface-2 p-4">
          <Dumbbell className="size-4 text-primary" />
          <p className="mt-3 text-display text-2xl text-foreground">
            {data.thisWeek.completedWorkouts}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.workouts}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <HeartPulse className="size-4 text-primary" />
          <p className="mt-3 text-display text-2xl text-foreground">
            {data.thisWeek.readinessCheckins}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.checkins}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <Activity className="size-4 text-primary" />
          <p className="mt-3 text-display text-2xl text-foreground">
            {numberOrDash(data.thisWeek.averageReadiness, "/100")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.readiness}</p>
        </div>
      </div>

      {data.discoveries.length ? (
        <div className="relative mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Brain className="size-4 text-primary" /> {copy.discoveries}
          </h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {data.discoveries.map((discovery) => (
              <article
                key={discovery.calculatedValue.kind}
                className="rounded-2xl border border-border bg-surface-2 p-4"
              >
                <p className="text-sm font-medium leading-relaxed text-foreground">
                  {displayedMemoryContent(discovery, lang)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {memoryEvidenceSummary(discovery, lang)}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="relative mt-6 rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-muted-foreground">
          {copy.learning}
        </p>
      )}

      <div className="relative mt-6 grid gap-4 border-t border-border pt-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">{copy.next}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{action.title}</p>
        </div>
        <Button asChild className="min-h-11 rounded-full px-5">
          <Link to={actionRoute[data.nextAction.action]}>
            {action.cta} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="relative mt-5 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-foreground">{copy.stillLearning}</h3>
        {data.stillLearning.length ? (
          <ul className="mt-2 grid gap-2 text-sm leading-relaxed text-muted-foreground">
            {data.stillLearning.map((gap) => (
              <li key={gap}>{copy.gap[gap]}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{copy.noGaps}</p>
        )}
      </div>
    </section>
  );
}
