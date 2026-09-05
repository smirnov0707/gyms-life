import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, PersonStanding } from "lucide-react";
import { BodyMap, toneForRecoveryBand } from "@/components/twin/BodyMap";
import { isAnatomicalRegion } from "@/components/twin/body-map.geometry";
import { useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import type { TwinRegionState } from "@/lib/digital-twin.schema";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

type Copy = {
  title: string;
  subtitle: string;
  loading: string;
  unavailable: string;
  empty: string;
  mostFatigued: string;
  open: string;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      title: "Your Twin",
      subtitle: "Recovery by body region",
      loading: "Loading…",
      unavailable: "Twin is temporarily unavailable.",
      empty: "Log a workout and your Twin will start filling in.",
      mostFatigued: "Most fatigued",
      open: "Open Twin",
    };
  }
  return {
    title: "Tavo dvynys",
    subtitle: "Atsistatymas pagal kūno regionus",
    loading: "Kraunama…",
    unavailable: "Dvynys šiuo metu nepasiekiamas.",
    empty: "Užregistruok treniruotę ir dvynys pradės pildytis.",
    mostFatigued: "Labiausiai pavargę",
    open: "Atidaryti dvynį",
  };
}

function regionLabelFor(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

/** The regions actually carrying evidence, most fatigued first. */
function mostFatigued(regions: TwinRegionState[]): TwinRegionState[] {
  return regions
    .filter((region) => region.provenance === "calculated" && region.recoveryPct !== null)
    .sort((left, right) => (left.recoveryPct ?? 100) - (right.recoveryPct ?? 100))
    .slice(0, 3);
}

/**
 * Compact Twin summary for the Today screen: the front body map plus the
 * regions that most need attention. Reads the same snapshot as the Twin
 * page, so the two can never disagree.
 */
export function TwinTodayCard() {
  const { lang, t } = useI18n();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["twin-snapshot", timeZone],
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });

  return (
    <div className="panel h-full space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary">
            <PersonStanding className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              {copy.title}
            </h3>
            <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
        <Link
          to="/twin"
          className="group inline-flex items-center gap-1 text-xs font-bold text-primary"
        >
          {copy.open}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none" />
        </Link>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </p>
      ) : isError || !data ? (
        <p className="text-sm text-muted-foreground">{copy.unavailable}</p>
      ) : (
        <div className="flex items-center gap-5">
          <div className="h-[190px] w-[110px] shrink-0">
            <BodyMap
              regions={data.regions
                .filter((region) => isAnatomicalRegion(region.region))
                .map((region) => ({
                  region: region.region,
                  tone: toneForRecoveryBand(region.recoveryBand),
                }))}
              view="front"
              selectedRegion={null}
              onSelectRegion={() => {}}
              regionLabel={(region) => regionLabelFor(region, t)}
            />
          </div>
          <div className="min-w-0 flex-1">
            {mostFatigued(data.regions).length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.empty}</p>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {copy.mostFatigued}
                </p>
                <ul className="mt-2 space-y-2">
                  {mostFatigued(data.regions).map((region) => (
                    <li key={region.region} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">
                          {regionLabelFor(region.region, t)}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {region.recoveryPct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${
                            region.recoveryBand === "fresh"
                              ? "bg-emerald-400"
                              : region.recoveryBand === "moderate"
                                ? "bg-amber-400"
                                : "bg-rose-500"
                          }`}
                          style={{ width: `${region.recoveryPct}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
