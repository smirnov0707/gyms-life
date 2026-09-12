import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit, FlaskConical, Sparkles } from "lucide-react";
import { WhyThisDisclosure } from "@/components/intelligence/WhyThisDisclosure";
import { baseLang, useI18n } from "@/lib/i18n";
import { useStrengthForecast } from "./forecast.query";
import { useLabOverview } from "./lab-overview.query";
import { projectedChangePercent, projectedEstimated1RM } from "@/lib/future-me-simulation";
import { rankTwinMemoryProactiveChanges } from "@/lib/twin-memory-proactive";
import {
  dismissTwinMemoryChange,
  markTwinMemoryChangeSeen,
} from "@/lib/twin-memory-proactive.functions";

const statement = {
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Recent sessions have repeatedly felt difficult.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Your completed sessions are being compared with your usual training rhythm.",
  },
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Paskutinės treniruotės pakartotinai jautėsi sunkios.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Atliktos treniruotės lyginamos su tavo įprastu treniruočių ritmu.",
  },
} as const;

function Row({
  icon: Icon,
  eyebrow,
  title,
  detail,
  to,
  cta,
  onOpen,
}: {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  detail: string;
  to: "/progress" | "/lab" | "/twin";
  cta: string;
  onOpen?: () => void;
}) {
  return (
    <article className="grid gap-3 border-t border-border/70 py-4 first:border-t-0 first:pt-0 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <span className="grid size-9 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/[0.06] text-violet-300">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      <Link
        to={to}
        onClick={onOpen}
        className="inline-flex min-h-11 items-center text-xs font-medium text-violet-300 sm:justify-self-end"
      >
        {cta} →
      </Link>
    </article>
  );
}
export function TodayIntelligenceBrief() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const lab = useLabOverview();
  const forecast = useStrengthForecast();
  const queryClient = useQueryClient();
  const markSeen = useServerFn(markTwinMemoryChangeSeen);
  const dismiss = useServerFn(dismissTwinMemoryChange);
  const hypothesis = lab.data?.hypotheses.find(
    (item) => item.status === "monitoring" || item.status === "insufficient_evidence",
  );
  const discovery = lab.data?.hypotheses.find((item) => item.status === "supported");
  const learnedQueue = lab.data
    ? rankTwinMemoryProactiveChanges(lab.data.proactiveMemoryChanges)
    : [];
  const learnedChange = learnedQueue[0] ?? null;
  const refreshLab = () => queryClient.invalidateQueries({ queryKey: ["future-lab-overview"] });
  const seenMutation = useMutation({
    mutationFn: (fingerprint: string) => markSeen({ data: { fingerprint } }),
    onSuccess: refreshLab,
  });
  const dismissMutation = useMutation({
    mutationFn: (fingerprint: string) => dismiss({ data: { fingerprint } }),
    onSuccess: refreshLab,
  });
  const lift = forecast.data?.status === "ready" ? forecast.data.lifts[0] : undefined;
  const projected = lift ? projectedEstimated1RM(lift, "30d") : null;
  const delta =
    lift && projected !== null
      ? projectedChangePercent(lift.currentEstimated1RMKg, projected)
      : null;
  const copy = statement[english ? "en" : "lt"];
  const futureDetail = forecast.isError
    ? english
      ? "Trajectory is temporarily unavailable."
      : "Trajektorija laikinai nepasiekiama."
    : lift && projected !== null
      ? `${lift.exerciseName} · ${delta !== null && delta > 0 ? "+" : ""}${delta ?? 0}% / 4W`
      : english
        ? "Still learning your strength trajectory."
        : "Dar mokomasi tavo jėgos trajektorijos.";
  const hypothesisDetail = hypothesis
    ? (copy[hypothesis.statementKey as keyof typeof copy] ??
      (english ? "A personal pattern is being evaluated." : "Vertinamas asmeninis dėsningumas."))
    : english
      ? "No hypothesis is currently awaiting more evidence."
      : "Šiuo metu nėra hipotezės, laukiančios daugiau duomenų.";
  const discoveryDetail = discovery
    ? (copy[discovery.statementKey as keyof typeof copy] ??
      (english
        ? "A supported personal pattern is available."
        : "Yra pagrįstas asmeninis dėsningumas."))
    : english
      ? "No personal pattern has reached its evidence threshold yet."
      : "Dar nė vienas asmeninis dėsningumas nepasiekė įrodymų ribos.";
  const learnedHypothesis = learnedChange
    ? lab.data?.hypotheses.find((item) => item.id === learnedChange.hypothesisId)
    : undefined;
  const learnedTransition = learnedChange
    ? lab.data?.hypothesisHistory.find(
        (item) =>
          item.hypothesisId === learnedChange.hypothesisId &&
          item.athleteStateSnapshotId === learnedChange.athleteStateSnapshotId,
      )
    : undefined;
  const learnedDetail = learnedHypothesis
    ? (copy[learnedHypothesis.statementKey as keyof typeof copy] ?? discoveryDetail)
    : discoveryDetail;
  const learnedTitle = learnedChange
    ? learnedChange.kind === "contradicted"
      ? english
        ? "Previous pattern contradicted"
        : "Ankstesniam dėsningumui prieštaraujama"
      : learnedChange.kind === "weakened"
        ? english
          ? "Evidence weakened"
          : "Įrodymai susilpnėjo"
        : learnedChange.kind === "strengthened"
          ? english
            ? "Evidence strengthened"
            : "Įrodymai sustiprėjo"
          : english
            ? "New pattern observed"
            : "Pastebėtas naujas dėsningumas"
    : english
      ? "What your data supports"
      : "Ką pagrindžia tavo duomenys";
  return (
    <section
      className="rounded-2xl border border-border bg-surface/85 p-4 sm:p-5"
      aria-label={english ? "Intelligence brief" : "Intelligence santrauka"}
    >
      <header className="mb-2">
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-violet-300">
          GYMS.LIFE INTELLIGENCE
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          {english ? "What matters beyond today's action" : "Kas svarbu už šiandienos veiksmo ribų"}
        </h2>
      </header>
      <Row
        icon={Sparkles}
        eyebrow="FUTURE ME"
        title={english ? "Strength trajectory" : "Jėgos trajektorija"}
        detail={futureDetail}
        to="/progress"
        cta={english ? "Open" : "Atidaryti"}
      />
      <Row
        icon={FlaskConical}
        eyebrow={english ? "HYPOTHESIS" : "HIPOTEZĖ"}
        title={english ? "Under investigation" : "Tiriama"}
        detail={hypothesisDetail}
        to="/lab"
        cta={english ? "Inspect" : "Peržiūrėti"}
      />
      <Row
        icon={BrainCircuit}
        eyebrow={
          learnedChange
            ? english
              ? "LEARNED CHANGE"
              : "IŠMOKTAS POKYTIS"
            : english
              ? "DISCOVERY"
              : "ATRADIMAS"
        }
        title={learnedTitle}
        detail={learnedChange ? learnedDetail : discoveryDetail}
        to={learnedChange ? "/twin" : "/lab"}
        cta={english ? "Review" : "Peržiūrėti"}
        {...(learnedChange ? { onOpen: () => seenMutation.mutate(learnedChange.fingerprint) } : {})}
      />
      {learnedChange ? (
        <WhyThisDisclosure
          summary={english ? "Why this surfaced now" : "Kodėl tai iškilo dabar"}
          className="mb-3 bg-background/20"
        >
          <div className="grid gap-2 p-3 text-[10px] text-muted-foreground">
            {learnedTransition ? (
              <>
                <p>
                  {english ? "Status transition" : "Būsenos perėjimas"}:{" "}
                  {learnedTransition.previousStatus ??
                    (english ? "first observation" : "pirmas stebėjimas")}{" "}
                  → {learnedTransition.status}
                </p>
                <p>
                  {english ? "Evidence" : "Įrodymai"}: {learnedTransition.evidenceCount}/
                  {learnedTransition.minimumEvidenceCount}
                </p>
              </>
            ) : (
              <p>
                {english
                  ? "Auditable transition details are unavailable."
                  : "Audituojamos perėjimo detalės nepasiekiamos."}
              </p>
            )}
            <p>
              {english ? "Source" : "Šaltinis"}: deterministic ·{" "}
              {learnedChange.athleteStateSnapshotId.slice(0, 8)}…
            </p>
            <p>
              {english ? "Decision authority" : "Sprendimo teisė"}: {english ? "none" : "nėra"}
            </p>
          </div>
        </WhyThisDisclosure>
      ) : null}
      {learnedChange ? (
        <div className="-mt-2 flex justify-end border-t border-border/70 pt-2">
          <button
            type="button"
            className="min-h-11 px-2 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            disabled={dismissMutation.isPending}
            onClick={() => dismissMutation.mutate(learnedChange.fingerprint)}
          >
            {english ? "Dismiss learned change" : "Paslėpti išmoktą pokytį"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
