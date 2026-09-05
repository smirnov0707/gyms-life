import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PersonStanding } from "lucide-react";
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

function regionLabelFor(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  unavailable: string;
  dataGapBanner: string;
  evidenceWindow: (days: number) => string;
  bandLabel: Record<TwinRegionRecoveryBand, string>;
  volume: string;
  lastTrained: (hours: number) => string;
  hoursAgo: (hours: number) => string;
  noEvidence: string;
  viewLabel: Record<BodyView, string>;
  selectPrompt: string;
  offBody: string;
  otherTrainingNote: string;
  allRegions: string;
  metaModel: string;
  metaWindow: string;
  metaUpdated: string;
  metaLastTrained: string;
  metaCoverage: string;
  coverage: (withEvidence: number, total: number) => string;
  windowDays: (days: number) => string;
  recovery: string;
  ranking: string;
  rankingNote: string;
  rankingEmpty: string;
  legend: string;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "TWIN",
      title: "Your Digital Twin",
      description:
        "Calculated recovery per body region, from your logged training — never a diagnosis or a prediction.",
      loading: "Loading your Twin…",
      unavailable: "Your Twin is temporarily unavailable.",
      dataGapBanner:
        "Training-load data could not be loaded right now. Showing what we already know.",
      evidenceWindow: (days) => `Based on the last ${days} days of logged sets.`,
      bandLabel: { fresh: "Fresh", moderate: "Moderate", fatigued: "Fatigued", unknown: "No data" },
      volume: "Recent volume",
      lastTrained: (hours) => (hours < 1 ? "Trained under an hour ago" : `Trained ${hours}h ago`),
      hoursAgo: (hours) => (hours < 1 ? "under 1h ago" : `${hours}h ago`),
      noEvidence: "No sets logged for this region recently.",
      viewLabel: { front: "Front", back: "Back" },
      selectPrompt: "Select a region on the body to see its evidence.",
      offBody: "Not on the body",
      otherTrainingNote: "This is not a body region, so it is not placed on the body.",
      allRegions: "All regions",
      metaModel: "Model",
      metaWindow: "Window",
      metaUpdated: "Updated",
      metaLastTrained: "Last trained",
      metaCoverage: "Evidence",
      coverage: (withEvidence, total) => `${withEvidence}/${total} regions`,
      windowDays: (days) => `${days}d`,
      recovery: "Recovery",
      ranking: "Least recovered first",
      rankingNote: "Only regions with logged sets in the window are ranked.",
      rankingEmpty: "No region has logged sets in this window yet.",
      legend: "Recovery bands",
    };
  }

  return {
    eyebrow: "DVYNYS",
    title: "Tavo skaitmeninis dvynys",
    description:
      "Apskaičiuotas atsistatymas kiekvienam kūno regionui pagal tavo registruotas treniruotes — ne diagnozė ir ne prognozė.",
    loading: "Kraunamas tavo dvynys…",
    unavailable: "Tavo dvynys šiuo metu nepasiekiamas.",
    dataGapBanner: "Nepavyko įkelti krūvio duomenų. Rodome tai, ką jau žinome.",
    evidenceWindow: (days) => `Remiantis pastarųjų ${days} dienų registruotais setais.`,
    bandLabel: {
      fresh: "Švieži",
      moderate: "Vidutiniškai",
      fatigued: "Nuvargę",
      unknown: "Nėra duomenų",
    },
    volume: "Naujausias tūris",
    lastTrained: (hours) =>
      hours < 1 ? "Treniruota mažiau nei prieš valandą" : `Treniruota prieš ${hours} val.`,
    hoursAgo: (hours) => (hours < 1 ? "mažiau nei prieš 1 val." : `prieš ${hours} val.`),
    noEvidence: "Šiam regionui pastaruoju metu setų neregistruota.",
    viewLabel: { front: "Priekis", back: "Nugara" },
    selectPrompt: "Pasirink kūno regioną, kad pamatytum jo įrodymus.",
    offBody: "Ne ant kūno",
    otherTrainingNote: "Tai nėra kūno regionas, todėl jis nežymimas ant kūno.",
    allRegions: "Visi regionai",
    metaModel: "Modelis",
    metaWindow: "Langas",
    metaUpdated: "Atnaujinta",
    metaLastTrained: "Paskutinį kartą",
    metaCoverage: "Įrodymai",
    coverage: (withEvidence, total) => `${withEvidence}/${total} regionų`,
    windowDays: (days) => `${days} d.`,
    recovery: "Atsistatymas",
    ranking: "Mažiausiai atsistatę pirmi",
    rankingNote: "Rikiuojami tik regionai, turintys registruotų setų šiame lange.",
    rankingEmpty: "Šiame lange nė vienas regionas dar neturi registruotų setų.",
    legend: "Atsistatymo juostos",
  };
}

const BAND_TONE: Record<TwinRegionRecoveryBand, string> = {
  fresh: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
  moderate: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  fatigued: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  unknown: "border-border bg-surface-2 text-muted-foreground",
};

const BAND_DOT: Record<TwinRegionRecoveryBand, string> = {
  fresh: "bg-emerald-400",
  moderate: "bg-amber-400",
  fatigued: "bg-rose-500",
  unknown: "bg-muted-foreground/50",
};

const ALL_BANDS: TwinRegionRecoveryBand[] = ["fresh", "moderate", "fatigued", "unknown"];

/** A thin instrument readout: label above, value in monospace below. */
function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

/** The selected region, read out at instrument scale rather than as a chip. */
function SelectedRegionPanel({
  region,
  copy,
  label,
}: {
  region: TwinRegionState;
  copy: Copy;
  label: string;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${BAND_TONE[region.recoveryBand]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {copy.recovery}
          </p>
          <h2 className="mt-1 truncate text-xl font-bold text-foreground">{label}</h2>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${BAND_TONE[region.recoveryBand]}`}
        >
          {copy.bandLabel[region.recoveryBand]}
        </span>
      </div>

      {region.provenance === "calculated" ? (
        <>
          <p className="mt-4 font-mono text-5xl leading-none tracking-tight text-foreground">
            {region.recoveryPct}
            <span className="ml-1 text-2xl text-muted-foreground">%</span>
          </p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2/70">
            <div
              className="h-full rounded-full bg-current transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${region.recoveryPct}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            {/* Cardio and similar groups log real sets with no external load;
                "0 kg" would read as a broken number rather than a fact. */}
            {region.volumeKg ? (
              <div>
                <dt className="text-muted-foreground">{copy.volume}</dt>
                <dd className="mt-0.5 font-mono text-sm text-foreground">{`${region.volumeKg} kg`}</dd>
              </div>
            ) : null}
            {region.lastTrainedHoursAgo !== null ? (
              <div>
                <dt className="text-muted-foreground">{copy.metaLastTrained}</dt>
                <dd className="mt-0.5 text-sm text-foreground">
                  {copy.hoursAgo(Math.round(region.lastTrainedHoursAgo))}
                </dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{copy.noEvidence}</p>
      )}

      {/* Say why the figure did not light up, rather than leaving it silent. */}
      {!isAnatomicalRegion(region.region) ? (
        <p className="mt-3 text-xs text-muted-foreground">{copy.otherTrainingNote}</p>
      ) : null}
    </div>
  );
}

/** One row of the complete list: dense, and never omits a region. */
function RegionRow({
  region,
  copy,
  label,
}: {
  region: TwinRegionState;
  copy: Copy;
  label: string;
}) {
  const evidence = [
    region.volumeKg ? `${copy.volume}: ${region.volumeKg} kg` : null,
    region.lastTrainedHoursAgo !== null
      ? copy.lastTrained(Math.round(region.lastTrainedHoursAgo))
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className={`size-2 shrink-0 rounded-full ${BAND_DOT[region.recoveryBand]}`} />
          <span className="truncate">{label}</span>
        </p>
        <p className="mt-0.5 pl-4 text-xs text-muted-foreground">
          {evidence.length > 0 ? evidence.join(" · ") : copy.noEvidence}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm text-foreground">
          {region.recoveryPct === null ? "—" : `${region.recoveryPct}%`}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {copy.bandLabel[region.recoveryBand]}
        </p>
      </div>
    </div>
  );
}

function formatUpdated(computedAt: string, lang: string): string {
  const parsed = new Date(computedAt);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString(lang === "en" ? "en-GB" : "lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Presentational half of the Twin page. Kept free of data fetching so the
 * layout can be rendered and reviewed from a known snapshot.
 */
export function TwinSnapshotView({
  data,
  copy,
  label,
  lang = "lt",
}: {
  data: TwinSnapshot;
  copy: Copy;
  label: (region: string) => string;
  lang?: string;
}) {
  const withEvidence = data.regions.filter((region) => region.provenance === "calculated");
  const ranked = [...withEvidence].sort(
    (left, right) => (left.recoveryPct ?? 100) - (right.recoveryPct ?? 100),
  );
  const leastRecovered = ranked.find((region) => isAnatomicalRegion(region.region)) ?? ranked[0];

  // Open on the region that most needs attention rather than on an empty
  // prompt: with evidence present there is always something real to show.
  const [view, setView] = useState<BodyView>(() =>
    leastRecovered && isAnatomicalRegion(leastRecovered.region)
      ? viewShowing(leastRecovered.region, "front")
      : "front",
  );
  const [selectedRegion, setSelectedRegion] = useState<string | null>(
    leastRecovered?.region ?? null,
  );
  const anatomical = data.regions.filter((region) => isAnatomicalRegion(region.region));
  const selected = selectedRegion
    ? (data.regions.find((region) => region.region === selectedRegion) ?? null)
    : null;

  const selectRegion = (region: string) => {
    setSelectedRegion(region);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  };

  return (
    <div className="space-y-6">
      <header className="panel relative overflow-hidden rounded-3xl border border-border p-6 md:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(90% 140% at 8% 0%, var(--primary-dim), transparent 55%)",
            opacity: 0.7,
          }}
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
            <PersonStanding className="size-4" /> {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {copy.description}
          </p>

          {/* The instrument strip: what produced these numbers, in the open. */}
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            <MetaCell label={copy.metaModel} value={data.calculationVersion} />
            <MetaCell label={copy.metaWindow} value={copy.windowDays(data.evidenceWindowDays)} />
            <MetaCell label={copy.metaUpdated} value={formatUpdated(data.computedAt, lang)} />
            <MetaCell
              label={copy.metaCoverage}
              value={copy.coverage(withEvidence.length, data.regions.length)}
            />
          </div>
        </div>
      </header>

      {!data.dataAvailable ? (
        <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-400">
          {copy.dataGapBanner}
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start">
        {/* The chamber: the figure, its controls and its key, framed together. */}
        <div
          className="relative overflow-hidden rounded-3xl border border-border p-4"
          style={{
            background: "radial-gradient(120% 75% at 50% 0%, var(--surface-2), var(--surface) 70%)",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              opacity: 0.6,
            }}
          />
          {/* Corner brackets: framing, the way a measuring rig is framed. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 size-5 rounded-tl-md border-l border-t border-primary/40"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-3 size-5 rounded-tr-md border-r border-t border-primary/40"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-3 size-5 rounded-bl-md border-b border-l border-primary/40"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 right-3 size-5 rounded-br-md border-b border-r border-primary/40"
          />

          <div className="relative">
            <div className="mx-auto flex w-full max-w-[210px] gap-1 rounded-full border border-border bg-surface-2/80 p-1 backdrop-blur">
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

            <div className="mt-3 h-[600px]">
              <BodyMap
                regions={anatomical.map((region) => ({
                  region: region.region,
                  tone: toneForRecoveryBand(region.recoveryBand),
                  value: region.recoveryPct === null ? null : `${region.recoveryPct}%`,
                }))}
                view={view}
                selectedRegion={selectedRegion}
                onSelectRegion={selectRegion}
                regionLabel={label}
                showFraming
              />
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {copy.legend}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {ALL_BANDS.map((band) => (
                  <li
                    key={band}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className={`size-2 rounded-full ${BAND_DOT[band]}`} aria-hidden="true" />
                    {copy.bandLabel[band]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <SelectedRegionPanel region={selected} copy={copy} label={label(selected.region)} />
          ) : (
            <p className="rounded-3xl border border-border bg-surface-2 p-5 text-sm text-muted-foreground">
              {copy.selectPrompt}
            </p>
          )}

          {/* A keyboard-reachable route to every region the map can select. */}
          <div className="rounded-3xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-foreground">{copy.ranking}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{copy.rankingNote}</p>
            {ranked.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{copy.rankingEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {ranked.map((region) => (
                  <li key={region.region}>
                    <button
                      type="button"
                      onClick={() => selectRegion(region.region)}
                      aria-pressed={selectedRegion === region.region}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors motion-reduce:transition-none ${
                        selectedRegion === region.region
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
                          {/* Cardio and the like are real training with no
                              place on a body; say so where they are listed. */}
                          {!isAnatomicalRegion(region.region) ? (
                            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              {copy.offBody}
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {region.recoveryPct}%
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
            )}
          </div>

          {/* The body map is never the only path to this data (accessibility).
              It lives beside the figure rather than below it: with only a
              region or two ranked — which is where most people start — a
              full-width section under the fold left the column half empty. */}
          <div className="rounded-3xl border border-border bg-surface px-5 py-2">
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2 pt-3">
              <h2 className="text-sm font-semibold text-foreground">{copy.allRegions}</h2>
              <p className="text-xs text-muted-foreground">
                {copy.evidenceWindow(data.evidenceWindowDays)}
              </p>
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              {data.regions.map((region) => (
                <RegionRow
                  key={region.region}
                  region={region}
                  copy={copy}
                  label={label(region.region)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Container: loads the snapshot and hands it to the presentational view. */
export function TwinView() {
  const { lang, t } = useI18n();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["twin-snapshot", timeZone],
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <section className="panel p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">{copy.unavailable}</p>;
  }

  return (
    <TwinSnapshotView
      data={data}
      copy={copy}
      lang={lang}
      label={(region) => regionLabelFor(region, t)}
    />
  );
}

export { copyFor as twinCopyFor };
