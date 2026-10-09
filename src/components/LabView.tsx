import { useId, useState } from "react";
import { Brain, ChevronDown, FlaskConical } from "lucide-react";
import { PredictionCalibrationPanel } from "@/components/PredictionCalibrationPanel";
import { baseLang, useI18n } from "@/lib/i18n";
import { labCopyFor as copyFor, type LabCopy as Copy } from "@/components/lab/lab-view.copy";
export type { LabCopy } from "@/components/lab/lab-view.copy";
import { useLabReadRecovery } from "@/components/lab/useLabReadRecovery";
import { LabDecisionHistory } from "@/components/lab/LabDecisionHistory";
import { LabReadNotice } from "@/components/lab/LabReadNotice";
import type {
  AthleteHypothesis,
  AthleteHypothesisStatusSchema,
} from "@/lib/athlete-hypothesis.schema";
import type { LabOverview } from "@/lib/lab.schema";
import type { z } from "zod";

type HypothesisStatus = z.infer<typeof AthleteHypothesisStatusSchema>;

function statusTone(status: HypothesisStatus): string {
  // These rows sit on the page ground rather than the dark stage, so each
  // tone carries a light-mode shade: a 400-weight accent that reads on
  // onyx disappears on near-white.
  if (status === "supported") return "text-emerald-400 light:text-emerald-700";
  if (status === "contradicted") return "text-rose-400 light:text-rose-700";
  if (status === "monitoring") return "text-amber-300 light:text-amber-700";
  return "text-muted-foreground";
}

function progressFor(hypothesis: AthleteHypothesis): number {
  if (hypothesis.minimumEvidenceCount <= 0) return 100;
  return Math.min(
    100,
    Math.round((hypothesis.evidenceCount / hypothesis.minimumEvidenceCount) * 100),
  );
}

function HypothesisRow({ hypothesis, copy }: { hypothesis: AthleteHypothesis; copy: Copy }) {
  return (
    <article className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {copy.domainLabel[hypothesis.domain]}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {copy.statementLabel[hypothesis.statementKey] ?? copy.statementFallback}
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] ${statusTone(hypothesis.status)}`}
        >
          {copy.statusLabel[hypothesis.status]}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className="h-full rounded-full bg-emerald-400/70"
            style={{ width: `${progressFor(hypothesis)}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {hypothesis.evidenceCount}/{hypothesis.minimumEvidenceCount}
        </span>
      </div>
    </article>
  );
}

export function LabOverviewView({
  data,
  copy,
  onRetry,
  refreshing = false,
  refreshFailed = false,
}: {
  data: LabOverview;
  copy: Copy;
  onRetry?: (() => void) | undefined;
  refreshing?: boolean;
  refreshFailed?: boolean;
}) {
  const { lang } = useI18n();
  const language = baseLang(lang);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();
  const primary = data.hypotheses[0] ?? null;
  const secondary = data.hypotheses.slice(1);
  const notice = refreshFailed
    ? "stale"
    : data.unreadable.length > 0
      ? "partial"
      : refreshing
        ? "refreshing"
        : null;

  return (
    <div className="space-y-4" data-lab-overview>
      {notice ? (
        <LabReadNotice
          mode={notice}
          language={language}
          sources={data.unreadable}
          onRetry={onRetry}
          retrying={refreshing}
        />
      ) : null}
      <section className="fl-premium-stage fl-lab-hero relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 120% at 0% 0%, rgba(16,185,129,.10), transparent 64%), radial-gradient(55% 90% at 100% 100%, rgba(245,158,11,.05), transparent 68%)",
          }}
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
            <FlaskConical className="size-4" /> {copy.eyebrow}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            {copy.description}
          </p>
          {primary ? (
            <div className="mt-8 grid gap-7 border-t border-white/[0.06] pt-7 lg:grid-cols-[1fr_260px] lg:items-end">
              <div>
                <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                  <Brain className="size-3.5 text-emerald-400" /> {copy.currentInvestigation}
                </p>
                <p className="mt-3 max-w-2xl text-xl leading-relaxed text-white sm:text-2xl">
                  {copy.statementLabel[primary.statementKey] ?? copy.statementFallback}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold uppercase tracking-[0.14em]">
                  <span className="text-neutral-500">{copy.domainLabel[primary.domain]}</span>
                  <span className={statusTone(primary.status)}>
                    {copy.statusLabel[primary.status]}
                  </span>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-white/[0.07] bg-black/30 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-600">
                      {copy.evidenceProgress}
                    </p>
                    <p className="mt-2 font-mono text-4xl tracking-[-0.06em] text-white">
                      {primary.evidenceCount}
                      <span className="ml-1 text-lg text-neutral-600">
                        / {primary.minimumEvidenceCount}
                      </span>
                    </p>
                  </div>
                  <span className="font-mono text-xs text-neutral-600">
                    {progressFor(primary)}%
                  </span>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${progressFor(primary)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-8 border-t border-white/[0.06] pt-7 text-sm text-neutral-500">
              {copy.hypothesesEmpty}
            </p>
          )}
        </div>
      </section>
      {secondary.length > 0 ? (
        <section className="fl-premium-card rounded-[1.75rem] border border-border bg-surface-2 px-5 py-2 sm:px-6">
          <p className="pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {copy.otherInvestigations}
          </p>
          <div className="mt-1">
            {secondary.map((hypothesis) => (
              <HypothesisRow key={hypothesis.id} hypothesis={hypothesis} copy={copy} />
            ))}
          </div>
        </section>
      ) : null}
      <PredictionCalibrationPanel data={data.predictionCalibration} />
      <section className="fl-premium-card overflow-hidden rounded-[1.75rem] border border-border bg-surface-2">
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          aria-controls={historyId}
          data-lab-history-toggle
          aria-label={copy.decisionHistory}
          aria-describedby={`${historyId}-description`}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">{copy.decisionHistory}</p>
            <p id={`${historyId}-description`} className="mt-1 text-xs text-muted-foreground">
              {copy.accuracyNote}
            </p>
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${historyOpen ? "rotate-180" : ""}`}
          />
        </button>
        {historyOpen ? (
          <div id={historyId}>
            <LabDecisionHistory data={data} copy={copy} language={language} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function LabView() {
  const { lang } = useI18n();
  const copy = copyFor(lang);
  const { data, isLoading, isError, isFetching, retry } = useLabReadRecovery();

  if (!data) {
    return (
      <LabReadNotice
        mode={isLoading ? "loading" : "unavailable"}
        language={baseLang(lang)}
        onRetry={retry}
        retrying={isFetching}
      />
    );
  }

  return (
    <LabOverviewView
      data={data}
      copy={copy}
      onRetry={retry}
      refreshing={isFetching}
      refreshFailed={isError}
    />
  );
}

export { copyFor as labCopyFor };
