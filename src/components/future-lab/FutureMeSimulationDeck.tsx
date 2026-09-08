import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  LockKeyhole,
  Minus,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStrengthForecast } from "./forecast.query";
import { IllustrativeAthlete } from "./IllustrativeAthlete";
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
          "Dabartinis modelis pateikia tik 4 ir 12 savaičių rezultatus. 180 dienų ir 1 metų skirtukai palikti matomi tam, kad sistema parodytų ribą, o ne išgalvotų ateities rezultatą.",
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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_36%,rgba(96,54,170,.13),transparent_55%)]"
      />
      <div className="relative p-3.5 sm:p-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[8px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              GYMS.LIFE
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Future Me</h1>
          </div>
          <div
            className="grid grid-cols-4 gap-1.5 sm:flex"
            aria-label={english ? "Projection horizon" : "Projekcijos laikotarpis"}
          >
            {FUTURE_ME_HORIZONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={horizon === option}
                onClick={() => setHorizon(option)}
                className={`relative flex min-h-9 items-center justify-center gap-1 rounded-lg border px-3 text-[10px] font-medium transition-colors ${horizon === option ? "border-violet-400/60 bg-violet-500/20 text-foreground shadow-[0_0_18px_rgba(124,58,237,.12)]" : "border-border bg-surface-2/30 text-muted-foreground"}`}
              >
                {HORIZON_LABEL[option]}
                {!isValidatedFutureMeHorizon(option) ? <LockKeyhole className="size-2.5" /> : null}
              </button>
            ))}
          </div>
        </header>

        {forecast?.status === "ready" && selectedLift && !failed ? (
          <label className="mt-3 flex items-center justify-between gap-3 border-y border-border/60 py-2 text-[10px] text-muted-foreground">
            <span className="shrink-0">{copy.select}</span>
            <select
              aria-label={copy.select}
              value={selectedLift.exerciseSlug}
              onChange={(event) => setSelectedExercise(event.target.value)}
              className="min-h-8 min-w-0 max-w-[65%] rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground"
            >
              {forecast.lifts.map((lift) => (
                <option key={lift.exerciseSlug} value={lift.exerciseSlug}>
                  {lift.exerciseName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-3 grid items-center gap-3 lg:grid-cols-[.75fr_1.15fr_1fr] lg:gap-5">
          <div className="hidden lg:block">
            {selectedLift && !failed ? (
              <article className="rounded-xl border border-border bg-surface-2/45 p-4">
                <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                  {copy.current}
                </p>
                <p className="mt-2 font-mono text-3xl text-foreground">
                  {selectedLift.currentEstimated1RMKg}
                  <span className="ml-1 text-xs text-muted-foreground">kg</span>
                </p>
                <p className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <TrendIcon className="size-3.5 text-cyan-300" />
                  {copy.trend[selectedLift.trend]}
                </p>
                <p className="mt-3 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
                  {copy.subtitle}
                </p>
              </article>
            ) : null}
          </div>

          <IllustrativeAthlete />

          <div className="min-w-0">
            <article className="rounded-xl border border-violet-400/20 bg-surface-2/70 p-3.5">
              <h2 className="text-xs font-medium text-foreground">{copy.title}</h2>
              {!forecast && !failed ? (
                <p
                  role="status"
                  className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Loader2 className="size-3.5 animate-spin text-violet-300" />
                  {copy.refreshing}
                </p>
              ) : failed ? (
                <p role="status" className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {copy.unavailable}
                </p>
              ) : forecast?.status === "learning" ? (
                <>
                  <p className="mt-2 text-xs text-violet-300 light:text-violet-700">
                    {copy.learningTitle}
                  </p>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                    {copy.learningBody(forecast.minimumSessionCount, forecast.minimumSpanDays)}
                  </p>
                </>
              ) : selectedLift ? (
                <>
                  <dl className="mt-2.5 space-y-2.5 text-[11px]">
                    <div className="flex justify-between gap-3 lg:hidden">
                      <dt className="text-muted-foreground">{copy.current}</dt>
                      <dd className="shrink-0 font-mono text-foreground">
                        {selectedLift.currentEstimated1RMKg} kg
                      </dd>
                    </div>
                    {validated && projected !== null ? (
                      <>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">
                            {HORIZON_LABEL[horizon]} · {copy.projected}
                          </dt>
                          <dd className="shrink-0 font-mono text-violet-300 light:text-violet-700">
                            {projected} kg
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{copy.change}</dt>
                          <dd
                            className={`font-mono ${change !== null && change < 0 ? "text-rose-300" : "text-emerald-300"}`}
                          >
                            {signed(change)}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg border border-amber-300/15 bg-amber-300/5 p-2.5">
                        <dt className="flex items-center gap-1.5 text-[10px] text-amber-300">
                          <LockKeyhole className="size-3" />
                          {copy.boundaryTitle}
                        </dt>
                        <dd className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                          {copy.boundaryBody}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{copy.evidence}</dt>
                      <dd className={`font-medium ${EVIDENCE_TONE[selectedLift.evidenceStrength]}`}>
                        {copy.evidenceLabel[selectedLift.evidenceStrength]}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 border-t border-border/70 pt-2 text-[9px] text-muted-foreground">
                    {selectedLift.evidence.sessionCount} {copy.sessions} ·{" "}
                    {selectedLift.evidence.weeksTracked} {copy.weeks} ·{" "}
                    {selectedLift.evidence.spanDays} {copy.days}
                  </p>
                </>
              ) : null}
              <Button
                onClick={() => void load()}
                disabled={loading}
                className="mt-3 min-h-10 w-full rounded-lg border border-violet-400/30 bg-gradient-to-r from-violet-700 to-violet-600/60 px-2 text-[10px] font-medium text-white hover:from-violet-600 hover:to-violet-500/60"
              >
                {loading ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" />
                )}
                {loading ? copy.refreshing : copy.refresh}
              </Button>
            </article>
            <details className="mt-2.5 rounded-lg border border-border/60 px-3 py-2.5">
              <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">
                {copy.method}
              </summary>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                {copy.methodBody}
              </p>
              {forecast ? (
                <p className="mt-2 font-mono text-[9px] text-muted-foreground">
                  {copy.version} {forecast.forecastVersion} · {forecast.sourceWindowDays}d{" "}
                  {copy.source}
                </p>
              ) : null}
            </details>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-1.5 border-t border-border/60 pt-2.5 text-[9px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3 shrink-0 text-cyan-400" />
          {copy.disclaimer}
        </p>
      </div>
    </section>
  );
}
