import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  Apple,
  BrainCircuit,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Dumbbell,
  FlaskConical,
  HeartPulse,
  Microscope,
  Moon,
  ScanLine,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLabOverview } from "@/lib/lab.functions";
import { getLiveSignals } from "@/lib/live-signals.functions";
import type { DigitalAthleteDataGap } from "@/lib/digital-athlete.schema";
import type { LiveSignal } from "@/lib/live-signals.engine";
import type { PredictionCalibration } from "@/lib/prediction-calibration.schema";

const SCIENTISTS = [
  { id: "training", icon: Dumbbell },
  { id: "recovery", icon: HeartPulse },
  { id: "sleep", icon: Moon },
  { id: "nutrition", icon: Apple },
  { id: "biomechanics", icon: ScanLine },
  { id: "behavior", icon: BrainCircuit },
  { id: "statistics", icon: ChartNoAxesColumnIncreasing },
  { id: "causal", icon: Microscope },
  { id: "safety", icon: ShieldCheck },
  { id: "skeptic", icon: SearchCheck },
] as const;

type ScientistId = (typeof SCIENTISTS)[number]["id"];
type RailStatus = "ready" | "learning" | "needs_data" | "unavailable" | "shadow" | "policy";

type ScientistState = {
  id: ScientistId;
  status: RailStatus;
  detail: string;
};

function hasGap(gaps: readonly DigitalAthleteDataGap[], ...values: DigitalAthleteDataGap[]) {
  return values.some((value) => gaps.includes(value));
}

function signalState(signal: LiveSignal | undefined): RailStatus {
  if (!signal || signal.state === "absent") return "needs_data";
  if (signal.state === "unreadable") return "unavailable";
  if (signal.state === "stale") return "learning";
  return "ready";
}

function strongestModel(calibration: PredictionCalibration | undefined) {
  if (!calibration?.models.length) return null;
  return [...calibration.models].sort((left, right) => right.evaluated - left.evaluated)[0] ?? null;
}

function maturityProgress(calibration: PredictionCalibration | undefined): number {
  if (!calibration) return 0;
  return Math.min(100, Math.round((calibration.totalEvaluated / calibration.minimumEvaluated) * 100));
}

function formatSignalValue(signal: LiveSignal | undefined): string {
  if (!signal || signal.value === null) return "—";
  return signal.value.toFixed(1);
}

export function FutureLabTodayRightRail() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const timeZone = browserTimeZone();
  const labQuery = useQuery({
    queryKey: ["today-right-rail-lab", timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    staleTime: 60_000,
  });
  const signalsQuery = useQuery({
    queryKey: ["today-right-rail-signals", timeZone],
    queryFn: () => getLiveSignals({ data: timeZone }),
    staleTime: 60_000,
  });

  const lab = labQuery.data;
  const gaps = lab?.dataGaps ?? [];
  const signals = signalsQuery.data ?? [];
  const sleep = signals.find((signal) => signal.id === "sleep");
  const hrv = signals.find((signal) => signal.id === "hrv");
  const calibration = lab?.predictionCalibration;
  const calibrationModel = strongestModel(calibration);
  const progress = maturityProgress(calibration);

  const copy = english
    ? {
        labStatus: "LAB STATUS",
        labSubtitle: "Evidence-aware systems",
        openLab: "Open Lab",
        roles: {
          training: "Training Scientist",
          recovery: "Recovery Scientist",
          sleep: "Sleep Scientist",
          nutrition: "Nutrition Scientist",
          biomechanics: "Biomechanics Lab",
          behavior: "Behavior Scientist",
          statistics: "Statistician",
          causal: "Causal Scientist",
          safety: "Safety Guardian",
          skeptic: "Skeptic",
        } satisfies Record<ScientistId, string>,
        status: {
          ready: "Evidence ready",
          learning: "Learning",
          needs_data: "Needs data",
          unavailable: "Unavailable",
          shadow: "Shadow mode",
          policy: "Guardrail",
        } satisfies Record<RailStatus, string>,
        prediction: "PREDICTION EVIDENCE",
        predictionSubtitle: "Workout completion · shadow",
        withheld: "Confidence withheld",
        evaluated: "evaluated",
        minimum: "minimum before calibration is published",
        brier: "Brier score",
        gap: "Calibration gap",
        observed: "Observed completion",
        predicted: "Mean predicted",
        outlook: "NEXT 7 DAYS OUTLOOK",
        outlookLocked: "Daily recovery forecast is not validated yet",
        outlookBody:
          "Future Me currently validates bounded 30D/90D strength projections. GYMS.LIFE does not invent seven daily recovery points just to fill this chart.",
        openFuture: "Open Future Me",
        sleep: "SLEEP ANALYSIS",
        lastReading: "Latest recorded sleep",
        sleepMissing: "No sleep reading has been recorded yet.",
        sleepUnreadable: "The sleep source could not be read.",
        stale: "stale reading",
        measured: "recent reading",
        source: "source",
        change: "vs previous reading",
        hours: "h",
      }
    : {
        labStatus: "LAB STATUS",
        labSubtitle: "Sistemos pagal realius įrodymus",
        openLab: "Atidaryti Lab",
        roles: {
          training: "Training Scientist",
          recovery: "Recovery Scientist",
          sleep: "Sleep Scientist",
          nutrition: "Nutrition Scientist",
          biomechanics: "Biomechanics Lab",
          behavior: "Behavior Scientist",
          statistics: "Statistician",
          causal: "Causal Scientist",
          safety: "Safety Guardian",
          skeptic: "Skeptic",
        } satisfies Record<ScientistId, string>,
        status: {
          ready: "Duomenys paruošti",
          learning: "Mokosi",
          needs_data: "Reikia duomenų",
          unavailable: "Nepasiekiama",
          shadow: "Shadow režimas",
          policy: "Apsaugos sluoksnis",
        } satisfies Record<RailStatus, string>,
        prediction: "PROGNOZĖS ĮRODYMAI",
        predictionSubtitle: "Workout completion · shadow",
        withheld: "Confidence dar nerodomas",
        evaluated: "įvertinta",
        minimum: "minimumas prieš skelbiant kalibraciją",
        brier: "Brier score",
        gap: "Kalibracijos skirtumas",
        observed: "Faktinis užbaigimas",
        predicted: "Vidutinė prognozė",
        outlook: "ARTIMIAUSIŲ 7 DIENŲ OUTLOOK",
        outlookLocked: "Kasdienė recovery prognozė dar nevaliduota",
        outlookBody:
          "Future Me dabar validuoja ribotas 30D/90D jėgos projekcijas. GYMS.LIFE neišgalvoja septynių recovery taškų vien tam, kad užpildytų grafiką.",
        openFuture: "Atidaryti Future Me",
        sleep: "SLEEP ANALYSIS",
        lastReading: "Naujausias užregistruotas miegas",
        sleepMissing: "Miego įrašų dar nėra.",
        sleepUnreadable: "Miego šaltinio nepavyko perskaityti.",
        stale: "pasenęs įrašas",
        measured: "naujas įrašas",
        source: "šaltinis",
        change: "nuo ankstesnio įrašo",
        hours: "val.",
      };

  const scientistStates: ScientistState[] = useMemo(() => {
    const unavailableAll = labQuery.isError;
    if (unavailableAll) {
      return SCIENTISTS.map((scientist) => ({
        id: scientist.id,
        status: scientist.id === "safety" || scientist.id === "skeptic" ? "policy" : "unavailable",
        detail: copy.status[
          scientist.id === "safety" || scientist.id === "skeptic" ? "policy" : "unavailable"
        ],
      }));
    }

    const trainingStatus: RailStatus = hasGap(gaps, "training_data_unavailable")
      ? "unavailable"
      : hasGap(gaps, "no_completed_workouts_28d")
        ? "needs_data"
        : "ready";
    const recoveryStatus: RailStatus = hasGap(gaps, "recovery_data_unavailable")
      ? "unavailable"
      : hasGap(gaps, "no_recovery_checkins_7d")
        ? "needs_data"
        : "ready";
    const nutritionStatus: RailStatus = hasGap(gaps, "nutrition_data_unavailable")
      ? "unavailable"
      : hasGap(gaps, "no_nutrition_logs_14d")
        ? "needs_data"
        : "ready";
    const biomechanicsStatus: RailStatus = hasGap(gaps, "muscle_load_data_unavailable")
      ? "needs_data"
      : "ready";
    const behaviorStatus: RailStatus = hasGap(
      gaps,
      "training_rhythm_data_unavailable",
      "current_context_unavailable",
    )
      ? "needs_data"
      : "ready";
    const causalStatus: RailStatus = lab?.hypotheses.some(
      (hypothesis) =>
        hypothesis.status === "monitoring" || hypothesis.status === "insufficient_evidence",
    )
      ? "learning"
      : lab?.hypotheses.some((hypothesis) => hypothesis.status === "supported")
        ? "ready"
        : "needs_data";

    const statusById: Record<ScientistId, RailStatus> = {
      training: trainingStatus,
      recovery: recoveryStatus,
      sleep: signalsQuery.isError ? "unavailable" : signalState(sleep),
      nutrition: nutritionStatus,
      biomechanics: biomechanicsStatus,
      behavior: behaviorStatus,
      statistics: calibration ? "shadow" : "needs_data",
      causal: causalStatus,
      safety: "policy",
      skeptic: "policy",
    };

    return SCIENTISTS.map((scientist) => ({
      id: scientist.id,
      status: statusById[scientist.id],
      detail: copy.status[statusById[scientist.id]],
    }));
  }, [calibration, copy.status, gaps, lab?.hypotheses, labQuery.isError, signalsQuery.isError, sleep]);

  const metricPublished =
    calibrationModel?.brierScore !== null &&
    calibrationModel?.brierScore !== undefined &&
    calibrationModel.evaluated >= calibrationModel.minimumEvaluated;
  const sleepKnown = sleep?.value !== null && sleep?.value !== undefined;
  const sleepScale = sleepKnown ? Math.min(100, Math.max(0, ((sleep?.value ?? 0) / 8) * 100)) : 0;

  return (
    <div className="grid gap-3">
      <section className="overflow-hidden rounded-[1.35rem] border border-[#182846] bg-[#07111d]/90">
        <header className="flex items-start justify-between gap-3 border-b border-[#17243b] px-4 py-3.5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
              {copy.labStatus}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">{copy.labSubtitle}</p>
          </div>
          <Link
            to="/lab"
            aria-label={copy.openLab}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/[0.07] text-violet-300"
          >
            <ChevronRight className="size-4" />
          </Link>
        </header>
        <div className="divide-y divide-white/[0.045] px-2">
          {scientistStates.map((scientist) => {
            const definition = SCIENTISTS.find((item) => item.id === scientist.id)!;
            const Icon = definition.icon;
            const dot =
              scientist.status === "ready"
                ? "bg-emerald-400"
                : scientist.status === "learning" || scientist.status === "shadow"
                  ? "bg-cyan-400"
                  : scientist.status === "policy"
                    ? "bg-violet-400"
                    : scientist.status === "unavailable"
                      ? "bg-rose-400"
                      : "bg-amber-300";
            return (
              <div key={scientist.id} className="flex items-center gap-2.5 px-2 py-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-slate-400">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-slate-200">
                    {copy.roles[scientist.id]}
                  </span>
                  <span className="block truncate text-[9px] text-slate-600">{scientist.detail}</span>
                </span>
                <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${dot}`} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/90 p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">
          {copy.prediction}
        </p>
        <p className="mt-1 text-[10px] text-slate-600">{copy.predictionSubtitle}</p>
        <div className="mt-4 flex items-center gap-4">
          <div
            className="relative grid size-[88px] shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(rgb(34 211 238) ${progress}%, rgba(255,255,255,.06) ${progress}% 100%)`,
            }}
          >
            <div className="grid size-[72px] place-items-center rounded-full bg-[#07111d] text-center">
              <div>
                <p className="font-mono text-xl font-semibold text-white">
                  {calibration?.totalEvaluated ?? 0}/{calibration?.minimumEvaluated ?? 8}
                </p>
                <p className="text-[8px] uppercase tracking-[0.12em] text-cyan-400">shadow</p>
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              {metricPublished ? copy.status.ready : copy.withheld}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              {calibration?.totalEvaluated ?? 0} {copy.evaluated} · {calibration?.minimumEvaluated ?? 8}{" "}
              {copy.minimum}
            </p>
          </div>
        </div>
        {metricPublished && calibrationModel ? (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.05] pt-3 text-[10px]">
            <span className="text-slate-500">
              {copy.brier} <strong className="font-mono text-slate-200">{calibrationModel.brierScore?.toFixed(3)}</strong>
            </span>
            <span className="text-slate-500">
              {copy.gap} <strong className="font-mono text-slate-200">{calibrationModel.calibrationGap?.toFixed(3)}</strong>
            </span>
            <span className="text-slate-500">
              {copy.predicted} <strong className="font-mono text-slate-200">{calibrationModel.meanPredictedProbability == null ? "—" : `${Math.round(calibrationModel.meanPredictedProbability * 100)}%`}</strong>
            </span>
            <span className="text-slate-500">
              {copy.observed} <strong className="font-mono text-slate-200">{calibrationModel.observedCompletionRate == null ? "—" : `${Math.round(calibrationModel.observedCompletionRate * 100)}%`}</strong>
            </span>
          </div>
        ) : null}
      </section>

      <section className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/90 p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
          {copy.outlook}
        </p>
        <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <span key={day} className="flex h-12 items-end rounded-md bg-white/[0.025] p-1">
              <span
                className="w-full rounded-sm bg-gradient-to-t from-violet-500/30 to-cyan-400/20"
                style={{ height: `${18 + day * 5}%` }}
              />
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-200">{copy.outlookLocked}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{copy.outlookBody}</p>
        <Link
          to="/progress"
          className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-lg border border-violet-400/20 bg-violet-500/[0.06] px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-violet-200"
        >
          {copy.openFuture} <ChevronRight className="size-3" />
        </Link>
      </section>

      <section className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/90 p-4">
        <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">
          <Moon className="size-3.5" /> {copy.sleep}
        </p>
        {signalsQuery.isError || sleep?.state === "unreadable" ? (
          <p className="mt-4 text-xs leading-relaxed text-slate-500">{copy.sleepUnreadable}</p>
        ) : sleepKnown ? (
          <div className="mt-3">
            <p className="font-mono text-3xl tracking-[-0.05em] text-white">
              {formatSignalValue(sleep)} <span className="text-sm tracking-normal text-slate-500">{copy.hours}</span>
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {copy.lastReading} · {sleep?.state === "stale" ? copy.stale : copy.measured}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                style={{ width: `${sleepScale}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-600">
              <span>
                {copy.change}: {sleep?.delta == null ? "—" : `${sleep.delta > 0 ? "+" : ""}${sleep.delta.toFixed(1)} ${copy.hours}`}
              </span>
              <span className="text-right">
                {copy.source}: {sleep?.source ?? "—"}
              </span>
            </div>
            {hrv?.value != null ? (
              <p className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-3 text-[10px] text-slate-500">
                <Activity className="size-3.5 text-cyan-400" /> HRV {Math.round(hrv.value)} ms
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-slate-500">{copy.sleepMissing}</p>
        )}
      </section>
    </div>
  );
}
