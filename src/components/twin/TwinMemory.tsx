import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CircleMinus,
  HelpCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";
import { useLabOverview } from "@/components/future-lab/lab-overview.query";
import { WhyThisDisclosure } from "@/components/intelligence/WhyThisDisclosure";
import { EvidenceAcquisitionPrompt } from "@/components/intelligence/EvidenceAcquisitionPrompt";
import { evaluateTwinMemoryEvolutionSet } from "@/lib/twin-memory-evolution";
import { selectEvidenceAcquisitionRecommendation } from "@/lib/evidence-acquisition";
import { summarizeHypothesisStability } from "@/lib/hypothesis-stability";
import { evaluateTwinLearningIntegrity } from "@/lib/twin-learning-integrity";
import { TwinLedgerState } from "./TwinLedgerState";
import "./TwinMemory.css";

const STATEMENTS: Record<string, { en: string; lt: string }> = {
  "athlete.hypothesis.trainingResponse.repeatedLowFeeling": {
    en: "Repeated difficult sessions may signal accumulating training fatigue.",
    lt: "Pasikartojančios sunkios treniruotės gali rodyti besikaupiantį treniruočių nuovargį.",
  },
  "athlete.hypothesis.trainingBehavior.usualDayFit": {
    en: "Your completed sessions are being compared with your usual training rhythm.",
    lt: "Atliktos treniruotės lyginamos su tavo įprastu treniruočių ritmu.",
  },
};
const METRICS: Record<string, { en: string; lt: string }> = {
  rated_sessions: { en: "Rated workouts", lt: "Įvertintos treniruotės" },
  rated_sessions_28d: { en: "Rated workouts · 28 days", lt: "Įvertintos treniruotės · 28 d." },
  recent_low_feeling_streak: {
    en: "Difficult workouts in a row",
    lt: "Sunkios treniruotės iš eilės",
  },
  usual_training_days_28d: {
    en: "Usual training days · 28 days",
    lt: "Įprastos treniruočių dienos · 28 d.",
  },
  usual_day_completion_rate_28d: {
    en: "Completion on usual days",
    lt: "Atlikta įprastomis dienomis",
  },
};

export function TwinMemory() {
  const { lang } = useI18n();
  const language = baseLang(lang);
  const english = language === "en";
  const number = new Intl.NumberFormat(formatLocale(lang), { maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(formatLocale(lang), { dateStyle: "medium" });
  const query = useLabOverview();
  // Every derived surface shares the read state, including data-gap recommendations.
  // Cached data remains in React Query after a failed refresh; it is not a successful read.
  const data = query.isSuccess ? query.data : undefined;
  const hypotheses = data?.hypotheses ?? [];
  const evolution = data ? evaluateTwinMemoryEvolutionSet(hypotheses, data.hypothesisHistory) : [];
  const changes = evolution
    .filter((item) => item.kind !== "unchanged" && item.kind !== "unknown")
    .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""));
  const nextEvidence = data
    ? selectEvidenceAcquisitionRecommendation(hypotheses, data.dataGaps)
    : null;
  const stability = data ? summarizeHypothesisStability(data.hypothesisHistory) : null;
  const integrity = data ? evaluateTwinLearningIntegrity(hypotheses, data.hypothesisHistory) : null;
  const statement = (key: string) =>
    STATEMENTS[key]?.[language] ??
    (english ? "A personal pattern is under evaluation." : "Vertinamas asmeninis dėsningumas.");
  const labels = english
    ? {
        supported: "Supported pattern",
        monitoring: "Still learning",
        insufficient_evidence: "More observations needed",
        contradicted: "Conflicting evidence",
      }
    : {
        supported: "Duomenimis pagrįsta",
        monitoring: "Vis dar mokomasi",
        insufficient_evidence: "Reikia daugiau stebėjimų",
        contradicted: "Prieštaringi duomenys",
      };
  const sources = english
    ? {
        calculated: "Calculated from your records",
        user_reported: "Reported by you",
        measured: "Measured",
      }
    : {
        calculated: "Apskaičiuota iš tavo įrašų",
        user_reported: "Tavo pateikti duomenys",
        measured: "Išmatuota",
      };
  const units: Record<string, string> = english
    ? { sessions: "workouts", days: "days", ratio: "ratio" }
    : { sessions: "trenir.", days: "d.", ratio: "santykis" };
  return (
    <section className="fl-twin-memory" aria-label="Twin Memory">
      <header className="fl-ledger-heading">
        <div className="fl-ledger-eyebrow">
          <BrainCircuit aria-hidden="true" />
          {english ? "Twin memory" : "Twin atmintis"}
        </div>
        <h2>{english ? "Learning your rhythm." : "Pažinti tavo ritmą."}</h2>
        <p>
          {english
            ? "Your observations, the patterns they support and what still needs time."
            : "Tavo stebėjimai, jų pagrindžiami dėsningumai ir tai, kam dar reikia laiko."}
        </p>
      </header>
      {query.isPending ? (
        <TwinLedgerState
          state="loading"
          title={english ? "Reading your observations…" : "Įkeliami tavo stebėjimai…"}
        />
      ) : query.isError ? (
        <TwinLedgerState
          state="error"
          title={
            english ? "Your observations could not be loaded" : "Nepavyko įkelti tavo stebėjimų"
          }
          description={
            english
              ? "Patterns and next steps will return after a successful refresh."
              : "Dėsningumai ir kiti žingsniai bus rodomi sėkmingai atnaujinus duomenis."
          }
          onRetry={() => {
            void query.refetch();
          }}
          retrying={query.isFetching}
        />
      ) : hypotheses.length === 0 ? (
        <TwinLedgerState
          state="empty"
          title={
            english
              ? "No stable personal pattern is available yet."
              : "Stabilaus asmeninio dėsningumo dar nėra."
          }
          description={
            english
              ? "Your recorded workouts and reflections help build this picture over time."
              : "Užregistruotos treniruotės ir savijautos įvertinimai ilgainiui padės susidaryti vaizdą."
          }
        />
      ) : (
        <>
          <div className="fl-memory-overview">
            <div>
              <Sparkles aria-hidden="true" />
              <h3>{english ? "A picture that grows with you" : "Pažinimas, kuris auga kartu"}</h3>
              <p>
                {english
                  ? "These patterns describe your records. A supported pattern can still need further verification before it informs a decision."
                  : "Šie dėsningumai apibūdina tavo įrašus. Net ir duomenimis pagrįstą dėsningumą gali reikėti papildomai patikrinti prieš naudojant sprendimui."}
              </p>
            </div>
            <dl>
              <div>
                <dt>{english ? "Patterns followed" : "Stebimi dėsningumai"}</dt>
                <dd>{number.format(hypotheses.length)}</dd>
              </div>
              <div>
                <dt>{english ? "Eligible for decisions" : "Galima naudoti sprendimams"}</dt>
                <dd>{number.format(integrity?.decisionEligible ?? 0)}</dd>
              </div>
            </dl>
          </div>
          <section
            className="fl-memory-changes"
            aria-label={english ? "Latest changes" : "Naujausi pokyčiai"}
          >
            <header>
              <h3>{english ? "Latest changes" : "Naujausi pokyčiai"}</h3>
              <p>
                {english
                  ? "Compared with the latest saved observation for each pattern."
                  : "Palyginta su naujausiu išsaugotu kiekvieno dėsningumo stebėjimu."}
              </p>
            </header>
            {changes.length ? (
              <div className="fl-memory-change-grid">
                {changes.slice(0, 3).map((change) => {
                  const hypothesis = hypotheses.find((item) => item.id === change.hypothesisId);
                  if (!hypothesis) return null;
                  const meta = {
                    new: { icon: Sparkles, label: english ? "New" : "Nauja" },
                    strengthened: {
                      icon: ArrowUpRight,
                      label: english ? "Strengthened" : "Sustiprėjo",
                    },
                    weakened: { icon: ArrowDownRight, label: english ? "Weakened" : "Susilpnėjo" },
                    contradicted: {
                      icon: AlertTriangle,
                      label: english ? "Contradicted" : "Prieštarauja",
                    },
                    unchanged: { icon: CircleMinus, label: english ? "Unchanged" : "Nepakito" },
                    unknown: { icon: HelpCircle, label: english ? "Unknown" : "Nežinoma" },
                  }[change.kind];
                  const Icon = meta.icon;
                  return (
                    <article key={change.hypothesisId} data-change={change.kind}>
                      <div className="fl-memory-change-label">
                        <span>
                          <Icon aria-hidden="true" />
                          {meta.label}
                        </span>
                        {change.evidenceDelta !== null && change.evidenceDelta !== 0 ? (
                          <small>
                            {english ? "Observation change" : "Stebėjimų pokytis"}:{" "}
                            {change.evidenceDelta > 0 ? "+" : ""}
                            {number.format(change.evidenceDelta)}
                          </small>
                        ) : null}
                      </div>
                      <p>{statement(hypothesis.statementKey)}</p>
                      {change.occurredAt ? (
                        <footer>
                          {english ? "Compared with" : "Palyginta su"}{" "}
                          <time dateTime={change.occurredAt}>
                            {date.format(new Date(change.occurredAt))}
                          </time>
                        </footer>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="fl-memory-no-change">
                {evolution.some((item) => item.kind === "unknown")
                  ? english
                    ? "There is no earlier saved observation to compare yet."
                    : "Dar nėra ankstesnio išsaugoto stebėjimo palyginimui."
                  : english
                    ? "No meaningful change since the latest saved observation."
                    : "Nuo paskutinio išsaugoto stebėjimo reikšmingo pokyčio nėra."}
              </p>
            )}
          </section>
          <div className="fl-memory-patterns">
            {hypotheses.slice(0, 4).map((hypothesis) => {
              const history = stability?.hypotheses.find(
                (item) => item.hypothesisId === hypothesis.id,
              );
              const audit = integrity?.items.find((item) => item.hypothesisId === hypothesis.id);
              const mismatch =
                audit?.status === "drift" ||
                audit?.chainStatus === "broken" ||
                audit?.definitionDrift;
              return (
                <article
                  className="fl-memory-pattern"
                  key={hypothesis.id}
                  data-status={hypothesis.status}
                >
                  <header>
                    <span className="fl-memory-status">{labels[hypothesis.status]}</span>
                    <span className="fl-memory-count">
                      {english ? "Observations" : "Stebėjimai"}{" "}
                      <strong>{number.format(hypothesis.evidenceCount)}</strong>
                    </span>
                  </header>
                  <h3>{statement(hypothesis.statementKey)}</h3>
                  <p className="fl-memory-threshold">
                    {english
                      ? "Minimum observations for evaluation"
                      : "Mažiausiai stebėjimų vertinimui"}
                    : {number.format(hypothesis.minimumEvidenceCount)}
                  </p>
                  <p
                    className="fl-memory-authority"
                    data-eligible={audit?.decisionAuthority ? "true" : "false"}
                  >
                    <ShieldCheck aria-hidden="true" />
                    {audit?.decisionAuthority
                      ? english
                        ? "Can inform your training decisions"
                        : "Galima naudoti tavo treniruočių sprendimams"
                      : english
                        ? "Observation only · does not guide decisions"
                        : "Tik stebėjimas · sprendimams nenaudojama"}
                  </p>
                  <WhyThisDisclosure
                    summary={english ? "Why this pattern?" : "Kuo pagrįstas šis dėsningumas?"}
                    className="fl-memory-evidence"
                  >
                    <div className="fl-memory-evidence-body">
                      <p
                        className="fl-memory-verification"
                        data-warning={mismatch ? "true" : "false"}
                      >
                        {mismatch
                          ? english
                            ? "Saved history does not match consistently. This pattern is withheld from decisions."
                            : "Išsaugota istorija nesutampa. Šis dėsningumas sprendimams nenaudojamas."
                          : audit?.status === "verified"
                            ? english
                              ? "The current pattern agrees with its saved history."
                              : "Dabartinis dėsningumas sutampa su išsaugota istorija."
                            : english
                              ? "There is no saved history to verify this pattern yet."
                              : "Dar nėra išsaugotos istorijos šiam dėsningumui patikrinti."}
                      </p>
                      {history && history.transitions > 1 ? (
                        <p className="fl-memory-history">
                          {history.reversals > 0
                            ? english
                              ? `The evidence has reversed direction ${number.format(history.reversals)} time(s).`
                              : `Duomenų kryptis keitėsi į priešingą: ${number.format(history.reversals)} k.`
                            : english
                              ? `Saved updates: ${number.format(history.transitions)}.`
                              : `Išsaugoti atnaujinimai: ${number.format(history.transitions)}.`}
                        </p>
                      ) : null}
                      {hypothesis.evidence.length ? (
                        <dl>
                          {hypothesis.evidence.map((metric, index) => (
                            <div key={`${metric.key}-${index}`}>
                              <dt>
                                {METRICS[metric.key]?.[language] ??
                                  (english ? "Additional observation" : "Papildomas stebėjimas")}
                                <small>{sources[metric.source]}</small>
                              </dt>
                              <dd>
                                {units[metric.unit]
                                  ? `${number.format(metric.value)} ${units[metric.unit]}`
                                  : english
                                    ? "Value format unavailable"
                                    : "Reikšmės formatas neatpažintas"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p>
                          {english
                            ? "No evidence metric is available yet."
                            : "Stebėjimų reikšmių dar nėra."}
                        </p>
                      )}
                    </div>
                  </WhyThisDisclosure>
                </article>
              );
            })}
          </div>
          {hypotheses.length > 4 || changes.length > 3 ? (
            <p className="fl-memory-limit">
              {english
                ? "Showing up to four patterns and three latest changes from the loaded history."
                : "Rodomi iki keturių dėsningumų ir trys naujausi pokyčiai iš įkeltos istorijos."}
            </p>
          ) : null}
        </>
      )}
      {nextEvidence ? (
        <div className="fl-memory-next">
          <EvidenceAcquisitionPrompt recommendation={nextEvidence} english={english} />
        </div>
      ) : null}
    </section>
  );
}
