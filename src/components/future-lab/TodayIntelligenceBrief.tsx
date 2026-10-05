import type { ReactNode } from "react";
import { RecentWorkoutEffect } from "@/components/RecentWorkoutEffect";
import { IllustrativeAthlete } from "./IllustrativeAthlete";
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
  search,
  cta,
  onOpen,
  card = false,
  visual,
}: {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  detail: string;
  to: "/lab" | "/twin";
  search?: { view: "future" | "journal" };
  cta: string;
  onOpen?: () => void;
  card?: boolean;
  visual?: ReactNode;
}) {
  return (
    <article
      className={
        card
          ? "fl-intelligence-card fl-panel"
          : "grid gap-3 border-t border-border/70 py-4 first:border-t-0 first:pt-0 sm:grid-cols-[auto_1fr_auto] sm:items-center"
      }
    >
      <span className="grid size-9 place-items-center rounded-xl border border-accent/20 bg-accent/[0.06] text-accent">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      {visual}
      <Link
        to={to}
        {...(search ? { search } : {})}
        onClick={onOpen}
        className={
          card
            ? "fl-card-action"
            : "inline-flex min-h-11 items-center text-xs font-medium text-accent sm:justify-self-end"
        }
      >
        {cta} →
      </Link>
    </article>
  );
}
export function TodayIntelligenceBrief({
  presentation = "brief",
}: {
  presentation?: "brief" | "cards" | "changes";
}) {
  const cards = presentation === "cards";
  const changes = presentation === "changes";
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const lab = useLabOverview();
  const forecast = useStrengthForecast();
  const labData = lab.isError ? undefined : lab.data;
  const queryClient = useQueryClient();
  const markSeen = useServerFn(markTwinMemoryChangeSeen);
  const dismiss = useServerFn(dismissTwinMemoryChange);
  const hypothesis = labData?.hypotheses.find(
    (item) => item.status === "monitoring" || item.status === "insufficient_evidence",
  );
  const discovery = labData?.hypotheses.find((item) => item.status === "supported");
  const learnedQueue = labData
    ? rankTwinMemoryProactiveChanges(labData.proactiveMemoryChanges)
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
  const labReadNotice = lab.isError
    ? english
      ? "Lab evidence is temporarily unavailable."
      : "Laboratorijos duomenys laikinai nepasiekiami."
    : !labData
      ? english
        ? "Reading your lab evidence…"
        : "Skaitomi laboratorijos duomenys…"
      : null;
  const hypothesisDetail =
    labReadNotice ??
    (hypothesis
      ? (copy[hypothesis.statementKey as keyof typeof copy] ??
        (english ? "A personal pattern is being evaluated." : "Vertinamas asmeninis dėsningumas."))
      : english
        ? "No hypothesis is currently awaiting more evidence."
        : "Šiuo metu nėra hipotezės, laukiančios daugiau duomenų.");
  const discoveryDetail =
    labReadNotice ??
    (discovery
      ? (copy[discovery.statementKey as keyof typeof copy] ??
        (english
          ? "A supported personal pattern is available."
          : "Yra pagrįstas asmeninis dėsningumas."))
      : english
        ? "No personal pattern has reached its evidence threshold yet."
        : "Dar nė vienas asmeninis dėsningumas nepasiekė įrodymų ribos.");
  const learnedHypothesis = learnedChange
    ? labData?.hypotheses.find((item) => item.id === learnedChange.hypothesisId)
    : undefined;
  const learnedTransition = learnedChange
    ? labData?.hypothesisHistory.find(
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
  if (changes) {
    return (
      <section
        className="grid gap-2"
        aria-label={english ? "What changed" : "Kas pasikeitė"}
      >
        {learnedChange ? (
          <Row
            icon={BrainCircuit}
            eyebrow={english ? "LEARNED CHANGE" : "IŠMOKTAS POKYTIS"}
            title={learnedTitle}
            detail={learnedDetail}
            to="/twin"
            search={{ view: "journal" }}
            cta={english ? "Review" : "Peržiūrėti"}
            onOpen={() => seenMutation.mutate(learnedChange.fingerprint)}
          />
        ) : (
          <Row
            icon={Sparkles}
            eyebrow={english ? "TRAJECTORY" : "TRAJEKTORIJA"}
            title={english ? "Strength direction" : "Jėgos kryptis"}
            detail={futureDetail}
            to="/twin"
            search={{ view: "future" }}
            cta={english ? "Open" : "Atidaryti"}
          />
        )}
        {hypothesis ? (
          <Row
            icon={FlaskConical}
            eyebrow={english ? "UNDER REVIEW" : "TIRIAMA"}
            title={english ? "One pattern is being tested" : "Tikrinamas vienas dėsningumas"}
            detail={hypothesisDetail}
            to="/lab"
            cta={english ? "Inspect" : "Peržiūrėti"}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={
        cards ? "fl-bottom-deck" : "rounded-2xl border border-border bg-surface/85 p-4 sm:p-5"
      }
      aria-label={english ? "Intelligence brief" : "Intelligence santrauka"}
    >
      <header className={cards ? "sr-only" : "mb-2"}>
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-accent">
          GYMS.LIFE INTELLIGENCE
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          {english ? "What matters beyond today's action" : "Kas svarbu už šiandienos veiksmo ribų"}
        </h2>
      </header>
      {cards ? (
        <article className="fl-intelligence-card fl-panel fl-recent-effect">
          <RecentWorkoutEffect />
          <Link to="/twin" search={{ view: "journal" }} className="fl-card-action">
            {english ? "View workout history" : "Treniruočių istorija"} →
          </Link>
        </article>
      ) : null}
      <Row
        card={cards}
        visual={cards ? <IllustrativeAthlete compact /> : undefined}
        icon={Sparkles}
        eyebrow="FUTURE"
        title={english ? "Strength trajectory" : "Jėgos trajektorija"}
        detail={futureDetail}
        to="/twin"
        search={{ view: "future" }}
        cta={english ? "Open" : "Atidaryti"}
      />
      <Row
        card={cards}
        icon={FlaskConical}
        eyebrow={english ? "HYPOTHESIS" : "HIPOTEZĖ"}
        title={english ? "Under investigation" : "Tiriama"}
        detail={hypothesisDetail}
        to="/lab"
        cta={english ? "Inspect" : "Peržiūrėti"}
      />
      <Row
        card={cards}
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
        {...(learnedChange ? { search: { view: "journal" as const } } : {})}
        cta={english ? "Review" : "Peržiūrėti"}
        {...(learnedChange ? { onOpen: () => seenMutation.mutate(learnedChange.fingerprint) } : {})}
      />
      {learnedChange ? (
        <WhyThisDisclosure
          summary={english ? "Why this surfaced now" : "Kodėl tai iškilo dabar"}
          className="fl-learned-evidence mb-3 bg-background/20"
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
        <div className="fl-learned-evidence -mt-2 flex justify-end border-t border-border/70 pt-2">
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
