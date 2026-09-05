import { useQuery } from "@tanstack/react-query";
import { Brain, FlaskConical, Loader2 } from "lucide-react";
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
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
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
      accuracyTitle: "How our proposals landed",
      accuracyNote:
        "How often a proposed action was taken up, grouped by what the decision was based on. This is not a measure of whether the training advice was right — only whether it fitted your day.",
      accuracyPending: (needed) =>
        `At least ${needed} answered decisions are needed before a rate is shown.`,
      fitRate: "Taken up",
      answeredOf: (answered, proposed) => `${answered} answered of ${proposed} proposed`,
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
    accuracyTitle: "Kaip pavyko mūsų pasiūlymai",
    accuracyNote:
      "Kaip dažnai pasiūlytas veiksmas buvo priimtas, pagal sprendimo pagrindą. Tai nematuoja, ar treniruočių patarimas buvo teisingas — tik ar jis tiko tavo dienai.",
    accuracyPending: (needed) =>
      `Reikia bent ${needed} atsakytų sprendimų, kad būtų rodomas santykis.`,
    fitRate: "Priimta",
    answeredOf: (answered, proposed) => `atsakyta ${answered} iš ${proposed} pasiūlytų`,
  };
}

function statusTone(status: HypothesisStatus): string {
  if (status === "supported") return "text-emerald-300";
  if (status === "contradicted") return "text-rose-400";
  if (status === "monitoring") return "text-amber-300";
  return "text-neutral-500";
}

function HypothesisSignal({ hypothesis, copy }: { hypothesis: AthleteHypothesis; copy: Copy }) {
  const progress = Math.min(
    100,
    Math.round((hypothesis.evidenceCount / Math.max(hypothesis.minimumEvidenceCount, 1)) * 100),
  );

  return (
    <article className="border-b border-white/[0.06] py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-600">
          {copy.domainLabel[hypothesis.domain]}
        </span>
        <span
          className={`text-[9px] font-bold uppercase tracking-[0.16em] ${statusTone(hypothesis.status)}`}
        >
          {copy.statusLabel[hypothesis.status]}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-200">
        {copy.statementLabel[hypothesis.statementKey] ?? copy.statementFallback}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-px flex-1 overflow-hidden bg-white/[0.07]">
          <div className="h-full bg-emerald-400/70" style={{ width: `${progress}%` }} />
        </div>
        <span className="shrink-0 font-mono text-[10px] text-neutral-600">
          {copy.evidenceCount(hypothesis.evidenceCount)}
        </span>
      </div>
    </article>
  );
}

function DecisionTrace({ decision, copy }: { decision: LabDecision; copy: Copy }) {
  return (
    <article className="relative border-l border-white/[0.08] pb-5 pl-5 last:pb-0">
      <span className="absolute -left-[4px] top-1 size-[7px] rounded-full border border-emerald-400/50 bg-[#050706]" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-neutral-600">{decision.decisionOn}</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-neutral-500">
          {decision.outcome ? copy.outcomeLabel[decision.outcome] : copy.noOutcome}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium text-neutral-200">
        {copy.actionLabel[decision.action]}
      </p>
      <p className="mt-1 text-xs text-neutral-600">{copy.basisLabel[decision.basis]}</p>
      {decision.evidence.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {decision.evidence.slice(0, 3).map((item) => (
            <span
              key={item.key}
              className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[9px] text-neutral-600"
            >
              {item.key.replaceAll("_", " ")} · {item.value}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function LabOverviewView({ data, copy }: { data: LabOverview; copy: Copy }) {
  const activeHypothesis =
    data.hypotheses.find((hypothesis) => hypothesis.status === "monitoring") ?? data.hypotheses[0];
  const supported = data.hypotheses.filter((hypothesis) => hypothesis.status === "supported").length;
  const unresolved = data.hypotheses.filter(
    (hypothesis) =>
      hypothesis.status === "monitoring" || hypothesis.status === "insufficient_evidence",
  ).length;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] px-5 py-6 sm:px-7 sm:py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(58% 70% at 50% 30%, rgba(16,185,129,.11), transparent 70%), radial-gradient(55% 45% at 100% 0%, rgba(255,255,255,.035), transparent 75%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative z-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
                <FlaskConical className="size-4" /> {copy.eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {copy.title}
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-neutral-500">
                {copy.description}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-5 border-t border-white/[0.06] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div>
                <p className="font-mono text-xl text-white">{data.hypotheses.length}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-neutral-600">
                  {copy.hypothesesTitle}
                </p>
              </div>
              <div>
                <p className="font-mono text-xl text-emerald-300">{supported}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-neutral-600">
                  {copy.statusLabel.supported}
                </p>
              </div>
              <div>
                <p className="font-mono text-xl text-amber-300">{unresolved}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-neutral-600">
                  {copy.statusLabel.monitoring}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <div className="relative min-h-[360px] overflow-hidden rounded-[1.75rem] border border-white/[0.06] bg-black/30 p-5 sm:p-7">
              <div className="absolute left-1/2 top-1/2 size-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/[0.08]" />
              <div className="absolute left-1/2 top-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/[0.10]" />
              <div className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/[0.14] bg-emerald-400/[0.025]" />

              <div className="relative z-10 flex h-full min-h-[310px] flex-col justify-between">
                <div>
                  <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                    <Brain className="size-3.5 text-emerald-400" /> {copy.hypothesesTitle}
                  </p>
                  {activeHypothesis ? (
                    <div className="mt-4 max-w-xl">
                      <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${statusTone(activeHypothesis.status)}`}>
                        {copy.domainLabel[activeHypothesis.domain]} · {copy.statusLabel[activeHypothesis.status]}
                      </p>
                      <p className="mt-3 text-xl font-medium leading-relaxed text-white sm:text-2xl">
                        {copy.statementLabel[activeHypothesis.statementKey] ?? copy.statementFallback}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 max-w-lg text-sm leading-relaxed text-neutral-500">
                      {copy.hypothesesEmpty}
                    </p>
                  )}
                </div>

                {activeHypothesis ? (
                  <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-white/[0.06] pt-4">
                    <div>
                      <p className="font-mono text-2xl text-white">{activeHypothesis.evidenceCount}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-neutral-600">
                        {copy.evidenceCount(activeHypothesis.evidenceCount)}
                      </p>
                    </div>
                    <p className="max-w-xs text-right text-xs leading-relaxed text-neutral-600">
                      {copy.statusLabel[activeHypothesis.status]}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="rounded-[1.75rem] border border-white/[0.06] bg-white/[0.02] px-5 py-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                  {copy.hypothesesTitle}
                </p>
                <span className="font-mono text-[10px] text-neutral-700">{data.hypotheses.length}</span>
              </div>
              {data.hypotheses.length === 0 ? (
                <p className="py-5 text-sm leading-relaxed text-neutral-600">{copy.hypothesesEmpty}</p>
              ) : (
                data.hypotheses.map((hypothesis) => (
                  <HypothesisSignal key={hypothesis.id} hypothesis={hypothesis} copy={copy} />
                ))
              )}
            </aside>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
        <div className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">{copy.decisionsTitle}</h2>
            <span className="font-mono text-[10px] text-neutral-700">14D</span>
          </div>
          {data.decisions.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">{copy.decisionsEmpty}</p>
          ) : (
            <div className="mt-5">
              {data.decisions.slice(0, 6).map((decision) => (
                <DecisionTrace key={decision.id} decision={decision} copy={copy} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">{copy.accuracyTitle}</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-600">{copy.accuracyNote}</p>
          {data.decisionAccuracy.byBasis.length === 0 ? (
            <p className="mt-5 text-sm text-neutral-600">{copy.decisionsEmpty}</p>
          ) : (
            <div className="mt-5 space-y-5">
              {data.decisionAccuracy.byBasis.map((entry) => (
                <div key={entry.basis}>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-600">
                        {copy.basisLabel[entry.basis]}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {copy.answeredOf(entry.answered, entry.proposed)}
                      </p>
                    </div>
                    {entry.fitRate === null ? (
                      <span className="max-w-[150px] text-right text-[10px] leading-relaxed text-neutral-700">
                        {copy.accuracyPending(data.decisionAccuracy.minimumAnswered)}
                      </span>
                    ) : (
                      <span className="font-mono text-xl text-white">
                        {Math.round(entry.fitRate * 100)}%
                      </span>
                    )}
                  </div>
                  {entry.fitRate !== null ? (
                    <div className="mt-2 h-px overflow-hidden bg-white/[0.07]">
                      <div
                        className="h-full bg-emerald-400/70"
                        style={{ width: `${Math.round(entry.fitRate * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
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
      <section className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-neutral-500">{copy.unavailable}</p>;
  }

  return <LabOverviewView data={data} copy={copy} />;
}

export { copyFor as labCopyFor };
