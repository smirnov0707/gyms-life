import { Gauge } from "lucide-react";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";
import type { PredictionCalibration } from "@/lib/prediction-calibration.schema";

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
  };
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function PredictionCalibrationPanel({ data }: { data: PredictionCalibration }) {
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
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {copy.description}
            </p>
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
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
