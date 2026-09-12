import { Binoculars, CircleHelp, FlaskConical, Sparkles } from "lucide-react";
import type { DeterministicPerformanceForecast } from "@/lib/forecast.schema";
import type { LabOverview } from "@/lib/lab.schema";
import { buildTwinEpistemicState } from "@/lib/twin-epistemic-state";
import { summarizeHypothesisStability } from "@/lib/hypothesis-stability";
import { buildPredictionVersionComparisons } from "@/lib/prediction-version-comparison";
import { buildTwinUncertaintyMap } from "@/lib/twin-uncertainty-map";
import { evaluateTwinLearningIntegrity } from "@/lib/twin-learning-integrity";
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
  const stability = summarizeHypothesisStability(lab?.hypothesisHistory ?? []);
  const comparisons = lab ? buildPredictionVersionComparisons(lab.predictionCalibration) : [];
  const uncertainty = buildTwinUncertaintyMap(lab);
  const integrity = evaluateTwinLearningIntegrity(
    lab?.hypotheses ?? [],
    lab?.hypothesisHistory ?? [],
  );
  const candidateWins = comparisons.filter(
    (item) => item.verdict === "candidate_outperforms",
  ).length;
  const mixedComparisons = comparisons.filter((item) => item.verdict === "mixed").length;
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
              ? `${uncertainty.activeLearning} active learning · ${uncertainty.actionableEvidenceGaps} actionable gap${uncertainty.actionableEvidenceGaps === 1 ? "" : "s"} · ${uncertainty.unavailableSources} unavailable source${uncertainty.unavailableSources === 1 ? "" : "s"}`
              : `${uncertainty.activeLearning} aktyviai mokomasi · ${uncertainty.actionableEvidenceGaps} papildomi išmatuojami tarpai · ${uncertainty.unavailableSources} nepasiekiami šaltiniai`}
          </p>
        </article>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {english ? "Hypothesis retrospective" : "Hipotezių retrospektyva"}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-foreground">
            {english
              ? `${stability.transitionCount} recorded transitions · ${stability.reversalCount} supported↔contradicted reversals`
              : `${stability.transitionCount} užfiksuoti pokyčiai · ${stability.reversalCount} supported↔contradicted reversals`}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {english ? "Learning integrity" : "Mokymosi vientisumas"}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-foreground">
            {english
              ? `${integrity.verified} audited · ${integrity.decisionEligible} decision-eligible · ${integrity.chainBreaks} chain breaks · ${integrity.unanchored} unanchored · ${integrity.drift} drift`
              : `${integrity.verified} audituota · ${integrity.decisionEligible} tinkama sprendimams · ${integrity.chainBreaks} grandinės trūkiai · ${integrity.unanchored} be atskaitos taško · ${integrity.drift} neatitikimai`}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {english ? "Model self-evaluation" : "Modelio savęs vertinimas"}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-foreground">
            {english
              ? `${comparisons.length} version comparisons · ${candidateWins} candidate improvements · ${mixedComparisons} mixed`
              : `${comparisons.length} versijų palyginimai · ${candidateWins} kandidato pagerėjimai · ${mixedComparisons} mišrūs`}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        {english
          ? "Shadow predictions and Future Me forecasts are research outputs. They do not influence Today, and neither a newer version nor a review-eligible model is automatically trusted."
          : "Shadow prognozės ir Future Me projekcijos yra tyrimo rezultatai. Jos nedaro įtakos Today, o nei naujesnė versija, nei peržiūrai tinkamas modelis automatiškai nelaikomas patikimu."}
      </p>
    </FutureLabPanel>
  );
}
