import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { getEvidenceReport } from "@/lib/evidence-level.functions";
import type { EvidenceLevel, EvidenceReport, TargetEvidence } from "@/lib/evidence-level.engine";
import { evidenceSteps, type StepFill } from "./evidence-steps.model";

/**
 * What the prediction system has actually been tested on.
 *
 * This is the panel that would otherwise read "82% · High Confidence · based
 * on 512 data points". That number is an average across targets measured to
 * different degrees, some of them never measured at all, and it reads as a
 * calibrated probability while being nothing of the kind. A level plus the
 * count behind it says the same thing honestly and cannot be mistaken for
 * one.
 *
 * Every target the system defines is listed, including the ones nothing has
 * ever predicted — a panel showing only the modelled ones would quietly imply
 * the rest are covered.
 */

const LEVEL_STYLE: Record<EvidenceLevel, string> = {
  insufficient: "text-neutral-500",
  early: "text-accent",
  moderate: "text-amber-300",
  strong: "text-primary",
};

const STEP_TONE: Record<StepFill, string> = {
  reached: "bg-primary/70",
  current: "bg-primary/40",
  empty: "bg-white/10",
};

/**
 * Four steps, filled to the level reached. A shape, not a percentage.
 *
 * A target nothing has ever predicted gets an empty track rather than the
 * bottom of the scale — see `evidence-steps.model.ts` for why those are not
 * the same mark.
 */
function Steps({ entry }: { entry: TargetEvidence }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 gap-0.5">
      {evidenceSteps(entry).map((fill, step) => (
        <span key={step} className={`h-1 w-3 rounded-full ${STEP_TONE[fill]}`} />
      ))}
    </span>
  );
}

export function PredictionEvidencePanel() {
  const { t } = useI18n();
  const { user } = useAuth();

  const { data, isError } = useQuery({
    queryKey: ["evidence-report", user?.id],
    queryFn: () => getEvidenceReport(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const report: EvidenceReport | undefined = isError ? { status: "unreadable" } : data;

  return (
    <section
      aria-label={t("ev.title")}
      className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88 p-4"
    >
      <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
        <Gauge aria-hidden="true" className="size-3" /> {t("ev.title")}
      </p>
      <p className="mt-1.5 text-[11px] text-slate-400">{t("ev.subtitle")}</p>

      {!report ? null : report.status === "unreadable" ? (
        <p className="mt-3 text-xs leading-relaxed text-amber-300">{t("ev.unreadable")}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2.5">
            {report.targets.map((entry) => (
              <li key={entry.target} className="text-xs">
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-slate-300">
                    {t(`ev.target.${entry.target}` as TKey)}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Steps entry={entry} />
                    <span
                      className={`w-20 shrink-0 text-right font-semibold ${
                        entry.modelled ? LEVEL_STYLE[entry.level] : "text-neutral-600"
                      }`}
                    >
                      {entry.modelled ? t(`ev.level.${entry.level}` as TKey) : "—"}
                    </span>
                  </span>
                </span>
                {/* Never predicted is a different admission from
                    predicted-and-unresolved, and only one of the two is about
                    the athlete's data. Both go on this line rather than into
                    a narrow column that would break them across three rows. */}
                <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
                  {entry.modelled
                    ? t("ev.counts")
                        .replace("{evaluated}", String(entry.evaluated))
                        .replace("{pending}", String(entry.pending))
                    : t("ev.never")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">{t("ev.note")}</p>
        </>
      )}
    </section>
  );
}
