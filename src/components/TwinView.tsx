import { useId, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, PersonStanding } from "lucide-react";
import { TwinStage } from "@/components/twin/TwinStage";
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
  evidence: string;
  modelDetails: string;
  estimateNote: string;
  sourceNote: string;
  visualNote: string;
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
      recovery: "Recovery estimate",
      ranking: "Least recovered first",
      rankingNote: "Only regions with logged sets in the window are ranked.",
      rankingEmpty: "No region has logged sets in this window yet.",
      legend: "Recovery bands",
      evidence: "Why this estimate?",
      modelDetails: "Model & evidence",
      estimateNote: "Training-based estimate, not a body measurement.",
      sourceNote: "Calculated from the sets you logged. Wearable physiology is not included.",
      visualNote: "Generic body · calculated state",
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
    volume: "Registruotas krūvis",
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
    recovery: "Atsistatymo įvertis",
    ranking: "Mažiausiai atsistatę pirmi",
    rankingNote: "Rikiuojami tik regionai, turintys registruotų setų šiame lange.",
    rankingEmpty: "Šiame lange nė vienas regionas dar neturi registruotų setų.",
    legend: "Atsistatymo kategorijos",
    evidence: "Kodėl toks įvertis?",
    modelDetails: "Modelis ir duomenys",
    estimateNote: "Įvertis pagal treniruotes, ne kūno matavimas.",
    sourceNote:
      "Apskaičiuota iš tavo užregistruotų serijų. Laikrodžio fiziologiniai duomenys neįtraukti.",
    visualNote: "Scheminis kūnas · apskaičiuota būsena",
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
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-400">{label}</p>
      <p className="mt-1 break-words font-mono text-xs text-neutral-200">{value}</p>
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
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  if (!region || !label) {
    return <p className="px-1 py-4 text-sm text-neutral-300">{copy.selectPrompt}</p>;
  }
  const calculated = region.provenance === "calculated" && region.recoveryPct !== null;
  const band = calculated ? region.recoveryBand : "unknown";

  return (
    <div className={`rounded-2xl border p-4 backdrop-blur-xl ${BAND_TONE[band]}`}>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400">
            {copy.recovery}
          </p>
          <h2 className="mt-1 break-words text-xl font-semibold text-white">{label}</h2>
          <p className="mt-1 flex items-center gap-2 text-xs">
            <span className={`size-1.5 shrink-0 rounded-full ${BAND_DOT[band]}`} />
            {copy.bandLabel[band]}
          </p>
        </div>
        {calculated ? (
          <p className="shrink-0 font-mono text-4xl tracking-tight text-white">
            {region.recoveryPct}
            <span className="ml-1 text-sm text-neutral-400">%</span>
          </p>
        ) : (
          <span className="font-mono text-3xl text-neutral-400">—</span>
        )}
      </div>
      {!calculated && (
        <p className="mt-2 text-xs leading-relaxed text-neutral-300">{copy.noEvidence}</p>
      )}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((value) => !value)}
        className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 text-left text-xs font-medium text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
      >
        {copy.evidence}
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div id={detailsId} hidden={!expanded} className="border-t border-white/10 pt-3">
        <p className="text-xs leading-relaxed text-neutral-300">
          {copy.estimateNote} {copy.sourceNote}
        </p>
        {!isAnatomicalRegion(region.region) && (
          <p className="mt-2 text-xs leading-relaxed text-neutral-300">{copy.otherTrainingNote}</p>
        )}
        {calculated && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Instrument
              label={copy.volume}
              value={region.volumeKg !== null ? `${region.volumeKg} kg` : "—"}
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
        )}
      </div>
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

      <section
        data-twin-cockpit
        className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#050706] text-white"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 38% 42%, rgba(81,138,123,.10), transparent 64%)",
          }}
        />
        <header className="relative px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
            <PersonStanding aria-hidden="true" className="size-3.5" /> {copy.eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
          <p className="mt-1 text-xs text-neutral-400">{copy.visualNote}</p>
        </header>
        <div className="relative grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center lg:gap-4 lg:px-4 lg:pb-4">
          <div className="min-w-0 px-2">
            <TwinStage
              snapshot={data}
              selectedRegion={selectedRegion}
              onSelectRegion={selectRegion}
              view={view}
              onViewChange={setView}
              regionLabel={label}
              language={baseLang(lang)}
            />
          </div>
          <aside data-twin-inspector className="min-w-0 px-3 pb-3 lg:px-0 lg:pr-2">
            <RegionReadout
              key={selected?.region ?? "none"}
              region={selected}
              copy={copy}
              label={selected ? label(selected.region) : null}
            />
            <div className="mt-4 hidden lg:block">
              <p className="text-xs font-medium text-neutral-400">{copy.ranking}</p>
              {ranked.slice(0, 4).map((region) => (
                <button
                  key={region.region}
                  type="button"
                  onClick={() => selectRegion(region.region)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-xs text-neutral-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${BAND_DOT[region.recoveryBand]}`}
                    />
                    {label(region.region)}
                  </span>
                  <span className="font-mono">{region.recoveryPct ?? "—"}%</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <details className="group rounded-2xl border border-border bg-surface-2">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          {copy.modelDetails}
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="space-y-4 border-t border-border p-4 text-sm text-muted-foreground">
          <p>{copy.description}</p>
          <p>{copy.evidenceWindow(data.evidenceWindowDays)}</p>
          <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <dt>{copy.metaModel}</dt>
              <dd className="mt-1 break-words font-mono text-foreground">
                {data.calculationVersion}
              </dd>
            </div>
            <div>
              <dt>{copy.metaWindow}</dt>
              <dd className="mt-1 text-foreground">{copy.windowDays(data.evidenceWindowDays)}</dd>
            </div>
            <div>
              <dt>{copy.metaUpdated}</dt>
              <dd className="mt-1 text-foreground">{formatUpdated(data.computedAt, lang)}</dd>
            </div>
            <div>
              <dt>{copy.metaCoverage}</dt>
              <dd className="mt-1 text-foreground">
                {copy.coverage(withEvidence.length, data.regions.length)}
              </dd>
            </div>
          </dl>
          <p className="text-xs font-medium">{copy.legend}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {(["fresh", "moderate", "fatigued", "unknown"] as const).map((band) => (
              <span key={band} className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${BAND_DOT[band]}`} />
                {copy.bandLabel[band]}
              </span>
            ))}
          </div>
        </div>
      </details>

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
  const { user, loading: authLoading } = useAuth();
  const { lang, t } = useI18n();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["twin-snapshot", user?.id, timeZone],
    enabled: Boolean(user),
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });

  if (isLoading || authLoading) {
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
      key={user?.id}
      data={data}
      copy={copy}
      lang={lang}
      label={(region) => regionLabelFor(region, t)}
    />
  );
}

export { copyFor as twinCopyFor };
