import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Apple,
  BrainCircuit,
  FlaskConical,
  Moon,
  PersonStanding,
  ShieldCheck,
  Sigma,
  Sparkles,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLabOverview } from "@/lib/lab.functions";
import type { LabOverview } from "@/lib/lab.schema";

type Gap = LabOverview["dataGaps"][number];
type ScientistState = "evidence_ready" | "learning" | "needs_data";

type Scientist = {
  label: string;
  icon: LucideIcon;
  state: ScientistState;
  detail: string;
};

const TONE: Record<ScientistState, string> = {
  evidence_ready: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.55)]",
  learning: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.35)]",
  needs_data: "bg-slate-600",
};

function hasAny(gaps: Set<Gap>, candidates: Gap[]): boolean {
  return candidates.some((candidate) => gaps.has(candidate));
}

export function FutureLabScientistStatus({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useI18n();
  const isEnglish = baseLang(lang) === "en";
  const timeZone = browserTimeZone();
  const query = useQuery({
    queryKey: ["lab-overview", timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    staleTime: 60_000,
  });

  const data = query.data;
  const gaps = new Set<Gap>(data?.dataGaps ?? []);
  const trainingMissing = hasAny(gaps, [
    "training_data_unavailable",
    "no_completed_workouts_28d",
  ]);
  const recoveryMissing = hasAny(gaps, [
    "recovery_data_unavailable",
    "no_recovery_checkins_7d",
  ]);
  const nutritionMissing = hasAny(gaps, [
    "nutrition_data_unavailable",
    "no_nutrition_logs_14d",
  ]);
  const biomechanicsMissing = gaps.has("muscle_load_data_unavailable");
  const behaviorMissing = hasAny(gaps, [
    "current_context_unavailable",
    "training_rhythm_data_unavailable",
  ]);
  const hasHypotheses = (data?.hypotheses.length ?? 0) > 0;
  const hasResolvedHypothesis =
    data?.hypotheses.some(
      (hypothesis) => hypothesis.status === "supported" || hypothesis.status === "contradicted",
    ) ?? false;
  const hasDecisions = (data?.decisions.length ?? 0) > 0;

  const state = (missing: boolean, learned = true): ScientistState =>
    missing ? "needs_data" : learned ? "evidence_ready" : "learning";
  const detail = (value: ScientistState): string => {
    if (value === "evidence_ready") return isEnglish ? "Evidence available" : "Yra įrodymų";
    if (value === "learning") return isEnglish ? "Learning" : "Mokosi";
    return isEnglish ? "Needs data" : "Trūksta duomenų";
  };

  const rows: Scientist[] = [
    {
      label: "Training Scientist",
      icon: Activity,
      state: state(trainingMissing),
      detail: detail(state(trainingMissing)),
    },
    {
      label: "Recovery Scientist",
      icon: Sparkles,
      state: state(recoveryMissing),
      detail: detail(state(recoveryMissing)),
    },
    {
      label: "Sleep Scientist",
      icon: Moon,
      state: state(recoveryMissing),
      detail: detail(state(recoveryMissing)),
    },
    {
      label: "Nutrition Scientist",
      icon: Apple,
      state: state(nutritionMissing),
      detail: detail(state(nutritionMissing)),
    },
    {
      label: "Biomechanics Lab",
      icon: PersonStanding,
      state: state(biomechanicsMissing),
      detail: detail(state(biomechanicsMissing)),
    },
    {
      label: "Behavior Scientist",
      icon: UserRoundCheck,
      state: state(behaviorMissing),
      detail: detail(state(behaviorMissing)),
    },
    {
      label: "Statistician",
      icon: Sigma,
      state: state(false, hasHypotheses || hasDecisions),
      detail: detail(state(false, hasHypotheses || hasDecisions)),
    },
    {
      label: "Causal Scientist",
      icon: FlaskConical,
      state: state(false, hasResolvedHypothesis),
      detail: detail(state(false, hasResolvedHypothesis)),
    },
    {
      label: "Safety Guardian",
      icon: ShieldCheck,
      state: state(false, hasDecisions),
      detail: hasDecisions
        ? isEnglish
          ? "Decision guardrails present"
          : "Sprendimų apsaugos aktyvios"
        : isEnglish
          ? "Waiting for decision context"
          : "Laukia sprendimo konteksto",
    },
    {
      label: "Skeptic",
      icon: BrainCircuit,
      state: state(false, hasHypotheses),
      detail: hasHypotheses
        ? isEnglish
          ? "Evidence gates applied"
          : "Taikomos įrodymų ribos"
        : isEnglish
          ? "Waiting for hypotheses"
          : "Laukia hipotezių",
    },
  ];

  return (
    <section
      aria-label={t("nav.lab")}
      className="overflow-hidden rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88"
    >
      <header className="border-b border-[#16243c] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
              LAB STATUS
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {isEnglish ? "Evidence state by specialist" : "Įrodymų būsena pagal specialistą"}
            </p>
          </div>
          <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-cyan-300">
            {isEnglish ? "REAL DATA" : "REALŪS DUOMENYS"}
          </span>
        </div>
      </header>

      {query.isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-9 animate-pulse rounded-lg bg-white/[0.035]" />
          ))}
        </div>
      ) : query.isError || !data ? (
        <p className="p-4 text-xs leading-relaxed text-slate-500">
          {isEnglish
            ? "Lab evidence state is temporarily unavailable."
            : "Laboratorijos įrodymų būsena laikinai nepasiekiama."}
        </p>
      ) : (
        <div
          className={
            compact
              ? "divide-y divide-white/[0.045]"
              : "grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-5"
          }
        >
          {rows.map((row) => {
            const Icon = row.icon;
            return compact ? (
              <div key={row.label} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-slate-400">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-medium text-slate-200">
                    {row.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[8px] uppercase tracking-[0.1em] text-slate-600">
                    {row.detail}
                  </span>
                </span>
                <span
                  aria-label={row.detail}
                  className={`size-1.5 shrink-0 rounded-full ${TONE[row.state]}`}
                />
              </div>
            ) : (
              <article
                key={row.label}
                className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="size-4 text-violet-300" />
                  <span
                    aria-label={row.detail}
                    className={`size-1.5 rounded-full ${TONE[row.state]}`}
                  />
                </div>
                <p className="mt-3 truncate text-xs font-semibold text-white">{row.label}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-slate-600">
                  {row.detail}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
