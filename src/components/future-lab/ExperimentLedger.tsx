import { FlaskConical } from "lucide-react";
import { FutureLabEmpty, FutureLabPanel } from "./FutureLabPanel";
import { usePersonalExperimentHistory } from "./experiment-ledger.query";

const STATUS_COPY = {
  en: {
    draft: "Draft",
    eligible: "Eligible",
    running: "Running",
    stopped: "Stopped",
    completed: "Completed",
  },
  lt: {
    draft: "Juodraštis",
    eligible: "Tinkamas",
    running: "Vykdomas",
    stopped: "Sustabdytas",
    completed: "Baigtas",
  },
} as const;

export function ExperimentLedger({ english }: { english: boolean }) {
  const query = usePersonalExperimentHistory();
  const data = query.data;
  const copy = STATUS_COPY[english ? "en" : "lt"];

  return (
    <FutureLabPanel
      eyebrow={english ? "Personal experiments" : "Asmeniniai eksperimentai"}
      title={english ? "Experiment ledger" : "Eksperimentų žurnalas"}
      action={<FlaskConical className="size-4 text-violet-300" />}
    >
      {query.isError ? (
        <FutureLabEmpty>
          {english ? "Experiment history is unavailable." : "Eksperimentų istorija nepasiekiama."}
        </FutureLabEmpty>
      ) : !data ? (
        <FutureLabEmpty>
          {english ? "Loading experiment history…" : "Kraunama eksperimentų istorija…"}
        </FutureLabEmpty>
      ) : data.experiments.length === 0 ? (
        <FutureLabEmpty>
          {english
            ? "No governed personal experiments yet."
            : "Valdomų asmeninių eksperimentų dar nėra."}
        </FutureLabEmpty>
      ) : (
        <div className="space-y-2">
          {data.experiments.slice(0, 6).map((experiment) => {
            const outcomes = data.outcomes.filter((item) => item.experiment_id === experiment.id);
            const phases = new Set(outcomes.map((item) => item.phase));
            return (
              <article
                key={experiment.id}
                className="rounded-lg border border-border/70 bg-surface-2/45 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">{experiment.intervention}</p>
                  <span className="rounded-full border border-border px-2 py-1 text-[9px] text-muted-foreground">
                    {copy[experiment.status as keyof typeof copy] ?? experiment.status}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {english ? "Outcome" : "Rezultatas"}: {experiment.primary_outcome} ·{" "}
                  {experiment.duration_days}d
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-muted-foreground">
                  {["baseline", "intervention", "followup"].map((phase) => (
                    <span key={phase} className="rounded-full border border-border/60 px-2 py-1">
                      {phase} {phases.has(phase) ? "✓" : "—"}
                    </span>
                  ))}
                  <span className="rounded-full border border-border/60 px-2 py-1">
                    {outcomes.length} obs.
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
        {english
          ? "Experiment outcomes are association evidence only. They never prove causality or change Today automatically."
          : "Eksperimentų rezultatai yra tik asociacijos įrodymai. Jie neįrodo priežastingumo ir automatiškai nekeičia Today."}
      </p>
    </FutureLabPanel>
  );
}
