import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BrainCircuit,
  Dumbbell,
  FlaskConical,
  Gauge,
  HeartPulse,
  Moon,
  Salad,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLabOverview } from "@/lib/lab.functions";
import type { LabOverview } from "@/lib/lab.schema";

type Gap = LabOverview["dataGaps"][number];

type ModuleDefinition = {
  id: string;
  icon: LucideIcon;
  nameEn: string;
  nameLt: string;
  detailEn: string;
  detailLt: string;
  blockingGaps: Gap[];
};

const MODULES: ModuleDefinition[] = [
  {
    id: "training",
    icon: Dumbbell,
    nameEn: "Training Scientist",
    nameLt: "Treniruočių mokslas",
    detailEn: "Training response and load",
    detailLt: "Treniruočių reakcija ir krūvis",
    blockingGaps: ["training_data_unavailable", "no_completed_workouts_28d"],
  },
  {
    id: "recovery",
    icon: HeartPulse,
    nameEn: "Recovery Scientist",
    nameLt: "Atsistatymo mokslas",
    detailEn: "Readiness and recovery evidence",
    detailLt: "Readiness ir atsistatymo įrodymai",
    blockingGaps: ["recovery_data_unavailable", "no_recovery_checkins_7d"],
  },
  {
    id: "sleep",
    icon: Moon,
    nameEn: "Sleep Scientist",
    nameLt: "Miego mokslas",
    detailEn: "Sleep evidence from check-ins",
    detailLt: "Miego duomenys iš check-in",
    blockingGaps: ["recovery_data_unavailable", "no_recovery_checkins_7d"],
  },
  {
    id: "nutrition",
    icon: Salad,
    nameEn: "Nutrition Scientist",
    nameLt: "Mitybos mokslas",
    detailEn: "Logged nutrition patterns",
    detailLt: "Užregistruoti mitybos dėsningumai",
    blockingGaps: ["nutrition_data_unavailable", "no_nutrition_logs_14d"],
  },
  {
    id: "biomechanics",
    icon: Activity,
    nameEn: "Biomechanics Lab",
    nameLt: "Biomechanikos laboratorija",
    detailEn: "Muscle-load evidence",
    detailLt: "Raumenų krūvio įrodymai",
    blockingGaps: ["muscle_load_data_unavailable"],
  },
  {
    id: "behavior",
    icon: BrainCircuit,
    nameEn: "Behavior Scientist",
    nameLt: "Elgsenos mokslas",
    detailEn: "Training rhythm and context",
    detailLt: "Treniruočių ritmas ir kontekstas",
    blockingGaps: ["training_rhythm_data_unavailable", "current_context_unavailable"],
  },
  {
    id: "statistics",
    icon: Gauge,
    nameEn: "Statistician",
    nameLt: "Statistikas",
    detailEn: "Patterns and calibration",
    detailLt: "Dėsningumai ir kalibracija",
    blockingGaps: [],
  },
  {
    id: "causal",
    icon: FlaskConical,
    nameEn: "Causal Scientist",
    nameLt: "Priežastingumo tyrimai",
    detailEn: "Hypotheses under test",
    detailLt: "Tikrinamos hipotezės",
    blockingGaps: [],
  },
  {
    id: "safety",
    icon: ShieldCheck,
    nameEn: "Safety Guardian",
    nameLt: "Saugumo sergėtojas",
    detailEn: "Decision safety rules",
    detailLt: "Sprendimų saugumo taisyklės",
    blockingGaps: [],
  },
  {
    id: "skeptic",
    icon: Sparkles,
    nameEn: "Skeptic",
    nameLt: "Skeptikas",
    detailEn: "Challenges weak evidence",
    detailLt: "Tikrina silpnus įrodymus",
    blockingGaps: [],
  },
];

const STATEMENTS = {
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Ar pasikartojantis sunkumo jausmas rodo susikaupusį treniruočių nuovargį?",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Kaip tavo atliktos treniruotės dera su įprastu treniruočių ritmu?",
  },
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Does repeated session difficulty indicate accumulating training fatigue?",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "How do completed sessions fit your usual training rhythm?",
  },
} as const;

function statusForModule(module: ModuleDefinition, gaps: Set<Gap>): "ready" | "waiting" {
  return module.blockingGaps.some((gap) => gaps.has(gap)) ? "waiting" : "ready";
}

function CalibrationRing({ percent }: { percent: number }) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return (
    <div className="relative grid size-24 place-items-center">
      <svg className="absolute inset-0 size-24 -rotate-90" aria-hidden="true">
        <circle cx="48" cy="48" r={radius} fill="transparent" stroke="rgba(148,163,184,.14)" strokeWidth="7" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="transparent"
          stroke="rgb(34 211 238)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="text-center">
        <p className="font-mono text-2xl font-semibold text-white">{percent}%</p>
        <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-cyan-300">evidence</p>
      </div>
    </div>
  );
}

export function LabCommandDeck() {
  const { lang } = useI18n();
  const locale = baseLang(lang);
  const isEnglish = locale === "en";
  const timeZone = browserTimeZone();
  const query = useQuery({
    queryKey: ["future-lab-command-deck", timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    staleTime: 60_000,
  });
  const data = query.data;
  const gaps = new Set<Gap>(data?.dataGaps ?? []);
  const primary = data?.hypotheses[0] ?? null;
  const calibration = data?.predictionCalibration ?? null;
  const evaluated = calibration?.totalEvaluated ?? 0;
  const minimum = calibration?.minimumEvaluated ?? 8;
  const calibrationEvidence = Math.min(100, Math.round((evaluated / minimum) * 100));
  const statement = primary
    ? (STATEMENTS[locale][primary.statementKey as keyof (typeof STATEMENTS)[typeof locale]] ??
      (isEnglish ? "A personal pattern is under investigation." : "Tiriamas asmeninis dėsningumas."))
    : null;
  const evidenceProgress = primary
    ? Math.min(100, Math.round((primary.evidenceCount / primary.minimumEvidenceCount) * 100))
    : 0;

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[#182846] bg-[#030914] p-4 sm:p-5 lg:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(124,58,237,.14),transparent_27%),radial-gradient(circle_at_88%_8%,rgba(6,182,212,.10),transparent_24%)]"
      />
      <div className="relative">
        <header className="flex flex-col gap-3 border-b border-[#17243b] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-violet-300">LAB COMMAND DECK</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {isEnglish ? "Your performance laboratory" : "Tavo performance laboratorija"}
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
              {isEnglish
                ? "Each module reports what evidence is available. Waiting means a required data source is missing — not that an agent failed."
                : "Kiekvienas modulis rodo realią įrodymų būklę. „Laukia“ reiškia, kad trūksta būtino duomenų šaltinio — ne kad sugedo AI agentas."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#1a2941] bg-[#07111d] px-3 py-2">
            <span className={`size-2 rounded-full ${query.isError ? "bg-rose-400" : query.isLoading ? "bg-amber-300" : "bg-emerald-400"}`} />
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300">
              {query.isError
                ? isEnglish
                  ? "LAB DATA UNAVAILABLE"
                  : "LAB DUOMENYS NEPASIEKIAMI"
                : query.isLoading
                  ? isEnglish
                    ? "SYNCING"
                    : "SINCHRONIZUOJAMA"
                  : isEnglish
                    ? "EVIDENCE INDEX ONLINE"
                    : "ĮRODYMŲ INDEKSAS VEIKIA"}
            </span>
          </div>
        </header>

        <div className="mt-4 grid gap-3 xl:grid-cols-[.9fr_1.15fr_.75fr]">
          <section className="rounded-[1.4rem] border border-[#17243b] bg-[#07111d]/78 p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">LAB STATUS</p>
            <div className="mt-3 divide-y divide-white/[0.05]">
              {MODULES.map((module) => {
                const Icon = module.icon;
                const status = statusForModule(module, gaps);
                return (
                  <div key={module.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#1a2941] bg-[#091522] text-violet-300">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-100">
                        {isEnglish ? module.nameEn : module.nameLt}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] text-slate-600">
                        {isEnglish ? module.detailEn : module.detailLt}
                      </span>
                    </span>
                    <span
                      className={`size-2 shrink-0 rounded-full ${status === "ready" ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.65)]" : "bg-amber-300"}`}
                      title={
                        status === "ready"
                          ? isEnglish
                            ? "Evidence path available"
                            : "Duomenų kelias prieinamas"
                          : isEnglish
                            ? "Waiting for required evidence"
                            : "Laukiama būtinų įrodymų"
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[1.4rem] border border-[#17243b] bg-[#07111d]/78 p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(124,58,237,.11),transparent_40%)]"
            />
            <div className="relative">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
                {isEnglish ? "CURRENT INVESTIGATION" : "DABARTINIS TYRIMAS"}
              </p>
              {query.isError ? (
                <p className="mt-6 text-sm text-slate-500">
                  {isEnglish ? "Investigation data is unavailable." : "Tyrimo duomenys nepasiekiami."}
                </p>
              ) : primary ? (
                <>
                  <p className="mt-5 max-w-xl text-xl leading-relaxed text-white sm:text-2xl">{statement}</p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600">
                        {isEnglish ? "EVIDENCE" : "ĮRODYMAI"}
                      </p>
                      <p className="mt-2 font-mono text-xl text-white">
                        {primary.evidenceCount}/{primary.minimumEvidenceCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600">
                        {isEnglish ? "STATUS" : "BŪSENA"}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                        {primary.status.replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                      style={{ width: `${evidenceProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-slate-600">
                    {evidenceProgress}% {isEnglish ? "of evidence threshold" : "įrodymų ribos"}
                  </p>
                </>
              ) : (
                <p className="mt-6 text-sm text-slate-500">
                  {isEnglish
                    ? "No deterministic hypothesis is currently under investigation."
                    : "Šiuo metu nėra aktyviai tiriamos deterministinės hipotezės."}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-[#17243b] bg-[#07111d]/78 p-5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              {isEnglish ? "PREDICTION CALIBRATION" : "PROGNOZIŲ KALIBRACIJA"}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <CalibrationRing percent={calibrationEvidence} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {isEnglish ? "Shadow model maturity" : "Shadow modelio branda"}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  {evaluated}/{minimum} {isEnglish ? "evaluated outcomes required" : "reikalingų įvertintų rezultatų"}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-[10px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">{isEnglish ? "Target" : "Tikslas"}</span>
                <span className="font-mono text-slate-200">workout_completion</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">{isEnglish ? "Captured" : "Užfiksuota"}</span>
                <span className="font-mono text-slate-200">{calibration?.totalCaptured ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">{isEnglish ? "Pending" : "Laukia"}</span>
                <span className="font-mono text-slate-200">{calibration?.totalPending ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">{isEnglish ? "Mode" : "Režimas"}</span>
                <span className="font-mono uppercase text-violet-300">shadow</span>
              </div>
            </div>
            <p className="mt-4 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.035] p-3 text-[10px] leading-relaxed text-slate-500">
              {isEnglish
                ? "This is evidence maturity, not prediction confidence. Shadow forecasts do not influence Today."
                : "Tai įrodymų branda, ne prediction confidence. Shadow prognozės nedaro įtakos Today."}
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
