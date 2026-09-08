import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BrainCircuit, FlaskConical, LockKeyhole, Sparkles } from "lucide-react";
import { RecentWorkoutEffect } from "@/components/RecentWorkoutEffect";
import { FutureLabEmpty, FutureLabPanel } from "./FutureLabPanel";
import { useLabOverview } from "./lab-overview.query";
import { baseLang, useI18n } from "@/lib/i18n";
import { useStrengthForecast } from "./forecast.query";
import {
  projectedChangePercent,
  projectedEstimated1RM,
  type FutureMeHorizon,
} from "@/lib/future-me-simulation";

const statements = {
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Paskutinės treniruotės pakartotinai jautėsi sunkios.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Kaip baigtos treniruotės atitinka tavo įprastas treniruočių dienas.",
  },
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Recent sessions have repeatedly felt difficult.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "How completed sessions fit your usual training days.",
  },
} as const;

function CardAction({
  to,
  children,
}: {
  to: "/training" | "/progress" | "/lab" | "/history";
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="fl-card-action mt-auto flex min-h-9 items-center justify-center gap-2 rounded-lg border border-violet-400/35 bg-gradient-to-r from-violet-600/40 to-violet-500/15 px-3 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.06em] text-violet-100 light:text-violet-800"
    >
      {children}
      <ArrowRight className="size-3 shrink-0" />
    </Link>
  );
}

export function FutureLabTodayIntelligence() {
  const { lang, t } = useI18n();
  const locale = baseLang(lang);
  const english = locale === "en";
  const labQuery = useLabOverview();
  const [horizon, setHorizon] = useState<FutureMeHorizon>("30d");
  const forecastQuery = useStrengthForecast();
  const lab = labQuery.isError ? undefined : labQuery.data;
  const monitoring = lab?.hypotheses.find(
    (item) => item.status === "monitoring" || item.status === "insufficient_evidence",
  );
  const discovery = lab?.hypotheses.find((item) => item.status === "supported");
  const forecast = forecastQuery.isError ? undefined : forecastQuery.data;
  const lift = forecast?.status === "ready" ? forecast.lifts[0] : undefined;
  const projected = lift ? projectedEstimated1RM(lift, horizon) : null;
  const change = lift ? projectedChangePercent(lift.currentEstimated1RMKg, projected) : null;
  const statement = (key: string) => {
    const copy = statements[locale];
    return (
      copy[key as keyof typeof copy] ??
      (english ? "A personal pattern is being evaluated." : "Vertinamas asmeninis dėsningumas.")
    );
  };
  const unavailable = english
    ? "Data is temporarily unavailable."
    : "Duomenys laikinai nepasiekiami.";
  const loading = t("common.loading");
  const horizons: { id: FutureMeHorizon; label: string }[] = [
    { id: "30d", label: english ? "4 WEEKS" : "4 SAVAITĖS" },
    { id: "90d", label: english ? "12 WEEKS" : "12 SAVAIČIŲ" },
    { id: "180d", label: "180D" },
  ];

  return (
    <div className="fl-bottom-deck grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
      <section className="fl-panel fl-recent-effect flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface/90 p-3.5">
        <div className="flex-1">
          <RecentWorkoutEffect />
        </div>
        <CardAction to="/training">
          {english ? "Open training" : "Atidaryti treniruotes"}
        </CardAction>
      </section>

      <FutureLabPanel
        eyebrow="FUTURE ME"
        title={english ? "Your strength trajectory" : "Tavo jėgos trajektorija"}
        action={<Sparkles className="size-3.5 text-violet-300" />}
      >
        <div
          className="mb-3 flex gap-1"
          aria-label={english ? "Projection horizon" : "Projekcijos laikotarpis"}
        >
          {horizons.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={horizon === option.id}
              onClick={() => setHorizon(option.id)}
              className={`flex min-h-8 flex-1 items-center justify-center gap-1 rounded-md border px-1.5 text-[8px] font-medium ${horizon === option.id ? "border-violet-400/50 bg-violet-500/15 text-foreground" : "border-border text-muted-foreground"}`}
            >
              {option.label}
              {option.id === "180d" ? <LockKeyhole className="size-2.5" /> : null}
            </button>
          ))}
        </div>
        <div className="mb-3 flex-1">
          {forecastQuery.isError ? (
            <FutureLabEmpty>{unavailable}</FutureLabEmpty>
          ) : !forecast ? (
            <FutureLabEmpty>{loading}</FutureLabEmpty>
          ) : horizon === "180d" ? (
            <FutureLabEmpty>
              {english
                ? "This model has no 180-day projection."
                : "Šis modelis neturi 180 dienų projekcijos."}
            </FutureLabEmpty>
          ) : lift && projected !== null ? (
            <>
              <p className="truncate text-[11px] font-medium text-foreground">
                {lift.exerciseName}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] text-muted-foreground">
                    {english ? "Current e1RM" : "Dabartinis e1RM"}
                  </p>
                  <p className="mt-1 font-mono text-xl text-foreground">
                    {lift.currentEstimated1RMKg}
                    <span className="ml-1 text-[10px] text-muted-foreground">kg</span>
                  </p>
                </div>
                <ArrowRight className="size-4 text-violet-400" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground">
                    {english ? "Projected e1RM" : "Numatomas e1RM"}
                  </p>
                  <p className="mt-1 font-mono text-xl text-violet-300 light:text-violet-700">
                    {projected}
                    <span className="ml-1 text-[10px]">kg</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 flex justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                  {lift.evidence.sessionCount} {english ? "sessions" : "sesijų"}
                </span>
                <span className="font-mono text-cyan-300 light:text-cyan-700">
                  {change === null ? "—" : `${change > 0 ? "+" : ""}${change}%`}
                </span>
              </p>
              <p className="mt-2 text-[9px] text-muted-foreground">
                {english
                  ? "Calculated estimate · no future body is inferred."
                  : "Apskaičiuotas įvertis · būsimas kūnas nenuspėjamas."}
              </p>
            </>
          ) : (
            <FutureLabEmpty>
              {forecast.status === "learning"
                ? english
                  ? `A lift needs ${forecast.minimumSessionCount} completed sessions across ${forecast.minimumSpanDays} days before a projection appears.`
                  : `Projekcijai reikia ${forecast.minimumSessionCount} baigtų pratimo sesijų per bent ${forecast.minimumSpanDays} dieną.`
                : english
                  ? "No projection is available."
                  : "Projekcijos nėra."}
            </FutureLabEmpty>
          )}
        </div>
        <CardAction to="/progress">
          {english ? "Explore Future Me" : "Atidaryti Future Me"}
        </CardAction>
      </FutureLabPanel>

      <FutureLabPanel
        eyebrow={english ? "TODAY'S HYPOTHESIS" : "ŠIANDIENOS HIPOTEZĖ"}
        title={english ? "Under investigation" : "Šiuo metu tiriama"}
        action={<FlaskConical className="size-3.5 text-cyan-300" />}
      >
        <div className="mb-3 flex-1">
          {labQuery.isError ? (
            <FutureLabEmpty>{unavailable}</FutureLabEmpty>
          ) : !lab ? (
            <FutureLabEmpty>{loading}</FutureLabEmpty>
          ) : monitoring ? (
            <>
              <p className="text-[11px] leading-relaxed text-foreground">
                {statement(monitoring.statementKey)}
              </p>
              <p className="mt-4 text-[9px] text-muted-foreground">
                {english ? "Gathering observations" : "Renkami stebėjimai"}
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  style={{
                    width: `${Math.min(100, Math.round((monitoring.evidenceCount / monitoring.minimumEvidenceCount) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-right font-mono text-[9px] text-muted-foreground">
                {monitoring.evidenceCount}/{monitoring.minimumEvidenceCount}{" "}
                {english ? "evidence points" : "įrodymų taškų"}
              </p>
            </>
          ) : (
            <FutureLabEmpty>
              {english
                ? "No hypothesis is awaiting more evidence."
                : "Nė viena hipotezė šiuo metu nelaukia papildomų duomenų."}
            </FutureLabEmpty>
          )}
        </div>
        <CardAction to="/lab">{english ? "View investigation" : "Peržiūrėti tyrimą"}</CardAction>
      </FutureLabPanel>

      <FutureLabPanel
        eyebrow={english ? "PERSONAL DISCOVERY" : "ASMENINIS ATRADIMAS"}
        title={english ? "What your data supports" : "Ką pagrindžia tavo duomenys"}
        action={<BrainCircuit className="size-3.5 text-emerald-300" />}
      >
        <div className="mb-3 flex-1">
          {labQuery.isError ? (
            <FutureLabEmpty>{unavailable}</FutureLabEmpty>
          ) : !lab ? (
            <FutureLabEmpty>{loading}</FutureLabEmpty>
          ) : discovery ? (
            <>
              <p className="text-[11px] leading-relaxed text-foreground">
                {statement(discovery.statementKey)}
              </p>
              <p className="mt-4 text-[10px] text-emerald-300 light:text-emerald-700">
                {discovery.evidenceCount} {english ? "evidence points" : "įrodymų taškų"}
              </p>
              <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
                {english
                  ? "The configured evidence threshold was reached. This does not establish causation."
                  : "Pasiekta nustatyta įrodymų riba. Tai nenustato priežastinio ryšio."}
              </p>
            </>
          ) : (
            <FutureLabEmpty>
              {english
                ? "No pattern has reached its evidence threshold yet."
                : "Dar nė vienas dėsningumas nepasiekė įrodymų ribos."}
            </FutureLabEmpty>
          )}
        </div>
        <CardAction to="/history">
          {english ? "See discoveries" : "Peržiūrėti atradimus"}
        </CardAction>
      </FutureLabPanel>
    </div>
  );
}
