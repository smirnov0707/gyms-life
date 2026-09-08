import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Gauge,
  Loader2,
  LockKeyhole,
  Minus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStrengthForecast } from "./forecast.query";
import type { DeterministicLiftForecast } from "@/lib/forecast.schema";
import {
  FUTURE_ME_HORIZONS,
  isValidatedFutureMeHorizon,
  projectedChangePercent,
  projectedEstimated1RM,
  type FutureMeHorizon,
} from "@/lib/future-me-simulation";
import { baseLang, useI18n } from "@/lib/i18n";

const HORIZON_LABEL: Record<FutureMeHorizon, string> = {
  "30d": "4W",
  "90d": "12W",
  "180d": "180D",
  "1y": "1Y",
};

const EVIDENCE_TONE: Record<DeterministicLiftForecast["evidenceStrength"], string> = {
  low: "text-amber-300",
  moderate: "text-cyan-300",
  high: "text-emerald-300",
};

function signed(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function trendIcon(trend: DeterministicLiftForecast["trend"]) {
  if (trend === "rising") return TrendingUp;
  if (trend === "falling") return TrendingDown;
  return Minus;
}

export function FutureMeSimulationDeck() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const query = useStrengthForecast();
  const forecast = query.data ?? null;
  const loading = query.isFetching;
  const failed = query.isError;
  const load = () => query.refetch();
  const [horizon, setHorizon] = useState<FutureMeHorizon>("30d");
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const selectedLift = useMemo(() => {
    if (forecast?.status !== "ready") return null;
    return (
      forecast.lifts.find((lift) => lift.exerciseSlug === selectedExercise) ??
      forecast.lifts[0] ??
      null
    );
  }, [forecast, selectedExercise]);

  useEffect(() => {
    if (forecast?.status !== "ready" || forecast.lifts.length === 0) return;
    if (selectedExercise && forecast.lifts.some((lift) => lift.exerciseSlug === selectedExercise)) {
      return;
    }
    setSelectedExercise(forecast.lifts[0]?.exerciseSlug ?? null);
  }, [forecast, selectedExercise]);

  const projected = selectedLift ? projectedEstimated1RM(selectedLift, horizon) : null;
  const change = selectedLift
    ? projectedChangePercent(selectedLift.currentEstimated1RMKg, projected)
    : null;
  const validated = isValidatedFutureMeHorizon(horizon);
  const TrendIcon = selectedLift ? trendIcon(selectedLift.trend) : Minus;

  const copy = english
    ? {
        eyebrow: "FUTURE ME · STRENGTH PROJECTION",
        title: "If you stay on this path",
        subtitle:
          "A bounded strength projection from your completed training history — separated from your Today decision and never treated as a promise.",
        current: "Current estimated 1RM",
        projected: "Projected estimated 1RM",
        change: "Projected change",
        evidence: "Evidence strength",
        observed: "Observed direction",
        sessions: "sessions",
        weeks: "weeks tracked",
        days: "days of evidence",
        select: "Projection target",
        method: "What this simulation assumes",
        methodBody:
          "The model uses one best estimated 1RM per completed exercise session, derives the observed weekly slope, retains only half of that slope and caps its weekly influence. The 12-week output is damped further.",
        boundaryTitle: "Long horizon intentionally locked",
        boundaryBody:
          "The current model produces only 4- and 12-week outputs. 180-day and 1-year tabs stay visible so the product shows the boundary instead of inventing a future result.",
        learningTitle: "Future Me is still learning your strength trajectory",
        learningBody: (sessions: number, days: number) =>
          `A lift needs at least ${sessions} completed sessions across ${days} days, plus enough weekly observations, before a projection is shown.`,
        unavailable: "The projection service could not be read. No result is being inferred.",
        refresh: "Recalculate projection",
        refreshing: "Recalculating…",
        version: "Model",
        source: "source window",
        disclaimer:
          "Estimate only. It does not prescribe a working weight, change your training plan, or guarantee future performance.",
        trend: { rising: "Rising", flat: "Flat", falling: "Falling" },
        evidenceLabel: { low: "Low", moderate: "Moderate", high: "High" },
      }
    : {
        eyebrow: "FUTURE ME · JĖGOS PROJEKCIJA",
        title: "Jei tęsi šia kryptimi",
        subtitle:
          "Ribota jėgos projekcija iš tavo užbaigtų treniruočių istorijos — atskirta nuo šiandienos sprendimo ir niekada nepateikiama kaip pažadas.",
        current: "Dabartinis apskaičiuotas 1RM",
        projected: "Prognozuojamas apskaičiuotas 1RM",
        change: "Prognozuojamas pokytis",
        evidence: "Įrodymų stiprumas",
        observed: "Stebėta kryptis",
        sessions: "sesijų",
        weeks: "stebėtų savaičių",
        days: "įrodymų dienų",
        select: "Projekcijos objektas",
        method: "Kokiomis prielaidomis remiasi ši simuliacija",
        methodBody:
          "Modelis ima vieną geriausią apskaičiuotą 1RM iš kiekvienos užbaigtos pratimo sesijos, nustato stebėtą savaitinį nuolydį, palieka tik pusę šio nuolydžio ir riboja jo savaitinę įtaką. 12 savaičių projekcija papildomai slopinama.",
        boundaryTitle: "Ilgas horizontas sąmoningai užrakintas",
        boundaryBody:
          "Dabartinis modelis validuoja tik 4 ir 12 savaičių rezultatus. 180 dienų ir 1 metų skirtukai palikti matomi tam, kad sistema parodytų ribą, o ne išgalvotų ateities rezultatą.",
        learningTitle: "Future Me dar mokosi tavo jėgos trajektorijos",
        learningBody: (sessions: number, days: number) =>
          `Pratimui reikia bent ${sessions} užbaigtų sesijų per ${days} dienų ir pakankamai savaitinių stebėjimų, kad būtų rodoma projekcija.`,
        unavailable: "Projekcijos šaltinio nepavyko perskaityti. Rezultatas nėra spėjamas.",
        refresh: "Perskaičiuoti projekciją",
        refreshing: "Perskaičiuojama…",
        version: "Modelis",
        source: "šaltinio langas",
        disclaimer:
          "Tai tik įvertis. Jis nenustato darbinio svorio, nekeičia treniruočių plano ir negarantuoja būsimo rezultato.",
        trend: { rising: "Kylanti", flat: "Stabili", falling: "Krintanti" },
        evidenceLabel: { low: "Žemas", moderate: "Vidutinis", high: "Aukštas" },
      };

  return (
    <section className="fl-future-page fl-panel relative overflow-hidden rounded-xl border border-border bg-surface/90">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(60% 100% at 14% 0%, rgba(91,33,182,.24), transparent 66%), radial-gradient(55% 100% at 86% 35%, rgba(6,182,212,.12), transparent 65%)",
        }}
      />

      <div className="relative p-4 sm:p-5">
        <header className="flex flex-col gap-4 border-b border-border pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-300">
              <Sparkles className="size-4" /> {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Future Me horizon">
            {FUTURE_ME_HORIZONS.map((option) => {
              const supported = isValidatedFutureMeHorizon(option);
              const active = horizon === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setHorizon(option)}
                  className={`relative min-h-10 min-w-[58px] rounded-lg border px-3 text-[10px] font-bold tracking-[0.12em] transition-colors ${
                    active
                      ? "border-violet-400/70 bg-violet-500/20 text-foreground shadow-[0_0_28px_rgba(124,58,237,.2)]"
                      : "border-border bg-surface-2/40 text-muted-foreground hover:border-violet-400/30 hover:text-foreground"
                  }`}
                >
                  {HORIZON_LABEL[option]}
                  {!supported ? (
                    <LockKeyhole className="absolute right-1.5 top-1.5 size-2.5 text-muted-foreground" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </header>

        {!forecast && !failed ? (
          <div className="grid min-h-[220px] place-items-center text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-violet-300" /> {copy.refreshing}
            </span>
          </div>
        ) : failed ? (
          <div className="grid min-h-[220px] place-items-center px-4 text-center">
            <div className="max-w-lg">
              <ShieldCheck className="mx-auto size-8 text-amber-300" />
              <p className="mt-4 text-sm text-muted-foreground">{copy.unavailable}</p>
              <Button className="mt-5" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="mr-2 size-4" /> {copy.refresh}
              </Button>
            </div>
          </div>
        ) : forecast?.status === "learning" ? (
          <div className="grid min-h-[240px] place-items-center py-6">
            <div className="max-w-2xl rounded-xl border border-violet-400/15 bg-violet-500/[0.05] p-6 text-center sm:p-8">
              <Gauge className="mx-auto size-9 text-violet-300" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">{copy.learningTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {copy.learningBody(forecast.minimumSessionCount, forecast.minimumSpanDays)}
              </p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {copy.version} {forecast.forecastVersion} {"·"}
                {forecast.sourceWindowDays}d {copy.source}
              </p>
              <Button className="mt-6" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="mr-1 size-4" /> {copy.refresh}
              </Button>
            </div>
          </div>
        ) : forecast?.status === "ready" && selectedLift ? (
          <div className="grid gap-3 pt-4 xl:grid-cols-[1.35fr_.65fr]">
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {copy.select}
                </p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {forecast.lifts.map((lift) => (
                    <button
                      key={lift.exerciseSlug}
                      type="button"
                      aria-pressed={selectedLift.exerciseSlug === lift.exerciseSlug}
                      onClick={() => setSelectedExercise(lift.exerciseSlug)}
                      className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                        selectedLift.exerciseSlug === lift.exerciseSlug
                          ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                          : "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lift.exerciseName}
                    </button>
                  ))}
                </div>
              </div>

              {validated && projected !== null ? (
                <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <article className="rounded-xl border border-border bg-surface-2/50 p-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {copy.current}
                    </p>
                    <p className="mt-3 font-mono text-3xl tracking-[-0.04em] text-foreground sm:text-4xl">
                      {selectedLift.currentEstimated1RMKg}
                      <span className="ml-1 text-base tracking-normal text-muted-foreground">
                        kg
                      </span>
                    </p>
                    <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendIcon className="size-4 text-cyan-300" /> {copy.observed}:{" "}
                      {copy.trend[selectedLift.trend]}
                    </p>
                  </article>

                  <div className="hidden items-center justify-center sm:flex">
                    <span className="grid size-11 place-items-center rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-300">
                      <ArrowRight className="size-4" />
                    </span>
                  </div>

                  <article className="rounded-xl border border-violet-400/20 bg-violet-500/[0.07] p-5 shadow-[inset_0_0_35px_rgba(124,58,237,.05)]">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-300">
                      {HORIZON_LABEL[horizon]} · {copy.projected}
                    </p>
                    <p className="mt-3 font-mono text-3xl tracking-[-0.04em] text-foreground sm:text-4xl">
                      {projected}
                      <span className="ml-1 text-base tracking-normal text-muted-foreground">
                        kg
                      </span>
                    </p>
                    <p
                      className={`mt-3 text-sm font-semibold ${change !== null && change < 0 ? "text-rose-300" : "text-emerald-300"}`}
                    >
                      {copy.change}: {signed(change)}
                    </p>
                  </article>
                </div>
              ) : (
                <article className="rounded-xl border border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 size-5 shrink-0 text-amber-300" />
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        {copy.boundaryTitle}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {copy.boundaryBody}
                      </p>
                    </div>
                  </div>
                </article>
              )}

              <article className="rounded-xl border border-border bg-surface-2/30 p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {copy.method}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {copy.methodBody}
                </p>
              </article>
            </div>

            <aside className="grid content-start gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-surface-2/50 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {copy.evidence}
                  </p>
                  <p
                    className={`mt-2 text-lg font-semibold ${EVIDENCE_TONE[selectedLift.evidenceStrength]}`}
                  >
                    {copy.evidenceLabel[selectedLift.evidenceStrength]}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-2/50 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {copy.change}
                  </p>
                  <p className="mt-2 font-mono text-lg text-foreground">{signed(change)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-2/50 p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="font-mono text-xl text-foreground">
                      {selectedLift.evidence.sessionCount}
                    </p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      {copy.sessions}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xl text-foreground">
                      {selectedLift.evidence.weeksTracked}
                    </p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      {copy.weeks}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xl text-foreground">
                      {selectedLift.evidence.spanDays}
                    </p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      {copy.days}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.035] p-4 text-xs leading-relaxed text-muted-foreground">
                <p className="flex items-center gap-2 font-semibold text-cyan-200">
                  <Clock3 className="size-4" /> {copy.version} {forecast.forecastVersion}
                </p>
                <p className="mt-2">
                  {forecast.sourceWindowDays}d {copy.source}
                </p>
              </div>

              <Button
                onClick={() => void load()}
                disabled={loading}
                className="min-h-12 bg-violet-600 text-foreground hover:bg-violet-500"
              >
                {loading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                {loading ? copy.refreshing : copy.refresh}
              </Button>
            </aside>
          </div>
        ) : null}

        <p className="relative mt-5 flex items-start gap-2 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-400" /> {copy.disclaimer}
        </p>
      </div>
    </section>
  );
}
