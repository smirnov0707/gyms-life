import { Link } from "@tanstack/react-router";
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
import { baseLang, useI18n } from "@/lib/i18n";
import { useLabOverview } from "@/components/future-lab/lab-overview.query";
import { WhyThisDisclosure } from "@/components/intelligence/WhyThisDisclosure";
import { evaluateTwinMemoryEvolutionSet } from "@/lib/twin-memory-evolution";
import { selectEvidenceAcquisitionRecommendation } from "@/lib/evidence-acquisition";
import { summarizeHypothesisStability } from "@/lib/hypothesis-stability";

const STATEMENT = {
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Repeated difficult sessions may signal accumulating training fatigue.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Your completed sessions are being compared with your usual training rhythm.",
  },
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Pasikartojančios sunkios treniruotės gali rodyti besikaupiantį treniruočių nuovargį.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Atliktos treniruotės lyginamos su tavo įprastu treniruočių ritmu.",
  },
} as const;

export function TwinMemory() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const query = useLabOverview();
  const hypotheses = query.isError ? [] : (query.data?.hypotheses ?? []);
  const evolution = query.data
    ? evaluateTwinMemoryEvolutionSet(hypotheses, query.data.hypothesisHistory)
    : [];
  const meaningfulChanges = evolution
    .filter((item) => item.kind !== "unchanged" && item.kind !== "unknown")
    .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""));
  const hasUnknownBaseline = evolution.some((item) => item.kind === "unknown");
  const nextEvidence = query.data
    ? selectEvidenceAcquisitionRecommendation(hypotheses, query.data.dataGaps)
    : null;
  const stability = query.data ? summarizeHypothesisStability(query.data.hypothesisHistory) : null;
  const labels = english
    ? {
        supported: "Learned pattern",
        monitoring: "Still learning",
        insufficient_evidence: "Not enough evidence",
        contradicted: "Evidence contradicted",
      }
    : {
        supported: "Išmoktas dėsningumas",
        monitoring: "Vis dar mokomasi",
        insufficient_evidence: "Įrodymų nepakanka",
        contradicted: "Duomenys prieštarauja",
      };
  return (
    <section
      className="rounded-3xl border border-border bg-surface p-4 md:p-5"
      aria-label="Twin Memory"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
            TWIN MEMORY
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {english ? "What GYMS.LIFE has learned about you" : "Ką GYMS.LIFE apie tave išmoko"}
          </h2>
        </div>
        <BrainCircuit aria-hidden="true" className="size-5 text-violet-300" />
      </header>
      {query.isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {english ? "Reading longitudinal evidence…" : "Skaitomi ilgalaikiai įrodymai…"}
        </p>
      ) : null}
      {query.isError ? (
        <p role="alert" className="mt-3 text-xs text-muted-foreground">
          {english
            ? "Longitudinal evidence is unavailable. Nothing is inferred."
            : "Ilgalaikiai įrodymai nepasiekiami. Nieko nespėjama."}
        </p>
      ) : null}
      {!query.isLoading && !query.isError && hypotheses.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {english
            ? "No stable personal pattern is available yet."
            : "Stabilaus asmeninio dėsningumo dar nėra."}
        </p>
      ) : null}

      {!query.isLoading && !query.isError && hypotheses.length ? (
        <div className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-300">
                {english ? "LATEST LEARNED CHANGES" : "NAUJAUSI IŠMOKTI POKYČIAI"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {english
                  ? "Deterministic changes relative to the latest auditable memory anchor."
                  : "Deterministiniai pokyčiai lyginant su naujausiu audituojamu atminties atskaitos tašku."}
              </p>
            </div>
            <Sparkles aria-hidden="true" className="size-4 shrink-0 text-violet-300" />
          </div>

          {meaningfulChanges.length ? (
            <div className="mt-3 grid gap-2">
              {meaningfulChanges.slice(0, 3).map((change) => {
                const hypothesis = hypotheses.find((item) => item.id === change.hypothesisId);
                if (!hypothesis) return null;
                const copy = STATEMENT[english ? "en" : "lt"];
                const statement =
                  copy[hypothesis.statementKey as keyof typeof copy] ??
                  (english ? "A personal pattern changed." : "Asmeninis dėsningumas pasikeitė.");
                const meta = {
                  new: {
                    icon: Sparkles,
                    label: english ? "New" : "Nauja",
                    tone: "text-violet-300",
                  },
                  strengthened: {
                    icon: ArrowUpRight,
                    label: english ? "Strengthened" : "Sustiprėjo",
                    tone: "text-emerald-300",
                  },
                  weakened: {
                    icon: ArrowDownRight,
                    label: english ? "Weakened" : "Susilpnėjo",
                    tone: "text-amber-300",
                  },
                  contradicted: {
                    icon: AlertTriangle,
                    label: english ? "Contradicted" : "Paneigta",
                    tone: "text-rose-300",
                  },
                  unchanged: {
                    icon: CircleMinus,
                    label: english ? "Unchanged" : "Nepakito",
                    tone: "text-muted-foreground",
                  },
                  unknown: {
                    icon: HelpCircle,
                    label: english ? "Unknown" : "Nežinoma",
                    tone: "text-muted-foreground",
                  },
                }[change.kind];
                const Icon = meta.icon;
                return (
                  <div
                    key={change.hypothesisId}
                    className="rounded-xl border border-border/60 bg-background/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`flex items-center gap-1.5 text-[10px] font-semibold ${meta.tone}`}
                      >
                        <Icon aria-hidden="true" className="size-3.5" />
                        {meta.label}
                      </span>
                      {change.evidenceDelta !== null && change.evidenceDelta !== 0 ? (
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {change.evidenceDelta > 0 ? "+" : ""}
                          {change.evidenceDelta} evidence
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-foreground">{statement}</p>
                    <p className="mt-2 text-[9px] text-muted-foreground">
                      {english ? "Comparison anchor" : "Palyginimo atskaitos taškas"}:{" "}
                      {change.source}
                      {change.athleteStateSnapshotId
                        ? ` · ${change.athleteStateSnapshotId.slice(0, 8)}…`
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {hasUnknownBaseline
                ? english
                  ? "A prior auditable baseline is not available yet, so change is not inferred."
                  : "Ankstesnio audituojamo atskaitos taško dar nėra, todėl pokytis nespėjamas."
                : english
                  ? "No material memory change is detected from the latest comparison anchor."
                  : "Nuo naujausio palyginimo taško reikšmingo atminties pokyčio neaptikta."}
            </p>
          )}
        </div>
      ) : null}

      {nextEvidence ? (
        <div className="mt-4 rounded-2xl border border-border/70 bg-surface-2/40 p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-300">
            {english ? "WHAT WOULD REDUCE UNCERTAINTY" : "KAS SUMAŽINTŲ NEŽINOMYBĘ"}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-foreground">
            {nextEvidence.action === "rate_next_workout"
              ? english
                ? `Rate your next completed workout${nextEvidence.evidenceRemaining ? ` · ${nextEvidence.evidenceRemaining} more observation(s) to the current evidence threshold` : ""}.`
                : `Įvertink kitą užbaigtą treniruotę${nextEvidence.evidenceRemaining ? ` · iki dabartinės įrodymų ribos trūksta ${nextEvidence.evidenceRemaining}` : ""}.`
              : nextEvidence.action === "complete_next_workout"
                ? english
                  ? "Complete the next planned workout so the Twin has another observed training point."
                  : "Užbaik kitą suplanuotą treniruotę, kad Twin gautų dar vieną stebėtą treniruotės tašką."
                : nextEvidence.action === "record_recovery_checkin"
                  ? english
                    ? "Record a recovery check-in; recent recovery evidence is currently missing."
                    : "Įrašyk atsistatymo check-in — šiuo metu trūksta naujausių atsistatymo duomenų."
                  : nextEvidence.action === "log_nutrition"
                    ? english
                      ? "Log nutrition to restore a recent nutrition evidence window."
                      : "Įrašyk mitybą, kad būtų atkurtas naujausias mitybos įrodymų langas."
                    : nextEvidence.action === "record_body_metric"
                      ? english
                        ? "Record a body measurement to refresh the longitudinal body baseline."
                        : "Įrašyk kūno matavimą, kad būtų atnaujinta ilgalaikė kūno atskaita."
                      : english
                        ? "Enable AI personalization before context-dependent intelligence can use those sources."
                        : "Įjunk AI personalizavimą, kad kontekstinis intelligence galėtų naudoti šiuos šaltinius."}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[9px] text-muted-foreground">
              {english ? "Decision authority: none" : "Sprendimo teisė: nėra"}
            </span>
            <Link
              to={nextEvidence.route}
              className="inline-flex min-h-11 items-center text-xs font-medium text-violet-300"
            >
              {english ? "Add evidence" : "Pridėti įrodymą"} →
            </Link>
          </div>
        </div>
      ) : null}

      {hypotheses.length ? (
        <div className="mt-4 grid gap-2">
          {hypotheses.slice(0, 4).map((hypothesis) => {
            const copy = STATEMENT[english ? "en" : "lt"];
            const statement =
              copy[hypothesis.statementKey as keyof typeof copy] ??
              (english
                ? "A personal pattern is under evaluation."
                : "Vertinamas asmeninis dėsningumas.");
            const historyStability = stability?.hypotheses.find(
              (item) => item.hypothesisId === hypothesis.id,
            );
            return (
              <article
                key={hypothesis.id}
                className="rounded-2xl border border-border/70 bg-surface-2/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-foreground">
                    {labels[hypothesis.status]}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {hypothesis.evidenceCount}/{hypothesis.minimumEvidenceCount} evidence
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground">{statement}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="size-3 text-violet-300" />
                  {english ? "Decision authority" : "Sprendimo teisė"}:{" "}
                  {hypothesis.canInfluenceDecision
                    ? english
                      ? "allowed"
                      : "leidžiama"
                    : english
                      ? "not allowed"
                      : "neleidžiama"}
                </p>
                {historyStability && historyStability.transitions > 1 ? (
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    {historyStability.reversals > 0
                      ? english
                        ? `History unstable · ${historyStability.reversals} reversal${historyStability.reversals === 1 ? "" : "s"}`
                        : `Istorija nestabili · apsivertimų: ${historyStability.reversals}`
                      : english
                        ? `History changed · ${historyStability.transitions} transitions`
                        : `Istorija keitėsi · perėjimų: ${historyStability.transitions}`}
                  </p>
                ) : null}
                <WhyThisDisclosure
                  summary={english ? "Why this? · Evidence" : "Kodėl taip? · Įrodymai"}
                  className="mt-3 bg-background/20"
                >
                  <div className="space-y-2 p-3">
                    {hypothesis.evidence.length ? (
                      hypothesis.evidence.map((metric) => (
                        <div
                          key={`${metric.key}-${metric.unit}`}
                          className="flex items-center justify-between gap-3 text-[10px]"
                        >
                          <span className="min-w-0 text-muted-foreground">
                            {metric.key.replaceAll("_", " ")} · {metric.source.replaceAll("_", " ")}
                          </span>
                          <span className="shrink-0 font-mono text-foreground">
                            {metric.value} {metric.unit}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        {english
                          ? "No evidence metric is available yet."
                          : "Įrodymų metrikų dar nėra."}
                      </p>
                    )}
                  </div>
                </WhyThisDisclosure>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
