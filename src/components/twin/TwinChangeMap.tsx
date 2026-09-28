import { useId, useState } from "react";
import { ArrowRight, ChevronDown, ScanLine } from "lucide-react";
import { BodyMap, type BodyMapRegion } from "./BodyMap";
import { TwinLedgerState } from "./TwinLedgerState";
import { changeTone, regionChange } from "./change-map.model";
import { isAnatomicalRegion, viewShowing, type BodyView } from "./body-map.geometry";
import { baseLang, formatLocale, type Lang } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import {
  compareTwinRewindRegions,
  type TwinRegionDelta,
  type TwinRewindPoint,
} from "@/lib/twin-rewind";
import "./TwinComparison.css";

const COPY = {
  lt: {
    title: "Raumenų pokyčių žemėlapis",
    description: "Dvi išsaugotos būsenos. Kiekvienos raumenų grupės rodikliai greta.",
    note: "Spalva rodo apskaičiuoto atsistatymo įverčio skirtumą. Aukštesnis įvertis neįrodo treniruotės poveikio, o žemesnis nėra traumos ar žalos nustatymas.",
    front: "Priekis",
    back: "Nugara",
    positive: "Įvertis aukštesnis",
    unchanged: "Nepakito",
    notCompared: "Nepalyginta",
    negative: "Įvertis žemesnis",
    recovery: "Atsistatymo įvertis",
    volume: "Registruotas krūvis",
    difference: "Skirtumas",
    from: "Ankstesnė būsena",
    to: "Pasirinkta būsena",
    previous: "Prieš",
    current: "Po",
    unknown: "Šiam rodikliui trūksta palyginamų duomenų.",
    select: "Pasirink raumenų grupę",
    points: "proc. p.",
    method: "Ką reiškia spalvos?",
    zone: "Laiko juosta",
    unavailable: "Šių būsenų palyginti negalima.",
    unavailableHelp: "Reikia dviejų suderinamų būsenų su prieinamais kūno regionų duomenimis.",
    schematic: "Scheminis palyginimo žemėlapis",
    missing: "Brūkšnys reiškia nežinomą reikšmę; jis nėra nulis.",
  },
  en: {
    title: "Muscle change map",
    description: "Two saved states. Each muscle group's readings, side by side.",
    note: "Colour shows the difference in the calculated recovery estimate. A higher estimate does not prove a training effect; a lower estimate does not establish injury or harm.",
    front: "Front",
    back: "Back",
    positive: "Estimate higher",
    unchanged: "Unchanged",
    notCompared: "Not compared",
    negative: "Estimate lower",
    recovery: "Recovery estimate",
    volume: "Logged volume",
    difference: "Difference",
    from: "Previous state",
    to: "Selected state",
    previous: "Before",
    current: "After",
    unknown: "Comparable data is missing for this reading.",
    select: "Choose a muscle group",
    points: "pp",
    method: "What do the colours mean?",
    zone: "Time zone",
    unavailable: "These states cannot be compared.",
    unavailableHelp: "Two compatible states with available body-region data are needed.",
    schematic: "Schematic comparison map",
    missing: "A dash means an unknown reading; it is not zero.",
  },
};
type Copy = (typeof COPY)[keyof typeof COPY];
type Props = {
  older: TwinRewindPoint;
  newer: TwinRewindPoint;
  lang: Lang;
  regionLabel: (region: string) => string;
};
function value(number: number | null, unit: string, locale: string, signed = false) {
  if (number === null || !Number.isFinite(number)) return "—";
  const normalized = number === 0 ? 0 : number;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1, ...(signed ? { signDisplay: "exceptZero" as const } : {}) }).format(normalized)} ${unit}`;
}
function time(date: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(date));
}
export function TwinChangeMap(props: Props) {
  const deltas = compareTwinRewindRegions(props.older, props.newer);
  const copy = COPY[baseLang(props.lang)];
  if (!deltas)
    return (
      <TwinLedgerState state="empty" title={copy.unavailable} description={copy.unavailableHelp} />
    );
  return <Comparison key={`${props.older.id}:${props.newer.id}`} {...props} deltas={deltas} />;
}
function Comparison({
  older,
  newer,
  lang,
  regionLabel,
  deltas,
}: Props & { deltas: TwinRegionDelta[] }) {
  const id = useId(),
    copy = COPY[baseLang(lang)],
    locale = formatLocale(lang),
    timeZone = browserTimeZone();
  const firstKnown = deltas.find(
    (region) => isAnatomicalRegion(region.region) && region.recoveryPctDelta !== null,
  );
  const [selectedRegion, setSelectedRegion] = useState<string | null>(firstKnown?.region ?? null);
  const [view, setView] = useState<BodyView>(() =>
    firstKnown ? viewShowing(firstKnown.region, "front") : "front",
  );
  const regions: BodyMapRegion[] = deltas.map((region) => {
    const change = regionChange(region.recoveryPctDelta);
    return {
      region: region.region,
      tone: changeTone(change),
      value:
        change.state === "changed"
          ? value(change.delta, copy.points, locale, true)
          : change.state === "unchanged"
            ? copy.unchanged
            : null,
    };
  });
  const selected = deltas.find((region) => region.region === selectedRegion) ?? null;
  const tone = selected ? changeTone(regionChange(selected.recoveryPctDelta)) : "muted";
  const toneLabels = {
    cool: copy.positive,
    neutral: copy.unchanged,
    hot: copy.negative,
    muted: copy.notCompared,
  };
  function selectRegion(region: string) {
    setSelectedRegion(region || null);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  }
  return (
    <section className="fl-change-map" aria-labelledby={`${id}-title`}>
      <header className="fl-comparison-heading">
        <p className="fl-ledger-eyebrow">
          <ScanLine aria-hidden="true" />
          Twin
        </p>
        <h3 id={`${id}-title`}>{copy.title}</h3>
        <p>{copy.description}</p>
      </header>
      <div className="fl-comparison-dates">
        <div>
          <span>{copy.from}</span>
          <time dateTime={older.computedAt}>{time(older.computedAt, locale, timeZone)}</time>
        </div>
        <ArrowRight aria-hidden="true" />
        <div>
          <span>{copy.to}</span>
          <time dateTime={newer.computedAt}>{time(newer.computedAt, locale, timeZone)}</time>
        </div>
        <p>
          {copy.zone}: {timeZone}
        </p>
      </div>
      <div className="fl-change-workspace">
        <figure className="fl-change-stage">
          <div className="fl-comparison-toggle" role="group" aria-label={copy.schematic}>
            {(["front", "back"] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={view === candidate}
                onClick={() => setView(candidate)}
              >
                {copy[candidate]}
              </button>
            ))}
          </div>
          <div className="fl-change-figure">
            <BodyMap
              regions={regions}
              view={view}
              selectedRegion={selectedRegion}
              onSelectRegion={selectRegion}
              regionLabel={regionLabel}
            />
          </div>
          <figcaption>{copy.schematic}</figcaption>
        </figure>
        <div className="fl-change-readout">
          <label htmlFor={`${id}-muscle`}>{copy.select}</label>
          <select
            id={`${id}-muscle`}
            value={selected?.region ?? ""}
            onChange={(event) => selectRegion(event.target.value)}
          >
            <option value="">{copy.select}</option>
            {deltas.map((region) => (
              <option key={region.region} value={region.region}>
                {regionLabel(region.region)}
              </option>
            ))}
          </select>
          {selected ? (
            <>
              <div className="fl-change-selection">
                <h4>{regionLabel(selected.region)}</h4>
                <span data-tone={tone}>
                  {tone === "cool"
                    ? copy.positive
                    : tone === "neutral"
                      ? copy.unchanged
                      : tone === "hot"
                        ? copy.negative
                        : copy.notCompared}
                </span>
              </div>
              <Metric
                kind="recovery"
                title={copy.recovery}
                older={selected.olderRecoveryPct}
                newer={selected.newerRecoveryPct}
                delta={selected.recoveryPctDelta}
                unit="%"
                deltaUnit={copy.points}
                copy={copy}
                locale={locale}
              />
              <Metric
                kind="volume"
                title={copy.volume}
                older={selected.olderVolumeKg}
                newer={selected.newerVolumeKg}
                delta={selected.volumeKgDelta}
                unit="kg"
                deltaUnit="kg"
                copy={copy}
                locale={locale}
              />
            </>
          ) : (
            <p className="fl-comparison-note">{copy.select}</p>
          )}
          <p className="fl-comparison-note">{copy.missing}</p>
        </div>
      </div>
      <ul className="fl-change-legend" aria-label={copy.method}>
        {(["cool", "neutral", "hot", "muted"] as const).map((candidate) => (
          <li key={candidate} data-tone={candidate}>
            <i aria-hidden="true" />
            {toneLabels[candidate]}
          </li>
        ))}
      </ul>
      <details className="fl-comparison-method">
        <summary>
          {copy.method}
          <ChevronDown aria-hidden="true" />
        </summary>
        <p>{copy.note}</p>
      </details>
    </section>
  );
}
function Metric({
  kind,
  title,
  older,
  newer,
  delta,
  unit,
  deltaUnit,
  copy,
  locale,
}: {
  kind: string;
  title: string;
  older: number | null;
  newer: number | null;
  delta: number | null;
  unit: string;
  deltaUnit: string;
  copy: Copy;
  locale: string;
}) {
  const change = regionChange(delta);
  const normalizedDelta =
    change.state === "changed" ? change.delta : change.state === "unchanged" ? 0 : null;
  return (
    <article className="fl-change-metric" data-metric={kind}>
      <h5>{title}</h5>
      <dl>
        <div>
          <dt>{copy.previous}</dt>
          <dd>{value(older, unit, locale)}</dd>
        </div>
        <div>
          <dt>{copy.current}</dt>
          <dd>{value(newer, unit, locale)}</dd>
        </div>
        <div className="fl-change-difference">
          <dt>{copy.difference}</dt>
          <dd>{value(normalizedDelta, deltaUnit, locale, true)}</dd>
        </div>
      </dl>
      {normalizedDelta === null ? <p>{copy.unknown}</p> : null}
    </article>
  );
}
