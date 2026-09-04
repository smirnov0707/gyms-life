import { useQuery } from "@tanstack/react-query";
import { Brain, FlaskConical, Loader2 } from "lucide-react";
import { GlowCard } from "@/components/GlowCard";
import { useI18n } from "@/lib/i18n";
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
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "LAB",
      title: "What GYMS.LIFE is investigating",
      description:
        "Real hypotheses and recent decisions, with their evidence — never a generated story.",
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
    };
  }

  return {
    eyebrow: "LABORATORIJA",
    title: "Ką GYMS.LIFE tiria",
    description:
      "Realios hipotezės ir naujausi sprendimai su jų įrodymais — ne sugeneruota istorija.",
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
  };
}

function statusTone(status: HypothesisStatus): string {
  if (status === "supported") return "text-primary";
  if (status === "contradicted") return "text-rose-400";
  if (status === "monitoring") return "text-accent";
  return "text-muted-foreground";
}

function HypothesisCard({ hypothesis, copy }: { hypothesis: AthleteHypothesis; copy: Copy }) {
  return (
    <article className="rounded-2xl border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {copy.domainLabel[hypothesis.domain]}
        </span>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${statusTone(hypothesis.status)}`}
        >
          {copy.statusLabel[hypothesis.status]}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
        {copy.statementLabel[hypothesis.statementKey] ?? copy.statementFallback}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {copy.evidenceCount(hypothesis.evidenceCount)}
        {/* Only show the target when evidence is genuinely short of it.
            A hypothesis can hold enough evidence and still be "monitoring"
            for other reasons; "12 / 8" would misread as insufficient. */}
        {hypothesis.evidenceCount < hypothesis.minimumEvidenceCount
          ? ` / ${hypothesis.minimumEvidenceCount}`
          : ""}
      </p>
    </article>
  );
}

function DecisionRow({ decision, copy }: { decision: LabDecision; copy: Copy }) {
  return (
    <article className="rounded-2xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground">{decision.decisionOn}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {decision.outcome ? copy.outcomeLabel[decision.outcome] : copy.noOutcome}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">
        {copy.actionLabel[decision.action]}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{copy.basisLabel[decision.basis]}</p>
      {decision.evidence.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {decision.evidence.map((item) => (
            <li key={item.key}>
              {item.key.replaceAll("_", " ")}: {item.value}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/**
 * Presentational half of the Lab page, kept free of data fetching so the
 * layout can be rendered and reviewed from a known overview.
 */
export function LabOverviewView({ data, copy }: { data: LabOverview; copy: Copy }) {
  return (
    <div className="space-y-6">
      <GlowCard className="panel relative overflow-hidden p-6 md:p-7">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          <FlaskConical className="size-4" /> {copy.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {copy.description}
        </p>
      </GlowCard>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Brain className="size-4 text-primary" /> {copy.hypothesesTitle}
        </h2>
        {data.hypotheses.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-surface-2 p-4 text-sm text-muted-foreground">
            {copy.hypothesesEmpty}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.hypotheses.map((hypothesis) => (
              <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} copy={copy} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">{copy.decisionsTitle}</h2>
        {data.decisions.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-surface-2 p-4 text-sm text-muted-foreground">
            {copy.decisionsEmpty}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.decisions.map((decision) => (
              <DecisionRow key={decision.id} decision={decision} copy={copy} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Container: loads the overview and hands it to the presentational view. */
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
      <section className="panel p-6">
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
