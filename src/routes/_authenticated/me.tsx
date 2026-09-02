import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Apple,
  Dumbbell,
  HeartPulse,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAthleteModel } from "@/lib/athlete-model.functions";
import type { AthleteModelResponse } from "@/lib/athlete-model.contract";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "Mano sportininko modelis — GYMS.LIFE" },
      {
        name: "description",
        content: "Skaidri, patikrintais duomenimis paremta tavo GYMS.LIFE sportininko būsena.",
      },
    ],
  }),
  component: AthleteModelPage,
});

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  refresh: string;
  updating: string;
  quality: Record<AthleteModelResponse["state"]["dataQuality"]["level"], string>;
  evidence: string;
  transparent: string;
  training: string;
  recovery: string;
  body: string;
  nutrition: string;
  sessions7d: string;
  sessions28d: string;
  volume: string;
  daysSince: string;
  readiness: string;
  sleep: string;
  weight: string;
  weightTrend: string;
  loggedDays: string;
  calories: string;
  protein: string;
  learning: string;
  noGaps: string;
  saved: string;
  unavailable: string;
  error: string;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "DIGITAL ATHLETE",
      title: "Your athlete model",
      description: "A transparent, deterministic summary of the data you have logged in GYMS.LIFE.",
      refresh: "Refresh model",
      updating: "Updating your model…",
      quality: {
        cold_start: "Just getting started",
        building: "Learning from your logs",
        informed: "Evidence-informed",
      },
      evidence: "evidence points",
      transparent: "No guesses: GYMS.LIFE stores only validated aggregate facts here.",
      training: "Training",
      recovery: "Recovery",
      body: "Body",
      nutrition: "Nutrition",
      sessions7d: "sessions / 7d",
      sessions28d: "sessions / 28d",
      volume: "volume / 28d",
      daysSince: "days since session",
      readiness: "latest readiness",
      sleep: "avg sleep / 7d",
      weight: "latest weight",
      weightTrend: "weight change / 30d",
      loggedDays: "logged days / 14d",
      calories: "avg kcal on logged days",
      protein: "avg protein on logged days",
      learning: "What would improve the model",
      noGaps: "Your current data covers every tracked domain.",
      saved: "Historical state saved",
      unavailable: "A source was temporarily unavailable, so no new historical state was saved.",
      error: "Could not load your athlete model. Please try again.",
    };
  }
  return {
    eyebrow: "SKAITMENINIS SPORTININKAS",
    title: "Tavo sportininko modelis",
    description: "Skaidri, deterministinė suvestinė iš duomenų, kuriuos užregistravai GYMS.LIFE.",
    refresh: "Atnaujinti modelį",
    updating: "Atnaujinamas tavo modelis…",
    quality: {
      cold_start: "Tik pradedame kaupti duomenis",
      building: "Mokomės iš tavo įrašų",
      informed: "Paremta pakankamais duomenimis",
    },
    evidence: "įrodymo taškai",
    transparent: "Be spėjimų: čia saugomi tik validuoti apibendrinti faktai.",
    training: "Treniruotės",
    recovery: "Atsistatymas",
    body: "Kūnas",
    nutrition: "Mityba",
    sessions7d: "treniruotės / 7 d.",
    sessions28d: "treniruotės / 28 d.",
    volume: "tūris / 28 d.",
    daysSince: "dienos nuo treniruotės",
    readiness: "naujausias pasiruošimas",
    sleep: "vid. miegas / 7 d.",
    weight: "naujausias svoris",
    weightTrend: "svorio pokytis / 30 d.",
    loggedDays: "logintos dienos / 14 d.",
    calories: "vid. kcal logintomis dienomis",
    protein: "vid. baltymai logintomis dienomis",
    learning: "Kas pagerintų modelį",
    noGaps: "Dabartiniai duomenys apima visas stebimas sritis.",
    saved: "Istorinė būsena išsaugota",
    unavailable:
      "Vienas šaltinis laikinai nepasiekiamas, todėl nauja istorinė būsena nebuvo saugoma.",
    error: "Nepavyko įkelti sportininko modelio. Bandyk dar kartą.",
  };
}

function numberOrDash(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value}${suffix}`;
}

function dataGapAction(
  gap: string,
  lang: string,
): { label: string; to: "/training" | "/readiness" | "/progress" | "/nutrition" } {
  const isEnglish = lang === "en";
  if (gap.startsWith("training")) {
    return { label: isEnglish ? "Log a workout" : "Užregistruok treniruotę", to: "/training" };
  }
  if (gap.startsWith("recovery")) {
    return { label: isEnglish ? "Check readiness" : "Įvertink pasiruošimą", to: "/readiness" };
  }
  if (gap.startsWith("body")) {
    return { label: isEnglish ? "Log body metrics" : "Įvesk kūno rodiklius", to: "/progress" };
  }
  return { label: isEnglish ? "Log nutrition" : "Užregistruok mitybą", to: "/nutrition" };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-3">
      <p className="text-display text-xl text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function AthleteModelPage() {
  const { lang } = useI18n();
  const copy = copyFor(lang);
  const loadModel = useServerFn(getAthleteModel);
  const [model, setModel] = useState<AthleteModelResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setModel(await loadModel({}));
    } catch {
      toast.error(copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error, loadModel]);

  useEffect(() => {
    void load();
  }, [load]);

  const state = model?.state;
  const locale = lang === "en" ? "en-GB" : "lt-LT";

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <section className="panel relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl">{copy.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
          </div>
          <Button
            onClick={() => void load()}
            disabled={loading}
            variant="outline"
            className="rounded-full"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {copy.refresh}
          </Button>
        </div>

        {loading && !state ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> {copy.updating}
          </div>
        ) : null}

        {state ? (
          <div className="relative mt-7 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-7" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {copy.quality[state.dataQuality.level]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {state.dataQuality.evidenceCount} {copy.evidence} · {copy.transparent}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {state ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Dumbbell className="size-5 text-primary" /> {copy.training}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label={copy.sessions7d} value={String(state.training.sessionsLast7Days)} />
                <Metric
                  label={copy.sessions28d}
                  value={String(state.training.sessionsLast28Days)}
                />
                <Metric
                  label={copy.volume}
                  value={`${Math.round(state.training.totalVolumeLast28Days)} kg`}
                />
                <Metric
                  label={copy.daysSince}
                  value={numberOrDash(state.training.daysSinceLastCompletedWorkout)}
                />
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <HeartPulse className="size-5 text-primary" /> {copy.recovery}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric
                  label={copy.readiness}
                  value={numberOrDash(state.recovery.latestReadinessScore, "/100")}
                />
                <Metric
                  label={copy.sleep}
                  value={numberOrDash(state.recovery.averageSleepHoursLast7Days, " h")}
                />
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Scale className="size-5 text-primary" /> {copy.body}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric
                  label={copy.weight}
                  value={numberOrDash(state.body.latestWeightKg, " kg")}
                />
                <Metric
                  label={copy.weightTrend}
                  value={numberOrDash(state.body.weightChangeKgLast30Days, " kg")}
                />
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Apple className="size-5 text-primary" /> {copy.nutrition}
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Metric
                  label={copy.loggedDays}
                  value={String(state.nutrition.loggedDaysLast14Days)}
                />
                <Metric
                  label={copy.calories}
                  value={numberOrDash(state.nutrition.averageCaloriesOnLoggedDays)}
                />
                <Metric
                  label={copy.protein}
                  value={numberOrDash(state.nutrition.averageProteinGOnLoggedDays, " g")}
                />
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-xl">
              <Activity className="size-5 text-primary" /> {copy.learning}
            </h2>
            {state.dataGaps.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {state.dataGaps.map((gap) => {
                  const action = dataGapAction(gap, lang);
                  return (
                    <Button key={gap} asChild size="sm" variant="outline" className="rounded-full">
                      <Link to={action.to}>{action.label}</Link>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{copy.noGaps}</p>
            )}
            <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              {model.snapshot
                ? `${copy.saved}: ${new Date(model.snapshot.computedAt).toLocaleString(locale)}`
                : copy.unavailable}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
