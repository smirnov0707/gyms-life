import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, PersonStanding } from "lucide-react";
import { BodyMap, toneForRecoveryBand } from "@/components/twin/BodyMap";
import {
  isAnatomicalRegion,
  viewShowing,
  type BodyView,
} from "@/components/twin/body-map.geometry";
import { baseLang, formatLocale, useI18n, type Lang, type TKey } from "@/lib/i18n";
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

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
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
  fresh: "border-emerald-400/35 bg-emerald-400/[0.07] text-emerald-300",
  moderate: "border-amber-400/35 bg-amber-400/[0.07] text-amber-300",
  fatigued: "border-rose-500/40 bg-rose-500/[0.07] text-rose-300",
  unknown: "border-white/[0.08] bg-white/[0.025] text-neutral-500",
};

const BAND_DOT: Record<TwinRegionRecoveryBand, string> = {
  fresh: "bg-emerald-400",
  moderate: "bg-amber-400",
  fatigued: "bg-rose-500",
  unknown: "bg-neutral-600",
};

function formatUpdated(computedAt: string, lang: Lang): string {
  const parsed = new Date(computedAt);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString(formatLocale(lang), { hour: "2-digit", minute: "2-digit" });
}

function Instrument({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-600">{label}</p>
      <p className="mt-1 truncate font-mono text-xs text-neutral-300">{value}</p>
    </div>
  );
}

function RegionReadout({
  region,
  copy,
  label,
}: {
  region: TwinRegionState | null;
  copy: Copy;
  label: string | null;
}) {
  if (!region || !label) {
    return (
      <div className="rounded-[1.75rem] border border-white/[0.07] bg-black/30 p-5 backdrop-blur-xl">
        <p className="text-sm leading-relaxed text-neutral-500">{copy.selectPrompt}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[1.75rem] border p-5 backdrop-blur-xl ${BAND_TONE[region.recoveryBand]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-500">
            {copy.recovery}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold text-white">{label}</h2>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em]">
          <span className={`size-2 rounded-full ${BAND_DOT[region.recoveryBand]}`} />
          {copy.bandLabel[region.recoveryBand]}
        </span>
      </div>

      {region.provenance === "calculated" && region.recoveryPct !== null ? (
        <>
          <div className="mt-5 flex items-end gap-2">
            <span className="font-mono text-6xl leading-none tracking-[-0.08em] text-white">
              {region.recoveryPct}
            </span>
            <span className="pb-1 font-mono text-lg text-neutral-500">%</span>
          </div>
          <div className="mt-4 h-px bg-white/[0.08]" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Instrument
              label={copy.volume}
              value={region.volumeKg ? `${region.volumeKg} kg` : "—"}
            />
            <Instrument
              label={copy.metaLastTrained}
              value={
                region.lastTrainedHoursAgo === null
                  ? "—"
                  : copy.hoursAgo(Math.round(region.lastTrainedHoursAgo))
              }
            />
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">{copy.noEvidence}</p>
      )}
    </div>
  );
}

export function TwinSnapshotView({
  data,
  copy,
  label,
  lang = "lt",
}: {
  data: TwinSnapshot;
  copy: Copy;
  label: (region: string) => string;
  lang?: Lang;
}) {
  const withEvidence = data.regions.filter((region) => region.provenance === "calculated");
  const ranked = [...withEvidence].sort(
    (left, right) => (left.recoveryPct ?? 100) - (right.recoveryPct ?? 100),
  );
  const leastRecovered = ranked.find((region) => isAnatomicalRegion(region.region)) ?? ranked[0];
  const [view, setView] = useState<BodyView>(() =>
    leastRecovered && isAnatomicalRegion(leastRecovered.region)
      ? viewShowing(leastRecovered.region, "front")
      : "front",
  );
  const [selectedRegion, setSelectedRegion] = useState<string | null>(
    leastRecovered?.region ?? null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  const anatomical = data.regions.filter((region) => isAnatomicalRegion(region.region));
  const selected = selectedRegion
    ? (data.regions.find((region) => region.region === selectedRegion) ?? null)
    : null;

  const selectRegion = (region: string) => {
    setSelectedRegion(region);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  };

  return (
    <div className="space-y-4">
      {!data.dataAvailable ? (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-300 light:text-amber-700">
          {copy.dataGapBanner}
        </p>
      ) : null}

      <section className="relative min-h-[760px] overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] lg:min-h-[820px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 60% at 50% 40%, rgba(16,185,129,.12), transparent 72%), radial-gradient(80% 80% at 50% 100%, rgba(16,185,129,.05), transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <header className="relative z-10 flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
              <PersonStanding className="size-4" /> {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-neutral-500">
              {copy.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/[0.06] pt-4 sm:grid-cols-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <Instrument label={copy.metaModel} value={data.calculationVersion} />
            <Instrument label={copy.metaWindow} value={copy.windowDays(data.evidenceWindowDays)} />
            <Instrument label={copy.metaUpdated} value={formatUpdated(data.computedAt, lang)} />
            <Instrument
              label={copy.metaCoverage}
              value={copy.coverage(withEvidence.length, data.regions.length)}
            />
          </div>
        </header>

        <div className="relative z-10 grid min-h-[630px] grid-cols-1 lg:grid-cols-[300px_minmax(360px,1fr)_300px] lg:items-center">
          <aside className="order-2 px-5 pb-5 lg:order-1 lg:px-7 lg:pb-8">
            <RegionReadout
              region={selected}
              copy={copy}
              label={selected ? label(selected.region) : null}
            />

            <div className="mt-4 hidden lg:block">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                {copy.ranking}
              </p>
              <div className="mt-2 space-y-1">
                {ranked.slice(0, 4).map((region) => (
                  <button
                    key={region.region}
                    type="button"
                    onClick={() => selectRegion(region.region)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-xs text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${BAND_DOT[region.recoveryBand]}`}
                      />
                      <span className="truncate">{label(region.region)}</span>
                    </span>
                    <span className="font-mono text-neutral-600">{region.recoveryPct ?? "—"}%</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="order-1 flex min-h-[500px] flex-col items-center justify-center px-2 sm:min-h-[560px] lg:order-2 lg:min-h-[640px]">
            <div className="mb-2 flex w-[190px] rounded-full border border-white/[0.08] bg-black/45 p-1 backdrop-blur-xl">
              {(["front", "back"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  className={`min-h-8 flex-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                    view === option
                      ? "bg-emerald-400 text-black"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {copy.viewLabel[option]}
                </button>
              ))}
            </div>

            <div className="h-[470px] w-full max-w-[390px] sm:h-[540px] lg:h-[610px]">
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
          </div>

          <aside className="order-3 hidden px-7 pb-8 lg:block">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-600">
              {copy.legend}
            </p>
            <div className="mt-3 space-y-3">
              {(["fresh", "moderate", "fatigued", "unknown"] as TwinRegionRecoveryBand[]).map(
                (band) => (
                  <div key={band} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 text-neutral-500">
                      <span className={`size-2 rounded-full ${BAND_DOT[band]}`} />
                      {copy.bandLabel[band]}
                    </span>
                    <span className="font-mono text-neutral-700">
                      {data.regions.filter((region) => region.recoveryBand === band).length}
                    </span>
                  </div>
                ),
              )}
            </div>
            <p className="mt-6 text-xs leading-relaxed text-neutral-600">
              {copy.evidenceWindow(data.evidenceWindowDays)}
            </p>
          </aside>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-surface-2">
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">{copy.allRegions}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.evidenceWindow(data.evidenceWindowDays)}
            </p>
          </div>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${detailsOpen ? "rotate-180" : ""}`}
          />
        </button>

        {detailsOpen ? (
          <div className="grid border-t border-border sm:grid-cols-2">
            {data.regions.map((region) => (
              <button
                key={region.region}
                type="button"
                onClick={() => selectRegion(region.region)}
                className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 text-left hover:bg-foreground/[0.03] sm:odd:border-r"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`size-2 shrink-0 rounded-full ${BAND_DOT[region.recoveryBand]}`}
                  />
                  <span className="truncate text-sm text-foreground">{label(region.region)}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {region.recoveryPct === null ? "—" : `${region.recoveryPct}%`}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

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
      <section className="rounded-3xl border border-border bg-surface-2 p-6">
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
