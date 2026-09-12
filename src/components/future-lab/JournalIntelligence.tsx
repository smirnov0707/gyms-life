import { useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FlaskConical,
  History,
  Microscope,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { FutureLabEmpty, FutureLabPanel } from "./FutureLabPanel";
import { HypothesisEvidence } from "./HypothesisEvidence";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";
import { useLabOverview } from "./lab-overview.query";
import type { LabDecision } from "@/lib/lab.schema";
import type { AthleteHypothesis } from "@/lib/athlete-hypothesis.schema";
import "./journal-stats.css";
import "./reference-page-density.css";

const statements = {
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Paskutinės treniruotės pakartotinai jautėsi sunkios.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Kaip baigtos treniruotės atitinka tavo įprastas treniruočių dienas.",
  },
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Recent sessions have repeatedly felt difficult.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "How completed sessions fit your usual training days.",
  },
} as const;

type JournalTab = "all" | "discoveries" | "experiments" | "decisions";

type JournalStat = {
  /** Null while the ledger has not been read: a count nobody counted. */
  value: number | null;
  label: string;
  icon: LucideIcon;
  tone: string;
};

const ACTION_LABEL: Record<LabDecision["action"], { lt: string; en: string }> = {
  generate_training_plan: { lt: "Sukurti treniruočių planą", en: "Build training plan" },
  complete_readiness: { lt: "Įvertinti pasiruošimą", en: "Complete readiness" },
  recover: { lt: "Skirti dieną atsistatymui", en: "Prioritize recovery" },
  train_adapted: { lt: "Atlikti adaptuotą treniruotę", en: "Train with adaptation" },
  train_as_planned: { lt: "Treniruotis pagal planą", en: "Train as planned" },
  log_nutrition: { lt: "Registruoti mitybą", en: "Log nutrition" },
};

const OUTCOME_LABEL: Record<NonNullable<LabDecision["outcome"]>, { lt: string; en: string }> = {
  accepted: { lt: "Priimta", en: "Accepted" },
  dismissed: { lt: "Atmesta", en: "Dismissed" },
  completed: { lt: "Atlikta", en: "Completed" },
  not_helpful: { lt: "Nepadėjo", en: "Not helpful" },
};

function progressFor(hypothesis: AthleteHypothesis): number {
  if (hypothesis.minimumEvidenceCount <= 0) return 100;
  return Math.min(
    100,
    Math.round((hypothesis.evidenceCount / hypothesis.minimumEvidenceCount) * 100),
  );
}

function statusTone(status: AthleteHypothesis["status"]): string {
  if (status === "supported") return "text-emerald-300";
  if (status === "contradicted") return "text-rose-300";
  if (status === "monitoring") return "text-cyan-300";
  return "text-amber-300";
}

export function JournalIntelligence() {
  const { lang } = useI18n();
  const locale = baseLang(lang);
  const english = locale === "en";
  const [tab, setTab] = useState<JournalTab>("all");
  const query = useLabOverview();
  const data = query.data;
  // Four counters off one query. With `data` null they all fall to zero, which
  // tells the athlete their ledger is empty when the truth is that nobody
  // managed to open it — and an empty ledger is a thing they might act on.
  const counted = !query.isError && !query.isLoading && data != null;
  const supported = data?.hypotheses.filter((item) => item.status === "supported") ?? [];
  const monitoring =
    data?.hypotheses.filter(
      (item) => item.status === "monitoring" || item.status === "insufficient_evidence",
    ) ?? [];
  const contradicted = data?.hypotheses.filter((item) => item.status === "contradicted") ?? [];
  const statement = (key: string) =>
    statements[locale][key as keyof (typeof statements)[typeof locale]] ??
    (english ? "A personal pattern is being evaluated." : "Vertinamas asmeninis dėsningumas.");

  const copy = english
    ? {
        eyebrow: "JOURNAL · LEARNING LEDGER",
        title: "Journal",
        subtitle: "Hypotheses, discoveries and decisions, with their evidence.",
        hypotheses: "Hypotheses",
        discoveries: "Discoveries",
        experiments: "Patterns",
        decisions: "Decisions",
        all: "All",
        supported: "Supported discovery",
        supportedEmpty: "No hypothesis has crossed its deterministic evidence threshold yet.",
        active: "Patterns under observation",
        activeEmpty: "No hypothesis currently needs more evidence.",
        decisionTitle: "Recent decisions",
        decisionEmpty: "No recent Today decisions are available.",
        learningTimeline: "Learning timeline",
        timelineEmpty: "No hypothesis status transitions have been recorded yet.",
        evidence: "Evidence",
        evidencePoints: "evidence points",
        gathering: "Gathering evidence",
        monitoring: "Monitoring",
        noResponse: "No response yet",
        previous: "Previous",
        firstObserved: "First observed",
        contradicted: "Contradicted hypotheses retained for audit",
        auditNote:
          "Supported means the configured evidence threshold was reached. It does not mean universal scientific truth or medical certainty.",
      }
    : {
        eyebrow: "JOURNAL · MOKYMOSI ŽURNALAS",
        title: "Journal",
        subtitle: "Hipotezės, atradimai ir sprendimai su juos pagrindžiančiais duomenimis.",
        hypotheses: "Hipotezės",
        discoveries: "Atradimai",
        experiments: "Dėsningumai",
        decisions: "Sprendimai",
        all: "Visi",
        supported: "Patvirtintas atradimas",
        supportedEmpty: "Dar nė viena hipotezė nepasiekė deterministinės įrodymų ribos.",
        active: "Stebimi dėsningumai",
        activeEmpty: "Šiuo metu nė vienai hipotezei nereikia papildomų įrodymų.",
        decisionTitle: "Naujausi sprendimai",
        decisionEmpty: "Naujausių Today sprendimų nėra.",
        learningTimeline: "Mokymosi laiko juosta",
        timelineEmpty: "Hipotezių statusų pokyčių dar neužregistruota.",
        evidence: "Įrodymai",
        evidencePoints: "įrodymų taškai",
        gathering: "Renkami įrodymai",
        monitoring: "Stebima",
        noResponse: "Dar be atsakymo",
        previous: "Ankstesnis",
        firstObserved: "Pirmas stebėjimas",
        contradicted: "Paneigtos hipotezės išsaugotos auditui",
        auditNote:
          "Patvirtinta reiškia, kad pasiekta nustatyta įrodymų riba. Tai nėra universali mokslinė tiesa ar medicininis tikrumas.",
      };

  const stats: JournalStat[] = [
    {
      value: counted ? (data?.hypotheses.length ?? 0) : null,
      label: copy.hypotheses,
      icon: Microscope,
      tone: "text-violet-300",
    },
    {
      value: counted ? supported.length : null,
      label: copy.discoveries,
      icon: CheckCircle2,
      tone: "text-emerald-300",
    },
    {
      value: counted ? monitoring.length : null,
      label: copy.experiments,
      icon: FlaskConical,
      tone: "text-cyan-300",
    },
    {
      value:
        counted && !data?.unreadable.includes("decisions") ? (data?.decisions.length ?? 0) : null,
      label: copy.decisions,
      icon: History,
      tone: "text-amber-300",
    },
  ];

  const tabs = useMemo(
    () => [
      { id: "all" as const, label: copy.all },
      { id: "discoveries" as const, label: copy.discoveries },
      { id: "experiments" as const, label: copy.experiments },
      { id: "decisions" as const, label: copy.decisions },
    ],
    [copy.all, copy.decisions, copy.discoveries, copy.experiments],
  );

  return (
    <section className="fl-journal-page fl-panel relative overflow-hidden rounded-2xl border border-border bg-surface/90">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(124,58,237,.20),transparent_31%),radial-gradient(circle_at_8%_90%,rgba(6,182,212,.08),transparent_30%)]"
      />
      <div className="fl-page-content relative p-4 sm:p-5">
        <header className="fl-page-heading">
          <p className="fl-page-eyebrow flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300">
            <BrainCircuit className="size-4" /> {copy.eyebrow}
          </p>
          <h1 className="mt-2 max-w-4xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {copy.title}
          </h1>
          <p className="fl-page-intro mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {copy.subtitle}
          </p>
        </header>

        {query.isError ? (
          <div className="mt-6">
            <FutureLabEmpty>
              {english
                ? "Journal intelligence is temporarily unavailable."
                : "Journal intelligence laikinai nepasiekiamas."}
            </FutureLabEmpty>
          </div>
        ) : !data ? (
          <div className="mt-4">
            <FutureLabEmpty>
              {english ? "Reading your journal…" : "Skaitomas tavo žurnalas…"}
            </FutureLabEmpty>
          </div>
        ) : (
          <>
            {data.unreadable.length > 0 ? (
              <p
                role="status"
                className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-muted-foreground"
              >
                {english
                  ? "Some decision history could not be read. Missing details are not inferred."
                  : "Dalis sprendimų istorijos nepasiekiama. Trūkstamos detalės nespėjamos."}
              </p>
            ) : null}
            <div className="fl-journal-stats mt-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl border border-border bg-surface-2/65">
                    <Icon className={`size-4 ${stat.tone}`} />
                    <p className="mt-2 font-mono text-xl text-foreground">
                      {stat.value === null ? "—" : stat.value}
                    </p>
                    <p className="fl-journal-stat-label mt-1 uppercase text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {(tab === "all" || tab === "discoveries") && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <FutureLabPanel
                  title={copy.supported}
                  action={<CheckCircle2 className="size-4 text-emerald-300" />}
                >
                  {supported.length ? (
                    <div className="space-y-3">
                      {supported.slice(0, 3).map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.035] p-3"
                        >
                          <p className="text-sm leading-relaxed text-foreground">
                            {statement(item.statementKey)}
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
                            <span className="text-emerald-300">
                              {item.evidenceCount} {copy.evidencePoints}
                            </span>
                            <span className="text-muted-foreground">
                              {item.domain.replaceAll("_", " ")}
                            </span>
                          </div>
                          <HypothesisEvidence evidence={item.evidence} />
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="fl-plain-state text-xs leading-relaxed text-muted-foreground">
                      {copy.supportedEmpty}
                    </p>
                  )}
                </FutureLabPanel>

                {tab === "all" && (
                  <FutureLabPanel
                    title={copy.active}
                    action={<FlaskConical className="size-4 text-cyan-300" />}
                  >
                    {monitoring.length ? (
                      <div className="space-y-3">
                        {monitoring.slice(0, 3).map((item) => (
                          <article
                            key={item.id}
                            className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.025] p-3"
                          >
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {statement(item.statementKey)}
                            </p>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                              <div
                                className="h-full rounded-full bg-cyan-400"
                                style={{ width: `${progressFor(item)}%` }}
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px] text-muted-foreground">
                              <span>
                                {item.evidenceCount}/{item.minimumEvidenceCount}
                              </span>
                              <span className={statusTone(item.status)}>
                                {item.status === "monitoring" ? copy.monitoring : copy.gathering}
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="fl-plain-state text-xs leading-relaxed text-muted-foreground">
                        {copy.activeEmpty}
                      </p>
                    )}
                  </FutureLabPanel>
                )}
              </div>
            )}

            {tab === "experiments" && (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {monitoring.length ? (
                  monitoring.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[1.4rem] border border-cyan-400/10 bg-cyan-400/[0.025] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <CircleDot className="size-4 text-cyan-300" />
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {item.evidenceCount}/{item.minimumEvidenceCount}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-foreground">
                        {statement(item.statementKey)}
                      </p>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${progressFor(item)}%` }}
                        />
                      </div>
                      <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {item.domain.replaceAll("_", " ")}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="md:col-span-2 xl:col-span-3">
                    <p className="fl-plain-state text-xs leading-relaxed text-muted-foreground">
                      {copy.activeEmpty}
                    </p>
                  </div>
                )}
              </div>
            )}

            <details className="fl-secondary-details mt-3">
              <summary>
                {english ? "Browse journal" : "Naršyti žurnalą"} ·{" "}
                {tabs.find((item) => item.id === tab)?.label}
              </summary>
              <div className="fl-disclosed-content">
                <nav
                  aria-label={english ? "Journal filters" : "Žurnalo filtrai"}
                  className="fl-journal-filters mt-4 flex gap-1.5 overflow-x-auto border-b border-border pb-3"
                >
                  {tabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={tab === item.id}
                      onClick={() => setTab(item.id)}
                      className={`min-h-11 shrink-0 rounded-lg border px-3 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
                        tab === item.id
                          ? "border-violet-400/50 bg-violet-500/15 text-foreground"
                          : "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            </details>

            {(tab === "all" || tab === "decisions") && (
              <details className="fl-secondary-details mt-3" open={tab === "decisions"}>
                <summary>
                  {copy.decisionTitle} ·{" "}
                  {data.unreadable.includes("decisions") ? "—" : data.decisions.length}
                </summary>
                <div className="fl-disclosed-content">
                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_.8fr]">
                    <FutureLabPanel
                      title={copy.decisionTitle}
                      action={<History className="size-4 text-amber-300" />}
                    >
                      {data?.unreadable.includes("decisions") ? (
                        <FutureLabEmpty>
                          {english
                            ? "Decision history is temporarily unavailable."
                            : "Sprendimų istorija laikinai nepasiekiama."}
                        </FutureLabEmpty>
                      ) : data?.decisions.length ? (
                        <div className="divide-y divide-white/[0.06]">
                          {data.decisions.slice(0, tab === "decisions" ? 12 : 5).map((decision) => (
                            <article
                              key={decision.id}
                              className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                            >
                              <div className="min-w-0">
                                <p className="text-sm text-foreground">
                                  {ACTION_LABEL[decision.action][locale]}
                                </p>
                                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                  {decision.decisionOn} · {decision.basis.replaceAll("_", " ")}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                {data.unreadable.includes("decision_outcomes")
                                  ? english
                                    ? "Response unavailable"
                                    : "Atsakas nepasiekiamas"
                                  : decision.outcome
                                    ? OUTCOME_LABEL[decision.outcome][locale]
                                    : copy.noResponse}
                              </span>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <FutureLabEmpty>{copy.decisionEmpty}</FutureLabEmpty>
                      )}
                    </FutureLabPanel>

                    <FutureLabPanel
                      title={copy.learningTimeline}
                      action={<Microscope className="size-4 text-violet-300" />}
                    >
                      {data?.hypothesisHistory.length ? (
                        <div className="space-y-3">
                          {data.hypothesisHistory.slice(0, 6).map((transition) => (
                            <article
                              key={`${transition.hypothesisId}-${transition.occurredAt}`}
                              className="relative border-l border-violet-400/20 pl-4"
                            >
                              <span className="absolute -left-1 top-1 size-2 rounded-full bg-violet-400" />
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {statement(transition.statementKey)}
                              </p>
                              <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                                {new Date(transition.occurredAt).toLocaleString(
                                  formatLocale(lang),
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </p>
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {transition.previousStatus
                                  ? `${copy.previous}: ${transition.previousStatus.replaceAll("_", " ")} → `
                                  : `${copy.firstObserved} → `}
                                <span className={statusTone(transition.status)}>
                                  {transition.status.replaceAll("_", " ")}
                                </span>
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <FutureLabEmpty>{copy.timelineEmpty}</FutureLabEmpty>
                      )}
                    </FutureLabPanel>
                  </div>
                </div>
              </details>
            )}

            {contradicted.length ? (
              <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                <XCircle className="size-4 text-rose-300" /> {copy.contradicted}:{" "}
                {contradicted.length}
              </p>
            ) : null}

            <details className="fl-secondary-details mt-3">
              <summary>{english ? "About these observations" : "Apie šiuos stebėjimus"}</summary>
              <p className="fl-model-note px-3 pb-3 text-xs text-muted-foreground">
                {copy.auditNote}
              </p>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
