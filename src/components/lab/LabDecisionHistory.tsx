import type { LabOverview } from "@/lib/lab.schema";
import type { LabCopy } from "./lab-view.copy";
import { labReadCopyFor } from "./lab-read.copy";

/** Partial source failure never becomes an empty journal or an unanswered decision. */
export function LabDecisionHistory({
  data,
  copy,
  language,
}: {
  data: LabOverview;
  copy: LabCopy;
  language: "lt" | "en";
}) {
  const readCopy = labReadCopyFor(language);
  const decisionsUnavailable = data.unreadable.includes("decisions");
  const outcomesUnavailable = data.unreadable.includes("decision_outcomes");
  const fitUnavailable = decisionsUnavailable || outcomesUnavailable;
  return (
    <div className="grid gap-0 border-t border-border lg:grid-cols-2" data-lab-history>
      <div className="min-w-0 px-5 py-4 sm:px-6 lg:border-r lg:border-border" data-lab-decisions>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {copy.decisionsTitle}
        </p>
        {data.decisions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {decisionsUnavailable ? readCopy.decisionsUnavailable : copy.decisionsEmpty}
          </p>
        ) : (
          <div className="mt-1">
            {data.decisions.map((decision) => (
              <article
                key={decision.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
                data-lab-decision
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{copy.actionLabel[decision.action]}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {decision.decisionOn} · {copy.basisLabel[decision.basis]}
                  </p>
                </div>
                <span
                  className="max-w-full text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                  data-lab-outcome
                >
                  {decision.outcome
                    ? copy.outcomeLabel[decision.outcome]
                    : outcomesUnavailable
                      ? readCopy.outcomeUnavailable
                      : copy.noOutcome}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 px-5 py-4 sm:px-6" data-lab-fit>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {copy.accuracyTitle}
        </p>
        <div className="mt-2 space-y-3">
          {fitUnavailable ? (
            <p className="text-sm text-muted-foreground" data-lab-fit-unavailable>
              {readCopy.fitUnavailable}
            </p>
          ) : data.decisionAccuracy.byBasis.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.decisionsEmpty}</p>
          ) : (
            data.decisionAccuracy.byBasis.map((entry) => (
              <div
                key={entry.basis}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{copy.basisLabel[entry.basis]}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {copy.answeredOf(entry.answered, entry.proposed)}
                  </p>
                </div>
                <div className="text-right">
                  {entry.fitRate === null ? (
                    <p className="max-w-36 text-[10px] leading-relaxed text-muted-foreground">
                      {copy.accuracyPending(data.decisionAccuracy.minimumAnswered)}
                    </p>
                  ) : (
                    <p className="font-mono text-2xl text-foreground" data-lab-fit-rate>
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
  );
}
