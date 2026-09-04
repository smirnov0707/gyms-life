import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PersonStanding } from "lucide-react";
import { GlowCard } from "@/components/GlowCard";
import { BodyMap } from "@/components/twin/BodyMap";
import { isAnatomicalRegion, type BodyView } from "@/components/twin/body-map.geometry";
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
  noEvidence: string;
  viewLabel: Record<BodyView, string>;
  selectPrompt: string;
  otherTraining: string;
  otherTrainingNote: string;
  allRegions: string;
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
      noEvidence: "No sets logged for this region recently.",
      viewLabel: { front: "Front", back: "Back" },
      selectPrompt: "Select a region on the body to see its evidence.",
      otherTraining: "Other logged training",
      otherTrainingNote: "These are not body regions, so they are not placed on the body.",
      allRegions: "All regions",
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
    noEvidence: "Šiam regionui pastaruoju metu setų neregistruota.",
    viewLabel: { front: "Priekis", back: "Nugara" },
    selectPrompt: "Pasirink kūno regioną, kad pamatytum jo įrodymus.",
    otherTraining: "Kita registruota veikla",
    otherTrainingNote: "Tai nėra kūno regionai, todėl jie nežymimi ant kūno.",
    allRegions: "Visi regionai",
  };
}

const BAND_TONE: Record<TwinRegionRecoveryBand, string> = {
  fresh: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
  moderate: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  fatigued: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  unknown: "border-border bg-surface-2 text-muted-foreground",
};

function RegionDetail({
  region,
  copy,
  label,
}: {
  region: TwinRegionState;
  copy: Copy;
  label: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${BAND_TONE[region.recoveryBand]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {copy.bandLabel[region.recoveryBand]}
        </span>
      </div>
      {region.provenance === "calculated" ? (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2/60">
            <div
              className="h-full rounded-full bg-current transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${region.recoveryPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {region.recoveryPct}%
            {/* Cardio and similar groups log real sets with no external load;
                "0 kg" would read as a broken number rather than a fact. */}
            {region.volumeKg ? ` · ${copy.volume}: ${region.volumeKg} kg` : ""}
          </p>
          {region.lastTrainedHoursAgo !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.lastTrained(Math.round(region.lastTrainedHoursAgo))}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{copy.noEvidence}</p>
      )}
    </div>
  );
}

/**
 * Presentational half of the Twin page. Kept free of data fetching so the
 * layout can be rendered and reviewed from a known snapshot.
 */
export function TwinSnapshotView({
  data,
  copy,
  label,
}: {
  data: TwinSnapshot;
  copy: Copy;
  label: (region: string) => string;
}) {
  const [view, setView] = useState<BodyView>("front");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const anatomical = data.regions.filter((region) => isAnatomicalRegion(region.region));
  const other = data.regions.filter((region) => !isAnatomicalRegion(region.region));
  const selected = selectedRegion
    ? (data.regions.find((region) => region.region === selectedRegion) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <GlowCard className="panel relative overflow-hidden p-6 md:p-7">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          <PersonStanding className="size-4" /> {copy.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {copy.description}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {copy.evidenceWindow(data.evidenceWindowDays)}
        </p>
      </GlowCard>

      {!data.dataAvailable ? (
        <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-400">
          {copy.dataGapBanner}
        </p>
      ) : null}

      <section className="grid gap-6 md:grid-cols-[minmax(280px,340px)_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[340px]">
          <div className="flex justify-center gap-1 rounded-xl border border-border bg-surface-2 p-1">
            {(["front", "back"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-colors motion-reduce:transition-none ${
                  view === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {copy.viewLabel[option]}
              </button>
            ))}
          </div>
          <div className="mt-5 h-[500px]">
            <BodyMap
              regions={anatomical}
              view={view}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
              regionLabel={label}
            />
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <RegionDetail region={selected} copy={copy} label={label(selected.region)} />
          ) : (
            <p className="rounded-2xl border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
              {copy.selectPrompt}
            </p>
          )}

          {other.length > 0 ? (
            <div className="rounded-2xl border border-border bg-surface-2 p-4">
              <h2 className="text-sm font-semibold text-foreground">{copy.otherTraining}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{copy.otherTrainingNote}</p>
              {/* Compact chips: full detail for these lives in "All regions". */}
              <div className="mt-3 flex flex-wrap gap-2">
                {other.map((region) => (
                  <span
                    key={region.region}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${BAND_TONE[region.recoveryBand]}`}
                  >
                    {label(region.region)} · {copy.bandLabel[region.recoveryBand]}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* The body map is never the only path to this data (accessibility). */}
      <section>
        <h2 className="text-sm font-semibold text-foreground">{copy.allRegions}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.regions.map((region) => (
            <RegionDetail
              key={region.region}
              region={region}
              copy={copy}
              label={label(region.region)}
            />
          ))}
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

  return <TwinSnapshotView data={data} copy={copy} label={(region) => regionLabelFor(region, t)} />;
}

export { copyFor as twinCopyFor };
