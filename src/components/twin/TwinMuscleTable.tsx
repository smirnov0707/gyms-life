import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { TWIN_DISPLAY_COLORS } from "@/components/twin/twin-scene.model";
import { twinCopyFor } from "@/components/TwinView";
import type { TwinRegionState } from "@/lib/digital-twin.schema";

/**
 * Every region the Twin knows about, in one list, ordered least recovered
 * first — the figure says which region is worst; this says by how much, and
 * on what evidence.
 *
 * A region with no calculated recovery is not sorted among the recovered
 * ones and never prints a number. It sits at the bottom under an em dash,
 * because "no evidence" and "fully recovered" are the two readings this
 * screen must never let a person confuse.
 */

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

function Row({
  region,
  label,
  onSelect,
}: {
  region: TwinRegionState;
  label: string;
  onSelect?: () => void;
}) {
  const { lang, t } = useI18n();
  const copy = twinCopyFor(lang);
  const known = region.recoveryPct !== null;
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(value);

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t border-border/60 px-4 py-3 first:border-t-0 sm:grid-cols-[1fr_5rem_6rem_7rem]">
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: TWIN_DISPLAY_COLORS[region.recoveryBand] }}
        />
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className="min-h-11 min-w-0 flex-1 truncate text-left text-sm text-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {label}
          </button>
        ) : (
          <span className="truncate text-sm text-foreground">{label}</span>
        )}
      </span>

      <span className="text-right font-display text-base leading-none tabular-nums text-foreground sm:order-2">
        {known ? (
          `${number(region.recoveryPct!)}%`
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>

      {/* On a phone the two evidence columns fall under the name rather than
          shrinking the numbers to the point of unreadability. */}
      <span className="col-span-2 text-[11px] tabular-nums text-muted-foreground sm:order-3 sm:col-span-1 sm:text-right">
        {region.volumeKg === null ? "—" : `${number(region.volumeKg)} kg`}
      </span>
      <span className="col-span-2 text-[11px] tabular-nums text-muted-foreground sm:order-4 sm:col-span-1 sm:text-right">
        {region.lastTrainedHoursAgo === null
          ? "—"
          : copy.hoursAgo(Math.round(region.lastTrainedHoursAgo))}
      </span>

      <span className="sr-only">
        {t("tw.colRecovery")}: {known ? `${number(region.recoveryPct!)}%` : t("tw.musclesEmpty")}
      </span>
    </li>
  );
}

export function TwinMuscleTable({
  onSelectRegion,
}: { onSelectRegion?: (region: string) => void } = {}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();
  const copy = twinCopyFor(lang);

  // Same key as the figure above it, so the tab switch costs no second read.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["twin-snapshot", user?.id, timeZone],
    enabled: Boolean(user),
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });

  const label = (region: string) =>
    KNOWN_MUSCLE_GROUP_SET.has(region)
      ? t(`mg.${region}` as TKey)
      : region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");

  const ranked = data
    ? [...data.regions].sort((left, right) => {
        const l = left.recoveryPct;
        const r = right.recoveryPct;
        if (l === null && r === null) return label(left.region).localeCompare(label(right.region));
        if (l === null) return 1;
        if (r === null) return -1;
        return l - r;
      })
    : [];

  return (
    <section
      aria-label={t("tw.musclesTitle")}
      className="overflow-hidden rounded-3xl border border-border bg-surface"
    >
      <header className="px-4 pb-3 pt-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">
          {t("tw.musclesTitle")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("tw.musclesNote")}</p>
      </header>

      {isError ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">{copy.unavailable}</p>
      ) : isLoading || !data ? (
        <p className="flex items-center gap-2 px-4 pb-4 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
          {copy.loading}
        </p>
      ) : ranked.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">{t("tw.musclesEmpty")}</p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[1fr_5rem_6rem_7rem] gap-3 border-t border-border/60 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:grid"
          >
            <span>{t("tw.colRegion")}</span>
            <span className="text-right">{t("tw.colRecovery")}</span>
            <span className="text-right">{t("tw.colVolume")}</span>
            <span className="text-right">{t("tw.colLast")}</span>
          </div>
          <ul>
            {ranked.map((region) => (
              <Row
                key={region.region}
                region={region}
                label={label(region.region)}
                {...(onSelectRegion ? { onSelect: () => onSelectRegion(region.region) } : {})}
              />
            ))}
          </ul>
          <p className="border-t border-border/60 px-4 py-3 text-[11px] text-muted-foreground">
            {copy.evidenceWindow(data.evidenceWindowDays)}
          </p>
        </>
      )}
    </section>
  );
}
