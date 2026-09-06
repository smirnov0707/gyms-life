import { Gauge, ShieldCheck } from "lucide-react";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";
import type { PredictionCalibration } from "@/lib/prediction-calibration.schema";
import type {
  PredictionPromotionGateModel,
  PredictionPromotionGateReport,
} from "@/lib/prediction-promotion-gate.schema";

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  empty: string;
  shadowLabel: string;
  evaluatedOf: (evaluated: number, captured: number) => string;
  pending: (count: number) => string;
  needMore: (needed: number) => string;
  predicted: string;
  observed: string;
  gap: string;
  brier: string;
  brierHelp: string;
  gateEyebrow: string;
  gateStatus: Record<PredictionPromotionGateModel["status"], string>;
  gateEvidence: (actual: number, required: number) => string;
  gateGathering: string;
  gateHold: string;
  gateEligible: string;
  autoPromotionOff: string;
  sample: string;
  variation: string;
  calibration: string;
  skill: string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      eyebrow: "PREDICTION CALIBRATION",
      title: "Is the forecast learning to match reality?",
      description:
        "Shadow forecasts are scored only after a real outcome is observable. They are evaluated here, but they do not influence Today.",
      empty: "No eligible shadow forecasts have been captured yet.",
      shadowLabel: "Shadow only · not used by Today",
      evaluatedOf: (evaluated, captured) => `${evaluated} evaluated of ${captured} captured`,
      pending: (count) => `${count} pending`,
      needMore: (needed) =>
        `Metrics stay hidden until at least ${needed} evaluated prediction-days exist for this model version.`,
      predicted: "Mean forecast",
      observed: "Observed completion",
      gap: "Calibration gap",
      brier: "Brier score",
      brierHelp: "Lower is better. 0 means perfectly scored probability forecasts.",
      gateEyebrow: "CANARY PROMOTION GATE",
      gateStatus: {
        gathering_evidence: "Gathering evidence",
        hold: "Hold",
        eligible_for_manual_review: "Eligible for manual review",
      },
      gateEvidence: (actual, required) => `${actual}/${required} evaluated prediction-days`,
      gateGathering: "The stricter canary evidence threshold has not been reached yet.",
      gateHold: "Enough data exists, but one or more pre-registered quality checks did not pass.",
      gateEligible:
        "All v1 gate checks passed. This only permits a manual canary review; it does not change model status.",
      autoPromotionOff: "Automatic promotion is disabled",
      sample: "Sample",
      variation: "Outcome variation",
      calibration: "Calibration",
      skill: "Brier skill",
    };
  }

  return {
    eyebrow: "PROGNOZIŲ KALIBRACIJA",
    title: "Ar prognozė mokosi atitikti realybę?",
    description:
      "Shadow prognozės vertinamos tik tada, kai realus rezultatas jau stebimas. Čia jos tikrinamos, bet nedaro įtakos Today sprendimui.",
    empty: "Kol kas nėra tinkamų įvertinti shadow prognozių.",
    shadowLabel: "Tik shadow · Today nenaudojama",
    evaluatedOf: (evaluated, captured) => `įvertinta ${evaluated} iš ${captured} užfiksuotų`,
    pending: (count) => `${count} laukia rezultato`,
    needMore: (needed) =>
      `Metrikos slepiamos, kol šiai modelio versijai nesukaupta bent ${needed} įvertintų prognozės dienų.`,
    predicted: "Vidutinė prognozė",
    observed: "Faktinis atlikimas",
    gap: "Kalibracijos skirtumas",
    brier: "Brier balas",
    brierHelp: "Kuo mažiau, tuo geriau. 0 reiškia idealiai įvertintas tikimybių prognozes.",
    gateEyebrow: "CANARY PERĖJIMO VARTAI",
    gateStatus: {
      gathering_evidence: "Renka įrodymus",
      hold: "Sustabdyta",
      eligible_for_manual_review: "Tinka rankinei peržiūrai",
    },
    gateEvidence: (actual, required) => `${actual}/${required} įvertintų prognozės dienų`,
    gateGathering: "Dar nepasiektas griežtesnis canary įrodymų slenkstis.",
    gateHold: "Duomenų jau pakanka, bet nepraėjo bent vienas iš anksto nustatytas kokybės kriterijus.",
    gateEligible:
      "Visi v1 vartų kriterijai praėjo. Tai tik leidžia rankinę canary peržiūrą ir nekeičia modelio statuso.",
    autoPromotionOff: "Automatinis perėjimas išjungtas",
    sample: "Imtis",
    variation: "Rezultatų įvairovė",
    calibration: "Kalibracija",
    skill: "Brier pranašumas",
  };
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function gateSummary(gate: PredictionPromotionGateModel, copy: Copy): string {
  if (gate.status === "gathering_evidence") return copy.gateGathering;
  if (gate.status === "eligible_for_manual_review") return copy.gateEligible;
  return copy.gateHold;
}

function GateCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${
        passed
          ? "border-emerald-400/20 text-emerald-400 light:text-emerald-700"
          : "border-border text-muted-foreground"
      }`}
    >
      {label} · {passed ? "✓" : "—"}
    </span>
  );
}

export function PredictionCalibrationPanel({
  data,
  promotionGate,
}: {
  data: PredictionCalibration;
  promotionGate: PredictionPromotionGateReport;
}) {
  const { lang } = useI18n();
  const copy = copyFor(lang);

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border bg-surface-2">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <Gauge className="size-3.5" /> {copy.eyebrow}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">{copy.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {copy.shadowLabel}
          </span>
        </div>

        {data.models.length === 0 ? (
          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <div className="mt-5 space-y-3 border-t border-border pt-4">
            {data.models.map((model) => {
              const metricsAvailable = model.brierScore !== null;
              const gate = promotionGate.models.find(
                (candidate) =>
                  candidate.modelId === model.modelId &&
                  candidate.modelVersion === model.modelVersion,
              );

              return (
                <article
                  key={`${model.modelId}:${model.modelVersion}`}
                  className="rounded-2xl border border-border bg-background/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {model.modelId} · v{model.modelVersion}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.evaluatedOf(model.evaluated, model.captured)}
                        {model.pending > 0 ? ` · ${copy.pending(model.pending)}` : ""}
                      </p>
                    </div>
                  </div>

                  {!metricsAvailable ? (
                    <p className="mt-4 rounded-xl bg-foreground/[0.03] px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                      {copy.needMore(model.minimumEvaluated)}
                    </p>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className="rounded-xl bg-foreground/[0.03] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {copy.predicted}
                        </p>
                        <p className="mt-2 font-mono text-xl text-foreground">
                          {percent(model.meanPredictedProbability ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-foreground/[0.03] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {copy.observed}
                        </p>
                        <p className="mt-2 font-mono text-xl text-foreground">
                          {percent(model.observedCompletionRate ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-foreground/[0.03] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {copy.gap}
                        </p>
                        <p className="mt-2 font-mono text-xl text-foreground">
                          {percent(model.calibrationGap ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-foreground/[0.03] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {copy.brier}
                        </p>
                        <p className="mt-2 font-mono text-xl text-foreground">
                          {model.brierScore?.toFixed(3)}
                        </p>
                        <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                          {copy.brierHelp}
                        </p>
                      </div>
                    </div>
                  )}

                  {gate ? (
                    <div className="mt-4 rounded-xl border border-border bg-foreground/[0.02] p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            <ShieldCheck className="size-3.5" /> {copy.gateEyebrow}
                          </p>
                          <p className="mt-1.5 text-sm font-semibold text-foreground">
                            {copy.gateStatus[gate.status]}
                          </p>
                          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                            {gateSummary(gate, copy)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {copy.gateEvidence(
                              gate.sampleSizeCheck.actual,
                              gate.sampleSizeCheck.required,
                            )}
                          </p>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                            {copy.autoPromotionOff}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <GateCheck label={copy.sample} passed={gate.sampleSizeCheck.passed} />
                        <GateCheck label={copy.variation} passed={gate.outcomeVariationCheck.passed} />
                        <GateCheck label={copy.calibration} passed={gate.calibrationCheck.passed} />
                        <GateCheck label={copy.skill} passed={gate.skillCheck.passed} />
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
