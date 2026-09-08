import { useQuery } from "@tanstack/react-query";
import { Moon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getSleepNight } from "@/lib/sleep-stages.functions";
import type { SleepNight, SleepStage } from "@/lib/sleep-stages.engine";
import { stageBars } from "@/lib/sleep-stages.view";

/**
 * The night, as the source described it.
 *
 * The template draws four bars that always fill a night. This draws only what
 * arrived: a source that sent a duration and no stages gets a line saying so,
 * a source that sent some stages gets those stages in minutes with no
 * percentages, and sleep the source reported but never placed in a stage is
 * shown as unattributed rather than absorbed into the largest bar.
 *
 * The withheld percentage used to be withheld only in words. The bar beside it
 * was still drawn from minutes over staged minutes — the share the engine had
 * just declined to publish — so a watch reporting deep sleep alone filled the
 * track under a sentence explaining why no percentage could be given. What a
 * bar is a fraction of now comes from `stageBars`, and so does whether there is
 * a bar at all.
 */

const STAGE_TONE: Record<SleepStage, string> = {
  deep: "bg-indigo-400",
  rem: "bg-sky-400",
  core: "bg-slate-400",
  awake: "bg-amber-400",
};

type StagedNight = Extract<SleepNight, { status: "staged" }>;

function Stages({ night }: { night: StagedNight }) {
  const { t, lang } = useI18n();
  const bars = stageBars(night.slices);
  const percent = (fraction: number) =>
    new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 }).format(fraction);

  return (
    <>
      {/* Ordered deepest first so the panel reads the same every night, and
          only the stages that arrived get a row. */}
      <ul className="mt-3 space-y-2">
        {bars.bars.map((bar) => (
          <li key={bar.stage} className="text-xs">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-slate-300">{t(`sl.stage.${bar.stage}` as TKey)}</span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {t("sl.minutes").replace("{minutes}", String(Math.round(bar.minutes)))}
                {bar.share === null ? null : (
                  <span className="ml-2 font-semibold text-slate-200">{percent(bar.share)}</span>
                )}
              </span>
            </span>
            {bar.widthPercent === null ? null : (
              <span className="mt-1 block h-1 rounded-full bg-white/5">
                <span
                  className={`block h-1 rounded-full ${
                    // The stage colours belong to a share of the night. A
                    // comparison between whatever happened to arrive is drawn
                    // in one muted fill, so it cannot be read as one.
                    bars.basis === "night" ? STAGE_TONE[bar.stage] : "bg-slate-500/60"
                  }`}
                  style={{ width: `${bar.widthPercent}%` }}
                />
              </span>
            )}
          </li>
        ))}
      </ul>

      {bars.basis === "night" ? null : (
        <>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">{t("sl.partial")}</p>
          {bars.basis === "reported" ? (
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              {t("sl.barsReported")}
            </p>
          ) : null}
        </>
      )}
      {night.unattributedMinutes === null ? null : (
        <p className="mt-2 text-[10px] leading-relaxed text-amber-300/80">
          {t("sl.unattributed").replace("{minutes}", String(night.unattributedMinutes))}
        </p>
      )}
    </>
  );
}

export function SleepAnalysis() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  const { data, isError } = useQuery({
    queryKey: ["sleep-night", user?.id, timeZone],
    queryFn: () => getSleepNight({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const night: SleepNight | undefined = isError ? { status: "unreadable" } : data;

  // How old the night is, said plainly. An empty panel and a week-old night
  // look the same otherwise, and only one of them means the watch stopped.
  const whenLabel = (ageDays: number) =>
    ageDays <= 0
      ? t("sl.tonight")
      : ageDays === 1
        ? t("sl.lastNight")
        : t("sl.stale").replace("{days}", String(ageDays));

  const durationLine = (sleepHours: number | null) =>
    sleepHours === null
      ? t("sl.durationMissing")
      : t("sl.duration").replace(
          "{hours}",
          new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(sleepHours),
        );

  return (
    <section
      aria-label={t("sl.title")}
      className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88 p-4"
    >
      <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-300">
        <Moon aria-hidden="true" className="size-3" /> {t("sl.title")}
      </p>

      {!night ? null : night.status === "unreadable" ? (
        <p className="mt-3 text-xs leading-relaxed text-amber-300">{t("sl.unreadable")}</p>
      ) : night.status === "absent" ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">{t("sl.absent")}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{t("sl.absentHow")}</p>
        </>
      ) : (
        <>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-slate-100">
              {durationLine(night.sleepHours)}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {whenLabel(night.ageDays)}
            </span>
          </p>

          {night.status === "duration_only" ? (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{t("sl.noStages")}</p>
          ) : (
            <Stages night={night} />
          )}
        </>
      )}
    </section>
  );
}
