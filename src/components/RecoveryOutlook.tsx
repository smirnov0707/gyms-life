import { useQuery } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import {
  buildRecoveryOutlook,
  projectRecovery,
  type RecoveryOutlook as Outlook,
} from "@/lib/recovery-outlook.engine";

/**
 * What stands in for the template's "NEXT 7 DAYS OUTLOOK".
 *
 * The drawn panel plots predicted performance against weekdays. Two things
 * rule that out: the plan carries no calendar — it advances by what the
 * athlete finishes, deliberately — and the prediction model is validated at
 * four and twelve weeks, not at one day.
 *
 * So this answers the question the panel was reaching for, with arithmetic
 * instead of prophecy: given the fatigue already on the figure, and nothing
 * new trained, when does each region cross back into trainable. It is the
 * same calculated estimate the Twin shows, read forward instead of at zero,
 * and the assumption it rests on is on screen rather than in a footnote.
 */

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

export function RecoveryOutlook({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();
  const english = baseLang(lang) === "en";
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  // The same key the figure and the region table use, so this panel costs no
  // second read of the snapshot.
  const { data, isError } = useQuery({
    queryKey: ["twin-snapshot", user?.id, timeZone],
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const outlook: Outlook | undefined =
    isError || (data && !data.dataAvailable)
      ? { status: "unreadable" }
      : data
        ? buildRecoveryOutlook({ regions: data.regions })
        : undefined;

  const label = (region: string) =>
    KNOWN_MUSCLE_GROUP_SET.has(region)
      ? t(`mg.${region}` as TKey)
      : region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");

  if (compact) {
    const entries = outlook?.status === "projected" ? outlook.recovering.slice(0, 3) : [];
    const colors = ["#39c4db", "#a16bf5", "#5378e8"];
    return (
      <section aria-label={t("ro.title")} className="fl-outlook">
        <p className="fl-eyebrow uppercase">{t("ro.title")}</p>
        <p className="mt-1 text-[9px]">
          {english
            ? "Calculated recovery · without more training."
            : "Skaičiuojamas atsistatymas · be naujų treniruočių."}
        </p>
        {!outlook ? (
          <p className="mt-3 text-xs">{t("common.loading")}</p>
        ) : outlook.status === "unreadable" ? (
          <p className="mt-3 text-xs">{t("ro.unreadable")}</p>
        ) : (
          <>
            {entries.length > 0 ? (
              <>
                <svg
                  role="img"
                  aria-label={t("ro.title")}
                  viewBox="0 0 240 110"
                  className="fl-outlook-chart"
                >
                  {[0, 25, 50, 75, 100].map((value) => (
                    <g key={value}>
                      <line
                        x1="22"
                        x2="236"
                        y1={100 - value * 0.9}
                        y2={100 - value * 0.9}
                        stroke="var(--border)"
                        strokeWidth=".7"
                      />
                      <text x="0" y={103 - value * 0.9} fontSize="8" fill="var(--muted-foreground)">
                        {value}
                      </text>
                    </g>
                  ))}
                  {entries.map((entry, index) => (
                    <g key={entry.region}>
                      <polyline
                        fill="none"
                        stroke={colors[index]}
                        strokeWidth="1.5"
                        points={Array.from(
                          { length: 13 },
                          (_, step) =>
                            `${22 + (step / 12) * 214},${100 - projectRecovery(entry.recoveryPct, (step * outlook.horizonHours) / 12) * 0.9}`,
                        ).join(" ")}
                      />
                      {[0, 24, 48, 72].map((hours) => (
                        <circle
                          key={hours}
                          cx={22 + (hours / outlook.horizonHours) * 214}
                          cy={100 - projectRecovery(entry.recoveryPct, hours) * 0.9}
                          r="2"
                          fill={colors[index]}
                        />
                      ))}
                    </g>
                  ))}
                </svg>
                <div className="fl-outlook-axis">
                  <span>0 h</span>
                  <span>24 h</span>
                  <span>48 h</span>
                  <span>{outlook.horizonHours} h</span>
                </div>
                <div className="fl-outlook-legend">
                  {entries.map((entry, index) => (
                    <span key={entry.region}>
                      <i style={{ backgroundColor: colors[index] }} />
                      {label(entry.region)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs">
                {outlook.readyCount > 0
                  ? t("ro.allReady")
                  : english
                    ? "Not enough data to estimate recovery."
                    : "Nepakanka duomenų atsistatymui įvertinti."}
              </p>
            )}
            {outlook.unknownCount > 0 ? (
              <p className="mt-2 text-[9px]">
                {t("ro.unknownCount").replace("{count}", String(outlook.unknownCount))}
              </p>
            ) : null}
            <details className="fl-disclosure">
              <summary>{english ? "Recovery estimates" : "Atsistatymo įverčiai"}</summary>
              <ul>
                {outlook.recovering.map((entry) => (
                  <li key={entry.region}>
                    {label(entry.region)} ·{" "}
                    {t("ro.now").replace("{pct}", String(entry.recoveryPct))}
                    <p>
                      {entry.hoursToReady === null
                        ? t("ro.beyond").replace("{hours}", String(outlook.horizonHours))
                        : t("ro.ready")
                            .replace("{hours}", String(entry.hoursToReady))
                            .replace("{pct}", String(outlook.readyPct))}
                    </p>
                  </li>
                ))}
              </ul>
              {outlook.readyCount > 0 ? (
                <p>{t("ro.readyCount").replace("{count}", String(outlook.readyCount))}</p>
              ) : null}
              <p>{t("ro.assumption")}</p>
              <p>{t("ro.noCalendar")}</p>
            </details>
          </>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label={t("ro.title")}
      className="rounded-[1.35rem] border border-[#182846] bg-[#07111d]/88 p-4"
    >
      <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-300">
        <Hourglass aria-hidden="true" className="size-3" /> {t("ro.title")}
      </p>
      <p className="mt-1.5 text-[11px] text-slate-400">{t("ro.subtitle")}</p>

      {!outlook ? null : outlook.status === "unreadable" ? (
        <p className="mt-3 text-xs leading-relaxed text-amber-300">{t("ro.unreadable")}</p>
      ) : (
        <>
          {outlook.recovering.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {outlook.readyCount > 0
                ? t("ro.allReady")
                : english
                  ? "Not enough data to estimate recovery."
                  : "Nepakanka duomenų atsistatymui įvertinti."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {outlook.recovering.map((entry) => (
                <li key={entry.region} className="text-xs">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-slate-300">{label(entry.region)}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-emerald-300">
                      {/* Past the horizon the honest answer is a bound, not an
                          hour: the precision would outrun the assumption. */}
                      {entry.hoursToReady === null
                        ? t("ro.beyond").replace("{hours}", String(outlook.horizonHours))
                        : t("ro.ready")
                            .replace("{hours}", String(entry.hoursToReady))
                            .replace("{pct}", String(outlook.readyPct))}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
                    {t("ro.now").replace("{pct}", String(entry.recoveryPct))}
                  </span>
                  {/* Two marks on one track: where the region is now, solid,
                      and where the same arithmetic puts it at the horizon,
                      faint. The gap between them is the projection. */}
                  <span className="relative mt-1 block h-1 rounded-full bg-white/5">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/25"
                      style={{
                        width: `${Math.min(100, Math.round(projectRecovery(entry.recoveryPct, outlook.horizonHours)))}%`,
                      }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
                      style={{ width: `${entry.recoveryPct}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {outlook.readyCount > 0 ? (
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              {t("ro.readyCount").replace("{count}", String(outlook.readyCount))}
            </p>
          ) : null}
          {outlook.unknownCount > 0 ? (
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              {t("ro.unknownCount").replace("{count}", String(outlook.unknownCount))}
            </p>
          ) : null}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{t("ro.assumption")}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{t("ro.noCalendar")}</p>
        </>
      )}
    </section>
  );
}
