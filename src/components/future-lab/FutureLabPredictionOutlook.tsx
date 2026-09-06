import { useQuery } from "@tanstack/react-query";
import { Activity, CircleGauge, Dumbbell, LockKeyhole, ShieldCheck } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLabOverview } from "@/lib/lab.functions";
import { getTwinTrendHistory } from "@/lib/twin-trend.functions";
import { buildTwinMetricTrend, type TwinTrendSeries } from "@/lib/twin-trend";

function Sparkline({ series }: { series: TwinTrendSeries | null }) {
  if (!series || series.samples.length < 2) {
    return (
      <div className="h-12 rounded-lg border border-dashed border-white/[0.06] bg-white/[0.015]" />
    );
  }
  const values = series.samples.map((sample) => sample.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = series.samples
    .map((sample, index) => {
      const x = (index / Math.max(1, series.samples.length - 1)) * 100;
      const y = 38 - ((sample.value - min) / range) * 32;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 42"
      className="h-12 w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function FutureLabPredictionOutlook() {
  const { lang } = useI18n();
  const isEnglish = baseLang(lang) === "en";
  const timeZone = browserTimeZone();
  const labQuery = useQuery({
    queryKey: ["lab-overview", timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    staleTime: 60_000,
  });
  const trendQuery = useQuery({
    queryKey: ["future-lab-trend"],
    queryFn: () => getTwinTrendHistory(),
    staleTime: 60_000,
  });

  const calibration = labQuery.data?.predictionCalibration;
  const readiness = trendQuery.data ? buildTwinMetricTrend(trendQuery.data, "readiness") : null;
  const load = trendQuery.data
    ? buildTwinMetricTrend(trendQuery.data, "totalVolumeLast28Days")
    : null;
  const evidenceProgress = calibration
    ? Math.min(100, Math.round((calibration.totalEvaluated / calibration.minimumEvaluated) * 100))
    : 0;
  const matureModel = calibration?.models.find((model) => model.brierScore !== null) ?? null;

  return (
    <div className="grid gap-3">
      <section className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
              PREDICTION CONFIDENCE
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {isEnglish ? "Workout-completion shadow model" : "Workout-completion shadow modelis"}
            </p>
          </div>
          <CircleGauge className="size-4 text-cyan-300" />
        </div>

        {labQuery.isError || !calibration ? (
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            {isEnglish
              ? "Prediction evidence is temporarily unavailable."
              : "Prognozių įrodymų būsena laikinai nepasiekiama."}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-[74px_1fr] items-center gap-4">
            <div
              className="grid aspect-square place-items-center rounded-full p-[7px]"
              style={{
                background: `conic-gradient(rgb(34 211 238) ${evidenceProgress}%, rgba(255,255,255,.06) 0)`,
              }}
            >
              <div className="grid size-full place-items-center rounded-full bg-[#07111d] text-center">
                <div>
                  <p className="font-mono text-lg text-white">{calibration.totalEvaluated}</p>
                  <p className="text-[7px] uppercase tracking-[0.12em] text-slate-600">
                    / {calibration.minimumEvaluated}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {matureModel
                  ? isEnglish
                    ? "Calibration metrics available"
                    : "Kalibravimo metrikos prieinamos"
                  : isEnglish
                    ? "Still calibrating"
                    : "Dar kalibruojama"}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                {matureModel
                  ? isEnglish
                    ? `Brier score ${matureModel.brierScore?.toFixed(3)} · observed completion ${Math.round((matureModel.observedCompletionRate ?? 0) * 100)}%`
                    : `Brier score ${matureModel.brierScore?.toFixed(3)} · stebėtas užbaigimas ${Math.round((matureModel.observedCompletionRate ?? 0) * 100)}%`
                  : isEnglish
                    ? `${calibration.totalPending} predictions are still awaiting outcome. Confidence is not published below the evaluation threshold.`
                    : `${calibration.totalPending} prognozių dar laukia rezultato. Žemiau vertinimo ribos confidence neskelbiamas.`}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              {isEnglish ? "NEXT 7 DAYS OUTLOOK" : "KITŲ 7 DIENŲ OUTLOOK"}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {isEnglish
                ? "Not activated until a validated horizon model exists"
                : "Neaktyvuota, kol nėra validuoto horizonto modelio"}
            </p>
          </div>
          <LockKeyhole className="size-4 text-slate-600" />
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.05] bg-black/15 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[10px] text-slate-400">
              <Activity className="size-3.5 text-cyan-300" />{" "}
              {isEnglish ? "Observed readiness" : "Stebėtas readiness"}
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              {readiness?.latestValue == null ? "—" : Math.round(readiness.latestValue)}
            </span>
          </div>
          <div className="mt-2 text-cyan-400">
            <Sparkline series={readiness} />
          </div>
        </div>

        <div className="mt-2 rounded-xl border border-white/[0.05] bg-black/15 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[10px] text-slate-400">
              <Dumbbell className="size-3.5 text-violet-300" />{" "}
              {isEnglish ? "Observed 28d load" : "Stebėtas 28 d. krūvis"}
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              {load?.latestValue == null
                ? "—"
                : `${Math.round(load.latestValue).toLocaleString()} kg`}
            </span>
          </div>
          <div className="mt-2 text-violet-400">
            <Sparkline series={load} />
          </div>
        </div>

        <p className="mt-3 flex items-start gap-2 text-[9px] leading-relaxed text-slate-600">
          <ShieldCheck className="mt-0.5 size-3 shrink-0" />
          {isEnglish
            ? "These lines are stored observations only. They are not seven-day predictions and do not alter Today."
            : "Šios linijos rodo tik išsaugotus stebėjimus. Tai nėra 7 dienų prognozės ir jos nekeičia Today sprendimo."}
        </p>
      </section>
    </div>
  );
}
