import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, History } from "lucide-react";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";
import { getLabOverview } from "@/lib/lab.functions";
import type { LabHypothesisTransition } from "@/lib/lab.schema";
import { browserTimeZone } from "@/lib/local-day";

const COLLAPSED_HISTORY_LIMIT = 5;

type Copy = {
  title: string;
  description: string;
  empty: string;
  firstObserved: string;
  evidence: string;
  snapshot: string;
  showAll: string;
  showLess: string;
  status: Record<LabHypothesisTransition["status"], string>;
  statement: Record<string, string>;
  statementFallback: string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      title: "Learning history",
      description:
        "Only meaningful hypothesis status changes are recorded. Evidence-only updates stay out of this audit trail.",
      empty: "No hypothesis transitions have been recorded yet.",
      firstObserved: "First observed as",
      evidence: "evidence",
      snapshot: "state",
      showAll: "Show full history",
      showLess: "Show less",
      status: {
        insufficient_evidence: "Not enough evidence",
        monitoring: "Monitoring",
        supported: "Supported",
        contradicted: "Contradicted",
      },
      statement: {
        "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
          "Recent sessions have repeatedly felt difficult.",
        "athlete.hypothesis.trainingBehavior.usualDayFit":
          "Completed sessions fit your usual training days.",
      },
      statementFallback: "Tracked hypothesis",
    };
  }

  return {
    title: "Mokymosi istorija",
    description:
      "Fiksuojami tik prasmingi hipotezės būsenos pokyčiai. Vien įrodymų skaičiaus pokyčiai į šį auditą nepatenka.",
    empty: "Hipotezių būsenų pokyčių istorijos kol kas nėra.",
    firstObserved: "Pirmą kartą užfiksuota kaip",
    evidence: "įrodymai",
    snapshot: "būsena",
    showAll: "Rodyti visą istoriją",
    showLess: "Rodyti mažiau",
    status: {
      insufficient_evidence: "Nepakanka įrodymų",
      monitoring: "Stebima",
      supported: "Patvirtinta",
      contradicted: "Paneigta",
    },
    statement: {
      "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
        "Paskutinės treniruotės pakartotinai jautėsi sunkios.",
      "athlete.hypothesis.trainingBehavior.usualDayFit":
        "Baigtos treniruotės atitinka tavo įprastas treniruočių dienas.",
    },
    statementFallback: "Stebima hipotezė",
  };
}

function statusTone(status: LabHypothesisTransition["status"]): string {
  if (status === "supported") return "text-emerald-500";
  if (status === "contradicted") return "text-rose-500";
  if (status === "monitoring") return "text-amber-500";
  return "text-muted-foreground";
}

function formatOccurredAt(value: string, lang: Lang): string {
  const locale = baseLang(lang) === "lt" ? "lt-LT" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function TransitionRow({
  transition,
  copy,
  lang,
}: {
  transition: LabHypothesisTransition;
  copy: Copy;
  lang: Lang;
}) {
  return (
    <article className="border-b border-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-foreground">
            {copy.statement[transition.statementKey] ?? copy.statementFallback}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
            {transition.previousStatus ? (
              <>
                <span className={statusTone(transition.previousStatus)}>
                  {copy.status[transition.previousStatus]}
                </span>
                <ArrowRight className="size-3 text-muted-foreground" />
              </>
            ) : (
              <span className="text-muted-foreground">{copy.firstObserved}</span>
            )}
            <span className={statusTone(transition.status)}>{copy.status[transition.status]}</span>
          </div>
        </div>
        <time
          dateTime={transition.occurredAt}
          className="shrink-0 font-mono text-[10px] text-muted-foreground"
        >
          {formatOccurredAt(transition.occurredAt, lang)}
        </time>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        <span>
          {transition.evidenceCount}/{transition.minimumEvidenceCount} {copy.evidence}
        </span>
        <span>
          {copy.snapshot} · {transition.athleteStateSnapshotId.slice(0, 8)}
        </span>
      </div>
    </article>
  );
}

export function HypothesisRetrospective() {
  const { lang } = useI18n();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ["lab-overview", timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    staleTime: 60_000,
  });

  if (!data) return null;

  const history = data.hypothesisHistory;
  const visible = expanded ? history : history.slice(0, COLLAPSED_HISTORY_LIMIT);

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border bg-surface-2">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full border border-border bg-background/50 p-2">
            <History className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{copy.title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {copy.description}
            </p>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <div className="mt-4 border-t border-border">
            {visible.map((transition) => (
              <TransitionRow
                key={`${transition.hypothesisId}:${transition.athleteStateSnapshotId}`}
                transition={transition}
                copy={copy}
                lang={lang}
              />
            ))}
          </div>
        )}
      </div>

      {history.length > COLLAPSED_HISTORY_LIMIT ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-center gap-2 border-t border-border px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? copy.showLess : copy.showAll}
          <ChevronDown
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      ) : null}
    </section>
  );
}
