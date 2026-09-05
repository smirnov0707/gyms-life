import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, ChevronDown, FlaskConical, Loader2 } from "lucide-react";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLabOverview } from "@/lib/lab.functions";
import type {
  AthleteHypothesis,
  AthleteHypothesisStatusSchema,
  AthleteLearningDomainSchema,
} from "@/lib/athlete-hypothesis.schema";
import type { LabDecision, LabOverview } from "@/lib/lab.schema";
import type { z } from "zod";

type HypothesisStatus = z.infer<typeof AthleteHypothesisStatusSchema>;
type LearningDomain = z.infer<typeof AthleteLearningDomainSchema>;

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  unavailable: string;
  hypothesesTitle: string;
  hypothesesEmpty: string;
  decisionsTitle: string;
  decisionsEmpty: string;
  statusLabel: Record<HypothesisStatus, string>;
  domainLabel: Record<LearningDomain, string>;
  statementLabel: Record<string, string>;
  statementFallback: string;
  basisLabel: Record<LabDecision["basis"], string>;
  actionLabel: Record<LabDecision["action"], string>;
  outcomeLabel: Record<NonNullable<LabDecision["outcome"]>, string>;
  noOutcome: string;
  evidenceCount: (count: number) => string;
  accuracyTitle: string;
  accuracyNote: string;
  accuracyPending: (needed: number) => string;
  fitRate: string;
  answeredOf: (answered: number, proposed: number) => string;
  currentInvestigation: string;
  evidenceProgress: string;
  otherInvestigations: string;
  decisionHistory: string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      eyebrow: "LAB",
      title: "What your system is learning",
      description:
        "Patterns are treated as hypotheses until your own evidence supports or contradicts them.",
      loading: "Loading your Lab data…",
      unavailable: "Lab is temporarily unavailable.",
      hypothesesTitle: "Hypotheses",
      hypothesesEmpty:
        "No hypotheses are being tracked yet. Keep logging real training data and this will fill in.",
      decisionsTitle: "Recent decisions",
      decisionsEmpty: "No Today decisions in the last 14 days.",
      statusLabel: {
        insufficient_evidence: "Not enough evidence yet",
        monitoring: "Monitoring",
        supported: "Supported",
        contradicted: "Contradicted",
      },
      domainLabel: {
        training_response: "Training response",
        training_behavior: "Training behavior",
        recovery: "Recovery",
        nutrition: "Nutrition",
        performance: "Performance",
      },
      statementLabel: {
        "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
          "Recent sessions have repeatedly felt difficult.",
        "athlete.hypothesis.trainingBehavior.usualDayFit":
          "How well completed sessions fit your usual training days.",
      },
      statementFallback: "A new pattern is being tracked.",
      basisLabel: {
        safety_rule: "Safety rule",
        current_day_fact: "Today's fact",
        current_checkin: "Today's check-in",
        observed_pattern: "Observed pattern",
      },
      actionLabel: {
        generate_training_plan: "Build training plan",
        complete_readiness: "Check readiness",
        recover: "Recover",
        train_adapted: "Train (adapted)",
        train_as_planned: "Train as planned",
        log_nutrition: "Log nutrition",
      },
      outcomeLabel: {
        accepted: "Accepted",
        dismissed: "Dismissed",
        completed: "Completed",
        not_helpful: "Marked not helpful",
      },
      noOutcome: "No response yet",
      evidenceCount: (count) => `${count} evidence point${count === 1 ? "" : "s"}`,
      accuracyTitle: "Decision fit",
      accuracyNote:
        "How often a proposed action was taken up. This measures fit with your day, not whether advice was medically or scientifically correct.",
      accuracyPending: (needed) =>
        `At least ${needed} answered decisions are needed before a rate is shown.`,
      fitRate: "Taken up",
      answeredOf: (answered, proposed) => `${answered} answered of ${proposed} proposed`,
      currentInvestigation: "Current investigation",
      evidenceProgress: "Evidence progress",
      otherInvestigations: "Other investigations",
      decisionHistory: "Decision history & fit",
    };
  }

  return {
    eyebrow: "LABORATORIJA",
    title: "Ką tavo sistema mokosi suprasti",
    description:
      "Dėsningumai laikomi hipotezėmis tol, kol tavo paties duomenys juos patvirtina arba paneigia.",
    loading: "Kraunami laboratorijos duomenys…",
    unavailable: "Laboratorija šiuo metu nepasiekiama.",
    hypothesesTitle: "Hipotezės",
    hypothesesEmpty:
      "Kol kas hipotezių nesekama. Toliau registruok realius treniruočių duomenis ir šis skyrius užsipildys.",
    decisionsTitle: "Naujausi sprendimai",
    decisionsEmpty: "Per pastarąsias 14 dienų šiandienos sprendimų nėra.",
    statusLabel: {
      insufficient_evidence: "Kol kas nepakanka įrodymų",
      monitoring: "Stebima",
      supported: "Patvirtinta",
      contradicted: "Paneigta",
    },
    domainLabel: {
      training_response: "Reakcija į treniruotę",
      training_behavior: "Treniruočių įprotis",
      recovery: "Atsistatymas",
      nutrition: "Mityba",
      performance: "Rezultatai",
    },
    statementLabel: {
      "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
        "Paskutinės treniruotės pakartotinai jautėsi sunkios.",
      "athlete.hypothesis.trainingBehavior.usualDayFit":
        "Kaip baigtos treniruotės atitinka tavo įprastas treniruočių dienas.",
    },
    statementFallback: "Sekamas naujas dėsningumas.",
    basisLabel: {
      safety_rule: "Saugumo taisyklė",
      current_day_fact: "Šios dienos faktas",
      current_checkin: "Šiandienos check-in",
      observed_pattern: "Pastebėtas dėsningumas",
    },
    actionLabel: {
      generate_training_plan: "Sukurti planą",
      complete_readiness: "Įvertinti pasiruošimą",
      recover: "Atsistatymas",
      train_adapted: "Treniruotė (adaptuota)",
      train_as_planned: "Treniruotė pagal planą",
      log_nutrition: "Registruoti mitybą",
    },
    outcomeLabel: {
      accepted: "Priimta",
      dismissed: "Atmesta",
      completed: "Atlikta",
      not_helpful: "Pažymėta kaip netinkama",
    },
    noOutcome: "Dar be atsakymo",
    evidenceCount: (count) => `${count} įrodymo taškas(-ai)`,
    accuracyTitle: "Sprendimų atitikimas",
    accuracyNote:
      "Kaip dažnai pasiūlytas veiksmas buvo priimtas. Tai matuoja atitikimą tavo dienai, o ne medicininį ar mokslinį patarimo teisingumą.",
    accuracyPending: (needed) =>
      `Reikia bent ${needed} atsakytų sprendimų, kad būtų rodomas santykis.`,
    fitRate: "Priimta",
    answeredOf: (answered, proposed) => `atsakyta ${answered} iš ${proposed} pasiūlytų`,
    currentInvestigation: "Dabartinis tyrimas",
    evidenceProgress: "Įrodymų progresas",
    otherInvestigations: "Kiti tyrimai",
    decisionHistory: "Sprendimų istorija ir atitikimas",
  };
}

function statusTone(status: HypothesisStatus): string {
  // These rows sit on the page ground rather than the dark stage, so each
  // tone carries a light-mode shade: a 400-weight accent that reads on
  // onyx disappears on near-white.
  if (status === "supported") return "text-emerald-400 light:text-emerald-700";
  if (status === "contradicted") return "text-rose-400 light:text-rose-700";
  if (status === "monitoring") return "text-amber-300 light:text-amber-700";
  return "text-muted-foreground";
}

function progressFor(hypothesis: AthleteHypothesis): number {
  if (hypothesis.minimumEvidenceCount <= 0) return 100;
  return Math.min(
    100,
    Math.round((hypothesis.evidenceCount / hypothesis.minimumEvidenceCount) * 100),
  );
}

function HypothesisRow({ hypothesis, copy }: { hypothesis: AthleteHypothesis; copy: Copy }) {
  return (
    <article className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {copy.domainLabel[hypothesis.domain]}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {copy.statementLabel[hypothesis.statementKey] ?? copy.statementFallback}
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] ${statusTone(hypothesis.status)}`}
        >
          {copy.statusLabel[hypothesis.status]}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className="h-full rounded-full bg-emerald-400/70"
            style={{ width: `${progressFor(hypothesis)}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {hypothesis.evidenceCount}/{hypothesis.minimumEvidenceCount}
        </span>
      </div>
    </article>
  );
}

function DecisionRow({ decision, copy }: { decision: LabDecision; copy: Copy }) {
  return (
    <article className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{copy.actionLabel[decision.action]}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {decision.decisionOn} · {copy.basisLabel[decision.basis]}
        </p>
      </div>
      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {decision.outcome ? copy.outcomeLabel[decision.outcome] : copy.noOutcome}
      </span>
    </article>
  );
}

export function LabOverviewView({ data, copy }: { data: LabOverview; copy: Copy }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const primary = data.hypotheses[0] ?? null;
  const secondary = data.hypotheses.slice(1);

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 120% at 0% 0%, rgba(16,185,129,.10), transparent 64%), radial-gradient(55% 90% at 100% 100%, rgba(245,158,11,.05), transparent 68%)",
          }}
        />

        <div className="relative">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
            <FlaskConical className="size-4" /> {copy.eyebrow}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            {copy.description}
          </p>

          {primary ? (
            <div className="mt-8 grid gap-7 border-t border-white/[0.06] pt-7 lg:grid-cols-[1fr_260px] lg:items-end">
              <div>
                <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                  <Brain className="size-3.5 text-emerald-400" /> {copy.currentInvestigation}
                </p>
                <p className="mt-3 max-w-2xl text-xl leading-relaxed text-white sm:text-2xl">
                  {copy.statementLabel[primary.statementKey] ?? copy.statementFallback}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold uppercase tracking-[0.14em]">
                  <span className="text-neutral-500">{copy.domainLabel[primary.domain]}</span>
                  <span className={statusTone(primary.status)}>
                    {copy.statusLabel[primary.status]}
                  </span>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/[0.07] bg-black/30 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-600">
                      {copy.evidenceProgress}
                    </p>
                    <p className="mt-2 font-mono text-4xl tracking-[-0.06em] text-white">
                      {primary.evidenceCount}
                      <span className="ml-1 text-lg text-neutral-600">
                        / {primary.minimumEvidenceCount}
                      </span>
                    </p>
                  </div>
                  <span className="font-mono text-xs text-neutral-600">
                    {progressFor(primary)}%
                  </span>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${progressFor(primary)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-8 border-t border-white/[0.06] pt-7 text-sm text-neutral-500">
              {copy.hypothesesEmpty}
            </p>
          )}
        </div>
      </section>

      {secondary.length > 0 ? (
        <section className="rounded-[1.75rem] border border-border bg-surface-2 px-5 py-2 sm:px-6">
          <p className="pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {copy.otherInvestigations}
          </p>
          <div className="mt-1">
            {secondary.map((hypothesis) => (
              <HypothesisRow key={hypothesis.id} hypothesis={hypothesis} copy={copy} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-surface-2">
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">{copy.decisionHistory}</p>
            <p className="mt-1 text-xs text-muted-foreground">{copy.accuracyNote}</p>
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`}
          />
        </button>

        {historyOpen ? (
          <div className="grid gap-0 border-t border-border lg:grid-cols-2">
            <div className="px-5 py-4 sm:px-6 lg:border-r lg:border-border">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {copy.decisionsTitle}
              </p>
              {data.decisions.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{copy.decisionsEmpty}</p>
              ) : (
                <div className="mt-1">
                  {data.decisions.map((decision) => (
                    <DecisionRow key={decision.id} decision={decision} copy={copy} />
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4 sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {copy.accuracyTitle}
              </p>
              <div className="mt-2 space-y-3">
                {data.decisionAccuracy.byBasis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.decisionsEmpty}</p>
                ) : (
                  data.decisionAccuracy.byBasis.map((entry) => (
                    <div
                      key={entry.basis}
                      className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {copy.basisLabel[entry.basis]}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {copy.answeredOf(entry.answered, entry.proposed)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {entry.fitRate === null ? (
                          <p className="max-w-36 text-[10px] leading-relaxed text-muted-foreground">
                            {copy.accuracyPending(data.decisionAccuracy.minimumAnswered)}
                          </p>
                        ) : (
                          <p className="font-mono text-2xl text-foreground">
                            {Math.round(entry.fitRate * 100)}%
                            <span className="ml-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                              {copy.fitRate}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function LabView() {
  const { lang } = useI18n();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lab-overview", timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-border bg-surface-2 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">{copy.unavailable}</p>;
  }

  return <LabOverviewView data={data} copy={copy} />;
}

export { copyFor as labCopyFor };
