import { Binoculars, CircleHelp, FlaskConical, Sparkles } from "lucide-react";
import type { DeterministicPerformanceForecast } from "@/lib/forecast.schema";
import type { LabOverview } from "@/lib/lab.schema";
import { buildTwinEpistemicState } from "@/lib/twin-epistemic-state";
import { FutureLabPanel } from "./FutureLabPanel";

export function EpistemicBoundary({
  lab,
  forecast,
  english,
}: {
  lab: LabOverview | null;
  forecast: DeterministicPerformanceForecast | null;
  english: boolean;
}) {
  const state = buildTwinEpistemicState(lab, forecast);
  const hypothesisCount =
    state.hypotheses.supported +
    state.hypotheses.monitoring +
    state.hypotheses.insufficientEvidence +
    state.hypotheses.contradicted;
  const unknownCount = state.unknowns.dataGapCount + state.unknowns.unreadableSourceCount;
  const predictionLabel =
    state.prediction.state === "shadow_metrics_available"
      ? english
        ? "Shadow metrics available"
        : "Shadow metrikos prieinamos"
      : state.prediction.state === "shadow_uncalibrated"
        ? english
          ? "Shadow, still calibrating"
          : "Shadow, dar kalibruojama"
        : state.prediction.state === "learning"
          ? english
            ? "Learning"
            : "Mokosi"
          : english
            ? "Unavailable"
            : "Nepasiekiama";

  return (
    <FutureLabPanel
      eyebrow={english ? "KNOWLEDGE BOUNDARY" : "ŽINOJIMO RIBA"}
      title={english ? "What the Twin knows — and does not know" : "Ką Twin žino — ir ko nežino"}
    >
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border/70 bg-surface-2/45 p-3">
          <Binoculars aria-hidden="true" className="size-4 text-cyan-300" />
          <p className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground">
            {english ? "Observed" : "Stebėta"}
          </p>
          <p className="mt-1 font-mono text-lg text-foreground">
            {state.observed.answeredDecisions + state.observed.evaluatedPredictionOutcomes}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {english
              ? "Answered decisions and evaluated outcomes only."
              : "Tik atsakyti sprendimai ir įvertinti rezultatai."}
          </p>
        </article>
        <article className="rounded-xl border border-border/70 bg-surface-2/45 p-3">
          <FlaskConical aria-hidden="true" className="size-4 text-violet-300" />
          <p className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground">
            {english ? "Hypotheses" : "Hipotezės"}
          </p>
          <p className="mt-1 font-mono text-lg text-foreground">{hypothesisCount}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {english
              ? `${state.hypotheses.supported} supported · ${state.hypotheses.monitoring} monitoring`
              : `${state.hypotheses.supported} pagrįsta · ${state.hypotheses.monitoring} stebima`}
          </p>
        </article>
        <article className="rounded-xl border border-border/70 bg-surface-2/45 p-3">
          <Sparkles aria-hidden="true" className="size-4 text-emerald-300" />
          <p className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground">
            {english ? "Predicted" : "Prognozuota"}
          </p>
          <p className="mt-1 text-xs font-medium text-foreground">{predictionLabel}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {english
              ? `${state.prediction.forecastLiftCount} bounded strength forecast${state.prediction.forecastLiftCount === 1 ? "" : "s"} · ${state.prediction.reviewEligibleModelCount} model${state.prediction.reviewEligibleModelCount === 1 ? "" : "s"} review-eligible`
              : `${state.prediction.forecastLiftCount} ribotos jėgos prognozės · ${state.prediction.reviewEligibleModelCount} modeliai paruošti peržiūrai`}
          </p>
        </article>
        <article className="rounded-xl border border-border/70 bg-surface-2/45 p-3">
          <CircleHelp aria-hidden="true" className="size-4 text-amber-300" />
          <p className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground">
            {english ? "Unknown" : "Nežinoma"}
          </p>
          <p className="mt-1 font-mono text-lg text-foreground">{unknownCount}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {english
              ? "Missing or unreadable sources stay unknown."
              : "Trūkstami ar neperskaitomi šaltiniai lieka nežinomi."}
          </p>
        </article>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        {english
          ? "Shadow predictions and Future Me forecasts are research outputs. They do not influence Today, and unsupported hypotheses cannot become decision authority."
          : "Shadow prognozės ir Future Me projekcijos yra tyrimo rezultatai. Jos nedaro įtakos Today, o nepagrįstos hipotezės negali tapti sprendimo autoritetu."}
      </p>
    </FutureLabPanel>
  );
}
