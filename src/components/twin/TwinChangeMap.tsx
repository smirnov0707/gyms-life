import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { BodyMap, type BodyMapRegion, type BodyMapTone } from "./BodyMap";
import { isAnatomicalRegion, viewShowing, type BodyView } from "./body-map.geometry";
import { baseLang, formatLocale, type Lang } from "@/lib/i18n";
import {
  compareTwinRewindRegions,
  type TwinRegionDelta,
  type TwinRewindPoint,
} from "@/lib/twin-rewind";

const COPY = {
  lt: {
    title: "Twin Change Map",
    description:
      "Kūno regionų skirtumas tarp dviejų tikrai išsaugotų, suderinamų Twin būsenų.",
    note: "Spalva rodo tik apskaičiuoto atsistatymo įverčio kryptį tarp šių dviejų snapshot'ų. Teigiamas skirtumas nėra įrodymas, kad treniruotė sukėlė pagerėjimą; neigiamas nėra diagnozė ar žala.",
    front: "Priekis",
    back: "Nugara",
    positive: "Įvertis aukštesnis",
    unchanged: "Įvertis nepakito / nežinomas",
    negative: "Įvertis žemesnis",
    recoveryChange: "Atsistatymo įverčio skirtumas",
    volumeChange: "Registruoto krūvio skirtumas",
    from: "Nuo",
    to: "Iki",
    unknown: "Nepakanka abiejų būsenų duomenų",
    select: "Pasirink kūno regioną, kad pamatytum skaitinį skirtumą.",
    points: "proc. p.",
  },
  en: {
    title: "Twin Change Map",
    description: "Body-region differences between two real stored, compatible Twin states.",
    note: "Colour shows only the direction of the calculated recovery estimate between these two snapshots. A positive difference is not proof that training caused improvement; a negative difference is not a diagnosis or injury signal.",
    front: "Front",
    back: "Back",
    positive: "Estimate higher",
    unchanged: "Estimate unchanged / unknown",
    negative: "Estimate lower",
    recoveryChange: "Recovery-estimate difference",
    volumeChange: "Logged-volume difference",
    from: "From",
    to: "To",
    unknown: "Insufficient data in both states",
    select: "Select a body region to inspect its numeric difference.",
    points: "pp",
  },
};

function toneFor(delta: number | null): BodyMapTone {
  if (delta === null || delta === 0) return "muted";
  return delta > 0 ? "cool" : "hot";
}

function signed(value: number | null, unit: string, locale: string): string {
  if (value === null) return "—";
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return `${value > 0 ? "+" : ""}${number} ${unit}`;
}

function time(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TwinChangeMap({
  older,
  newer,
  lang,
  regionLabel,
}: {
  older: TwinRewindPoint;
  newer: TwinRewindPoint;
  lang: Lang;
  regionLabel: (region: string) => string;
}) {
  const language = baseLang(lang);
  const copy = COPY[language];
  const locale = formatLocale(lang);
  const deltas = useMemo(() => compareTwinRewindRegions(older, newer), [older, newer]);
  const firstKnown = deltas?.find(
    (region) => isAnatomicalRegion(region.region) && region.recoveryPctDelta !== null,
  );
  const [selectedRegion, setSelectedRegion] = useState<string | null>(firstKnown?.region ?? null);
  const [view, setView] = useState<BodyView>(() =>
    firstKnown ? viewShowing(firstKnown.region, "front") : "front",
  );

  if (!deltas) return null;

  const regions: BodyMapRegion[] = deltas.map((region) => ({
    region: region.region,
    tone: toneFor(region.recoveryPctDelta),
    value:
      region.recoveryPctDelta === null
        ? null
        : signed(region.recoveryPctDelta, copy.points, locale),
  }));
  const selected = deltas.find((region) => region.region === selectedRegion) ?? null;

  function selectRegion(region: string) {
    setSelectedRegion(region);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  }

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{copy.title}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {copy.description}
          </p>
        </div>
        <div className="flex rounded-xl border border-border p-1" aria-label={copy.title}>
          {(["front", "back"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={view === candidate}
              onClick={() => setView(candidate)}
              className="min-h-11 rounded-lg px-3 text-xs font-medium text-foreground aria-pressed:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {candidate === "front" ? copy.front : copy.back}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{copy.note}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(260px,1.1fr)]">
        <div className="min-h-[360px] rounded-2xl border border-border bg-surface-2 p-2">
          <BodyMap
            regions={regions}
            view={view}
            selectedRegion={selectedRegion}
            onSelectRegion={selectRegion}
            regionLabel={regionLabel}
          />
        </div>

        <div className="min-w-0">
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
            <span className="rounded-lg border border-emerald-500/20 px-2 py-2 text-center">
              {copy.positive}
            </span>
            <span className="rounded-lg border border-border px-2 py-2 text-center">
              {copy.unchanged}
            </span>
            <span className="rounded-lg border border-rose-500/20 px-2 py-2 text-center">
              {copy.negative}
            </span>
          </div>

          {selected ? (
            <RegionDeltaReadout delta={selected} copy={copy} locale={locale} label={regionLabel} />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{copy.select}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-3 text-xs text-muted-foreground">
            <span>
              {copy.from}: {time(older.computedAt, locale)}
            </span>
            <ArrowRight aria-hidden="true" className="size-3.5 shrink-0" />
            <span>
              {copy.to}: {time(newer.computedAt, locale)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RegionDeltaReadout({
  delta,
  copy,
  locale,
  label,
}: {
  delta: TwinRegionDelta;
  copy: (typeof COPY)[keyof typeof COPY];
  locale: string;
  label: (region: string) => string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
      <h4 className="text-base font-semibold text-foreground">{label(delta.region)}</h4>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {copy.recoveryChange}
          </dt>
          <dd className="mt-1 font-mono text-lg text-foreground">
            {delta.recoveryPctDelta === null
              ? "—"
              : signed(delta.recoveryPctDelta, copy.points, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {copy.volumeChange}
          </dt>
          <dd className="mt-1 font-mono text-lg text-foreground">
            {delta.volumeKgDelta === null ? "—" : signed(delta.volumeKgDelta, "kg", locale)}
          </dd>
        </div>
      </dl>
      {delta.recoveryPctDelta === null && delta.volumeKgDelta === null ? (
        <p className="mt-2 text-xs text-muted-foreground">{copy.unknown}</p>
      ) : null}
    </div>
  );
}
