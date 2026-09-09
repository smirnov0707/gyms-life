import { MorningLabReview } from "./MorningLabReview";
import { useQuery } from "@tanstack/react-query";
import { MoonStar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatLocale, useI18n } from "@/lib/i18n";
import { getOvernightWork } from "@/lib/night-lab.functions";
import type { OvernightWork } from "@/lib/night-lab.read";

/**
 * What the Lab may say about work that happened while nobody was looking.
 *
 * The constitution asks for "while you slept, GYMS.LIFE learned". That sentence
 * is the easiest one in the whole document to say falsely, so this panel says
 * only what a row in the athlete's own timeline supports: which nightly run
 * recalculated their Twin, and when. No run, no sentence.
 *
 * The two quiet states are kept apart, as everywhere else here. "No overnight
 * run has recalculated your Twin yet" is a fact about the athlete and the
 * ordinary state for somebody new. "This could not be read" is a fact about us.
 * Showing the first when the second is true would tell an athlete whose Twin is
 * maintained nightly that nothing has ever happened to it.
 *
 * The closing line says what the nightly work does not do. A panel that lists
 * only what exists reads, to somebody who has read the roadmap, as a claim that
 * the rest exists too.
 */
export function NightLabPanel() {
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const { data, isError } = useQuery({
    queryKey: ["overnight-work", user?.id],
    queryFn: () => getOvernightWork(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const work: OvernightWork | undefined = isError ? { state: "unreadable" } : data;

  const when = (at: string) =>
    new Date(at).toLocaleString(formatLocale(lang), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section
      aria-label={t("nl.title")}
      className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88 p-4"
    >
      <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-300">
        <MoonStar aria-hidden="true" className="size-3" /> {t("nl.title")}
      </p>
      <p className="mt-1.5 text-[11px] text-slate-400">{t("nl.subtitle")}</p>

      {/* Nothing has come back yet, and no state is a state worth reporting. */}
      {!work ? null : work.state === "unreadable" ? (
        <p className="mt-3 text-xs leading-relaxed text-amber-300">{t("nl.unreadable")}</p>
      ) : work.state === "never" ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">{t("nl.never")}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{t("nl.neverHow")}</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-xs leading-relaxed text-slate-200">
            {work.nightsAgo <= 1
              ? t("nl.lastNight")
              : t("nl.nightsAgo").replace("{nights}", String(work.nightsAgo))}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[10px] tabular-nums text-slate-500">
            <span>{when(work.at)}</span>
            {/* The ledger's own name for the run, so a row here and a row in
                background_job_runs can be matched by hand when something looks
                wrong. */}
            <span>{t("nl.runKey").replace("{runKey}", work.runKey)}</span>
          </p>
        </>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">{t("nl.scope")}</p>
      <div className="mt-3">
        <MorningLabReview />
      </div>
    </section>
  );
}
