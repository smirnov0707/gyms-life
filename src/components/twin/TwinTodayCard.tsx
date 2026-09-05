import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, PersonStanding } from "lucide-react";
import { BodyMap, toneForRecoveryBand } from "@/components/twin/BodyMap";
import {
  isAnatomicalRegion,
  viewShowing,
  type BodyView,
} from "@/components/twin/body-map.geometry";
import { useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import type {
  TwinRegionRecoveryBand,
  TwinRegionState,
  TwinSnapshot,
} from "@/lib/digital-twin.schema";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  loading: string;
  unavailable: string;
  empty: string;
  emptyHint: string;
  needsAttention: string;
  noEvidenceYet: string;
  coverage: (withEvidence: number, total: number) => string;
  window: (days: number) => string;
  viewLabel: Record<BodyView, string>;
  bandLabel: Record<TwinRegionRecoveryBand, string>;
  open: string;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "YOUR TWIN",
      title: "This is your body today",
      subtitle: "Recovery per region, calculated from the sets you logged.",
      loading: "Loading your Twin…",
      unavailable: "Twin is temporarily unavailable.",
      empty: "Nothing logged yet",
      emptyHint: "Finish a session and your Twin starts filling in region by region.",
      needsAttention: "Needs attention",
      noEvidenceYet: "No sets logged in this window",
      coverage: (withEvidence, total) => `${withEvidence}/${total} regions with evidence`,
      window: (days) => `Last ${days} days`,
      viewLabel: { front: "Front", back: "Back" },
      bandLabel: { fresh: "Fresh", moderate: "Moderate", fatigued: "Fatigued", unknown: "No data" },
      open: "Open full Twin",
    };
  }
  return {
    eyebrow: "TAVO DVYNYS",
    title: "Toks tavo kūnas šiandien",
    subtitle: "Atsistatymas pagal regionus, apskaičiuotas iš registruotų setų.",
    loading: "Kraunamas tavo dvynys…",
    unavailable: "Dvynys šiuo metu nepasiekiamas.",
    empty: "Kol kas nieko neregistruota",
    emptyHint: "Užbaik treniruotę ir dvynys pradės pildytis regionas po regiono.",
    needsAttention: "Reikia dėmesio",
    noEvidenceYet: "Šiame lange setų neregistruota",
    coverage: (withEvidence, total) => `${withEvidence}/${total} regionų su įrodymais`,
    window: (days) => `Paskutinės ${days} d.`,
    viewLabel: { front: "Priekis", back: "Nugara" },
    bandLabel: {
      fresh: "Švieži",
      moderate: "Vidutiniškai",
      fatigued: "Nuvargę",
      unknown: "Nėra duomenų",
    },
    open: "Atidaryti visą dvynį",
  };
}

const BAND_DOT: Record<TwinRegionRecoveryBand, string> = {
  fresh: "bg-emerald-400",
  moderate: "bg-amber-400",
  fatigued: "bg-rose-500",
  unknown: "bg-muted-foreground/50",
};

function regionLabelFor(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

/** The regions actually carrying evidence, least recovered first. */
function leastRecovered(regions: TwinRegionState[]): TwinRegionState[] {
  return regions
    .filter((region) => region.provenance === "calculated" && region.recoveryPct !== null)
    .sort((left, right) => (left.recoveryPct ?? 100) - (right.recoveryPct ?? 100));
}

/**
 * The Twin at the head of Today. It is the screen's visual heart rather than
 * a tile in a grid: the figure is read first, and the regions beside it say
 * in words what the figure says in colour. The full page at /twin carries the
 * evidence for each region; this shows the state and what needs attention.
 *
 * Presentational: kept free of data fetching so the layout can be rendered
 * and reviewed from a known snapshot, the way the Twin page is.
 */
export function TwinTodayView({
  data,
  copy,
  label,
  status = "ready",
}: {
  data: TwinSnapshot | null;
  copy: Copy;
  label: (region: string) => string;
  status?: "loading" | "error" | "ready";
}) {
  const isLoading = status === "loading";
  const isError = status === "error";

  const [view, setView] = useState<BodyView>("front");
  const [selected, setSelected] = useState<string | null>(null);

  const selectRegion = (region: string) => {
    setSelected(region);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  };

  const ranked = data ? leastRecovered(data.regions) : [];
  // Regions the window has nothing to say about are named rather than left to
  // the figure's grey: the body map is never the only path to the data.
  const silent = data ? data.regions.filter((region) => region.provenance !== "calculated") : [];

  return (
    <section
      className="panel relative overflow-hidden rounded-3xl border border-border p-6 md:p-8"
      style={{
        background: "radial-gradient(90% 130% at 12% 0%, var(--primary-dim), transparent 58%)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
            <PersonStanding className="size-4" /> {copy.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl leading-tight md:text-3xl">{copy.title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {copy.subtitle}
          </p>
        </div>
        <Link
          to="/twin"
          className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-bold text-primary"
        >
          {copy.open}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none" />
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </p>
      ) : isError || !data ? (
        <p className="mt-6 text-sm text-muted-foreground">{copy.unavailable}</p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(200px,300px)_1fr]">
          <div>
            <div className="mx-auto flex w-full max-w-[220px] gap-1 rounded-full border border-border bg-surface-2/80 p-1">
              {(["front", "back"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  className={`min-h-8 flex-1 rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors motion-reduce:transition-none ${
                    view === option
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {copy.viewLabel[option]}
                </button>
              ))}
            </div>
            <div className="mt-3 h-[420px] md:h-[520px]">
              <BodyMap
                regions={data.regions
                  .filter((region) => isAnatomicalRegion(region.region))
                  .map((region) => ({
                    region: region.region,
                    tone: toneForRecoveryBand(region.recoveryBand),
                    value: region.recoveryPct === null ? null : `${region.recoveryPct}%`,
                  }))}
                view={view}
                selectedRegion={selected}
                onSelectRegion={selectRegion}
                regionLabel={label}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            {/* What produced this reading, stated before the reading itself. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border pb-3 font-mono text-xs text-muted-foreground">
              <span>{copy.window(data.evidenceWindowDays)}</span>
              <span>
                {copy.coverage(
                  data.regions.filter((region) => region.provenance === "calculated").length,
                  data.regions.length,
                )}
              </span>
            </div>

            {/* Early on this column is much shorter than the figure beside
                it. Centring it against the body keeps the two reading as one
                object instead of leaving a void under the text. */}
            <div className="flex flex-1 flex-col justify-center">
              {ranked.length === 0 ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-foreground">{copy.empty}</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">{copy.emptyHint}</p>
                </div>
              ) : (
                <>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {copy.needsAttention}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {ranked.map((region) => (
                      <li key={region.region}>
                        <button
                          type="button"
                          onClick={() => selectRegion(region.region)}
                          aria-pressed={selected === region.region}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition-colors motion-reduce:transition-none ${
                            selected === region.region
                              ? "border-primary/50 bg-primary/5"
                              : "border-transparent hover:border-border hover:bg-surface-2"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={`size-2 shrink-0 rounded-full ${BAND_DOT[region.recoveryBand]}`}
                                aria-hidden="true"
                              />
                              <span className="truncate text-sm font-medium text-foreground">
                                {label(region.region)}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-xs text-muted-foreground">
                              {region.recoveryPct}% · {copy.bandLabel[region.recoveryBand]}
                            </span>
                          </span>
                          <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                            <span
                              className={`block h-full rounded-full ${BAND_DOT[region.recoveryBand]}`}
                              style={{ width: `${region.recoveryPct}%` }}
                            />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {silent.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {copy.noEvidenceYet}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {silent.map((region) => label(region.region)).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Container: loads the same snapshot the Twin page reads, so they agree. */
export function TwinTodayCard() {
  const { lang, t } = useI18n();
  const timeZone = browserTimeZone();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["twin-snapshot", timeZone],
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });

  return (
    <TwinTodayView
      data={data ?? null}
      copy={copyFor(lang)}
      label={(region) => regionLabelFor(region, t)}
      status={isLoading ? "loading" : isError || !data ? "error" : "ready"}
    />
  );
}

export { copyFor as twinTodayCopyFor };
