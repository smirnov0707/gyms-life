import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatLocale, useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLastSessionEffect, type LastSessionEffect } from "@/lib/last-session.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { UNASSIGNED_SESSION_REGION } from "@/lib/session-muscle-breakdown";

/**
 * What the last finished session did, kept on the home screen instead of only
 * in the moment after finishing.
 *
 * The share is a share of recorded volume — weight × reps that was logged —
 * and the card says so. It is not measured muscle activation, and the
 * projection withholds the percentage entirely when any set in the session
 * has no known volume, because a percentage of an incomplete denominator is
 * a number that looks exact and is not.
 */

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

export function RecentWorkoutEffect() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  const { data, isError } = useQuery({
    queryKey: ["last-session-effect", user?.id, timeZone],
    queryFn: () => getLastSessionEffect({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const effect: LastSessionEffect | undefined = isError ? { status: "unreadable" } : data;

  const label = (group: string) => {
    if (group === UNASSIGNED_SESSION_REGION) return t("ls2.unassigned");
    if (KNOWN_MUSCLE_GROUP_SET.has(group)) return t(`mg.${group}` as TKey);
    return group.charAt(0).toUpperCase() + group.slice(1).replaceAll("_", " ");
  };
  const percent = (fraction: number) =>
    new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 }).format(fraction);

  const ranked =
    effect?.status === "session"
      ? [...effect.breakdown].sort(
          (left, right) => (right.shareOfSession ?? 0) - (left.shareOfSession ?? 0),
        )
      : [];
  // One unknown share anywhere means the session's denominator is incomplete,
  // so no row gets a percentage rather than some rows quietly getting one.
  const shareUsable = ranked.length > 0 && ranked.every((row) => row.shareOfSession !== null);

  return (
    <section aria-label={t("ls2.title")} className="min-w-0">
      <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
        <Activity aria-hidden="true" className="size-3.5" /> {t("ls2.title")}
      </h2>

      {!effect ? null : effect.status === "unreadable" ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-300">{t("ls2.unreadable")}</p>
      ) : effect.status === "none" ? (
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">{t("ls2.none")}</p>
      ) : (
        <>
          <p className="mt-1.5 text-sm font-semibold text-white">
            {effect.title ?? t("ls2.title")}{" "}
            <span className="font-normal text-neutral-500">
              ·{" "}
              {new Date(effect.finishedAt).toLocaleDateString(formatLocale(lang), {
                day: "numeric",
                month: "short",
              })}
            </span>
          </p>

          {!effect.breakdownAvailable ? (
            <p className="mt-2 text-xs leading-relaxed text-amber-300">
              {t("ls2.breakdownUnavailable")}
            </p>
          ) : ranked.length === 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">{t("ls2.empty")}</p>
          ) : (
            <>
              <ul className="mt-2 space-y-1.5">
                {ranked.slice(0, 5).map((row) => (
                  <li key={row.muscleGroup} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-neutral-300">
                      {label(row.muscleGroup)}
                    </span>
                    {shareUsable && row.shareOfSession !== null ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-white/10"
                        >
                          <span
                            className="block h-full rounded-full bg-primary/70"
                            style={{ width: `${Math.round(row.shareOfSession * 100)}%` }}
                          />
                        </span>
                        <span className="w-9 shrink-0 text-right tabular-nums text-white">
                          {percent(row.shareOfSession)}
                        </span>
                      </>
                    ) : (
                      // No share to state, so the set count carries the row —
                      // a real quantity rather than a blank.
                      <span className="shrink-0 tabular-nums text-neutral-400">
                        {row.sets} ×{" "}
                        {row.volumeKg === null ? "—" : `${Math.round(row.volumeKg)} kg`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                {shareUsable ? t("ls2.shareNote") : t("ls2.noShare")}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
