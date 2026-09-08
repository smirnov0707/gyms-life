import { useId } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
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
import type { LabOverview } from "@/lib/lab.schema";
import { useLabOverview } from "./lab-overview.query";
import "./lab-roster-tiles.css";

type Module = {
  id: string;
  icon: LucideIcon;
  en: string;
  lt: string;
  gaps: LabOverview["dataGaps"];
  kind: "source" | "hypotheses" | "rules";
};

const MODULES: Module[] = [
  {
    id: "training",
    icon: Dumbbell,
    en: "Training Scientist",
    lt: "Treniruočių mokslas",
    gaps: ["training_data_unavailable", "no_completed_workouts_28d"],
    kind: "source",
  },
  {
    id: "recovery",
    icon: HeartPulse,
    en: "Recovery Scientist",
    lt: "Atsistatymo mokslas",
    gaps: ["recovery_data_unavailable", "no_recovery_checkins_7d"],
    kind: "source",
  },
  {
    id: "sleep",
    icon: Moon,
    en: "Sleep Scientist",
    lt: "Miego mokslas",
    gaps: ["recovery_data_unavailable", "no_recovery_checkins_7d"],
    kind: "source",
  },
  {
    id: "nutrition",
    icon: Salad,
    en: "Nutrition Scientist",
    lt: "Mitybos mokslas",
    gaps: ["nutrition_data_unavailable", "no_nutrition_logs_14d"],
    kind: "source",
  },
  {
    id: "biomechanics",
    icon: Activity,
    en: "Biomechanics Lab",
    lt: "Biomechanikos laboratorija",
    gaps: ["muscle_load_data_unavailable", "no_completed_workouts_28d"],
    kind: "source",
  },
  {
    id: "behavior",
    icon: BrainCircuit,
    en: "Behavior Scientist",
    lt: "Elgsenos mokslas",
    gaps: [
      "training_rhythm_data_unavailable",
      "current_context_unavailable",
      "no_completed_workouts_28d",
    ],
    kind: "source",
  },
  { id: "statistics", icon: Gauge, en: "Statistician", lt: "Statistikas", gaps: [], kind: "rules" },
  {
    id: "causal",
    icon: FlaskConical,
    en: "Causal Scientist",
    lt: "Priežastingumo tyrimai",
    gaps: [],
    kind: "hypotheses",
  },
  { id: "skeptic", icon: Sparkles, en: "Skeptic", lt: "Skeptikas", gaps: [], kind: "rules" },
  {
    id: "safety",
    icon: ShieldCheck,
    en: "Safety Guardian",
    lt: "Saugumo sergėtojas",
    gaps: [],
    kind: "rules",
  },
];

/** A source indicator describes available evidence, never an autonomous agent. */
export function LabRosterRows({
  data,
  status,
  tiles = false,
}: {
  data: Pick<LabOverview, "dataGaps" | "hypotheses"> | undefined;
  status: "loading" | "error" | "ready";
  tiles?: boolean;
}) {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const known = status === "ready" && data !== undefined;
  const gaps = new Set(data?.dataGaps ?? []);
  const restricted =
    gaps.has("personalization_consent_required") || gaps.has("personalization_consent_unavailable");
  return (
    <ul className={tiles ? "fl-lab-roster-tiles" : "divide-y divide-border/60"}>
      {MODULES.map((module) => {
        const Icon = module.icon;
        const waiting =
          known &&
          (restricted ||
            module.gaps.some((gap) => gaps.has(gap)) ||
            (module.kind === "hypotheses" && data?.hypotheses.length === 0));
        const label = !known
          ? english
            ? "Unknown"
            : "Nežinoma"
          : waiting
            ? english
              ? "Awaiting evidence"
              : "Laukia duomenų"
            : module.kind === "rules"
              ? english
                ? "Rules defined"
                : "Taisyklės apibrėžtos"
              : module.kind === "hypotheses"
                ? english
                  ? "Observing patterns"
                  : "Stebi dėsningumus"
                : english
                  ? "Source available"
                  : "Šaltinis pasiekiamas";
        const dot = !known
          ? "bg-muted-foreground/40"
          : waiting
            ? "bg-amber-400"
            : module.kind === "rules"
              ? "bg-violet-400"
              : "bg-emerald-400";
        return (
          <li
            key={module.id}
            className={
              tiles
                ? "relative flex min-w-0 flex-col items-center rounded-xl border border-border bg-surface-2/65 px-2 py-3 text-center"
                : "flex min-w-0 items-center gap-2.5 py-2.5"
            }
          >
            <span
              className={`grid shrink-0 place-items-center border border-violet-400/20 bg-violet-500/[0.06] text-violet-300 light:text-violet-700 ${tiles ? "fl-role-icon" : "size-7 rounded-lg"}`}
            >
              <Icon className={tiles ? "size-4" : "size-3.5"} strokeWidth={1.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block font-medium text-foreground ${tiles ? "fl-role-name" : "text-[11px]"}`}
              >
                {english ? module.en : module.lt}
              </span>
              <span
                className={`block text-muted-foreground ${tiles ? "fl-role-status" : "mt-0.5 text-[9px] leading-snug"}`}
              >
                {label}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${dot} ${tiles ? "absolute right-2 top-2" : ""}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function FutureLabRoster() {
  const { lang, t } = useI18n();
  const descriptionId = useId();
  const english = baseLang(lang) === "en";
  const query = useLabOverview();
  return (
    <section
      aria-describedby={descriptionId}
      className="fl-panel fl-lab-roster flex min-w-0 flex-col rounded-xl border border-border bg-surface/90 p-3"
    >
      <header className="border-b border-border/60 pb-2.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
          {t("ls.status")}
        </h2>
        <p className="mt-1 text-[9px] text-muted-foreground">
          {english ? "Your evidence, by domain" : "Tavo duomenys pagal sritį"}
        </p>
      </header>
      <p id={descriptionId} className="sr-only">
        {t("ls.body")}
      </p>
      <LabRosterRows
        data={query.isError ? undefined : query.data}
        status={query.isError ? "error" : query.data ? "ready" : "loading"}
      />
      <Link
        to="/lab"
        className="mt-2 flex min-h-9 items-center justify-between gap-2 rounded-lg border border-violet-400/20 bg-violet-500/[0.06] px-2.5 text-[10px] font-medium text-violet-300 light:text-violet-700"
      >
        {t("ls.open")}
        <ArrowUpRight className="size-3" />
      </Link>
    </section>
  );
}
