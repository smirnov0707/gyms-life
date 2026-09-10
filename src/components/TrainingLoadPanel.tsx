import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTrainingLoad } from "@/lib/training-load.functions";
import type { TrainingLoad } from "@/lib/training-load.engine";

/**
 * The week's work, as arithmetic rather than as a model.
 *
 * Weight × reps on completed sets, summed. Nothing here is estimated, which
 * is why it can be a number instead of a band — and why the two things it
 * cannot count are said out loud: a set without a weight or reps contributes
 * nothing, and a first week has nothing to be compared against.
 */

/** Seven bars, drawn to the week's own maximum. No library for eight numbers. */
function Bars({ days, label }: { days: { day: string; volumeKg: number }[]; label: string }) {
  const max = days.reduce((peak, day) => Math.max(peak, day.volumeKg), 0);
  return (
    <div aria-label={label} role="img" className="mt-3 flex h-16 items-end gap-1.5">
      {days.map((day) => {
        // A rest day is a real answer and gets a visible floor rather than
        // nothing, so seven days always read as seven days.
        const height = max > 0 ? Math.max(3, Math.round((day.volumeKg / max) * 100)) : 3;
        return (
          <span
            key={day.day}
            title={`${day.day}`}
            className={`flex-1 rounded-t-sm ${day.volumeKg > 0 ? "bg-primary/70" : "bg-border"}`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

export function TrainingLoadPanel({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  const { data, isError } = useQuery({
    queryKey: ["training-load", user?.id, timeZone],
    queryFn: () => getTrainingLoad({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const load: TrainingLoad | undefined = isError ? { status: "unreadable" } : data;
  const number = (value: number) => new Intl.NumberFormat(lang).format(value);
  const percent = (fraction: number) =>
    new Intl.NumberFormat(lang, {
      style: "percent",
      maximumFractionDigits: 0,
      signDisplay: "exceptZero",
    }).format(fraction);

  return (
    <section aria-label={t("tl.title")} className="min-w-0">
      <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
        <BarChart3 aria-hidden="true" className="size-3.5" /> {t("tl.title")}
      </h2>

      {!load ? null : load.status === "unreadable" ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-300">{t("tl.unreadable")}</p>
      ) : load.countedSets === 0 ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">{t("tl.none")}</p>
          {load.uncountedSets > 0 ? (
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              {t("tl.uncounted").replace("{n}", String(load.uncountedSets))}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-1.5 font-display text-2xl leading-none tabular-nums text-white">
            {number(load.thisWeekKg)}
            <span className="ml-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
              kg × {t("tl.thisWeek").toLowerCase()}
            </span>
          </p>

          {load.changeFraction !== null && load.lastWeekKg !== null ? (
            <p className="mt-1 text-[11px] tabular-nums text-neutral-400">
              <span className={load.changeFraction >= 0 ? "text-primary" : "text-accent"}>
                {percent(load.changeFraction)}
              </span>{" "}
              · {t("tl.vsLastWeek").replace("{value}", `${number(load.lastWeekKg)} kg`)}
            </p>
          ) : (
            // Not a hundred-percent increase over nothing.
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{t("tl.firstWeek")}</p>
          )}

          <Bars days={load.days} label={t("tl.axis")} />

          {load.uncountedSets > 0 ? (
            compact ? (
              <details className="mt-2 text-[9px] leading-relaxed text-neutral-400">
                <summary className="cursor-pointer">
                  {baseLang(lang) === "lt" ? "Neįskaičiuotos serijos" : "Excluded sets"}:{" "}
                  {load.uncountedSets}
                </summary>
                <p className="mt-1">
                  {t("tl.uncounted").replace("{n}", String(load.uncountedSets))}
                </p>
              </details>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                {t("tl.uncounted").replace("{n}", String(load.uncountedSets))}
              </p>
            )
          ) : null}
        </>
      )}
    </section>
  );
}
