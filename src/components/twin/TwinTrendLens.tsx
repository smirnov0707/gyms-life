import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronDown, Minus } from "lucide-react";
import { TwinLedgerState } from "./TwinLedgerState";
import { browserTimeZone } from "@/lib/local-day";
import "./TwinTrendLens.css";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n, type TKey } from "@/lib/i18n";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { getTwinTrendHistory } from "@/lib/twin-trend.functions";
import {
  buildTwinMetricTrend,
  buildTwinRegionTrend,
  TWIN_TREND_METRIC_KEYS,
  TWIN_TREND_MIN_POINTS,
  TWIN_TREND_MIN_SPAN_HOURS,
  type TwinTrendMetricKey,
  type TwinTrendSeries,
} from "@/lib/twin-trend";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

const COPY = {
  lt: {
    eyebrow: "Twin dinamika",
    title: "Tavo rodiklių istorija.",
    description: "Žvelk į visumą arba vienos raumenų grupės istoriją.",
    note: `Kryptis rodoma tik turint bent ${TWIN_TREND_MIN_POINTS} tinkamas reikšmes per bent ${TWIN_TREND_MIN_SPAN_HOURS / 24} paras. Ji reiškia tik naujausios ir ankstyviausios saugomos reikšmės santykį — ne statistinį reikšmingumą, progresą ar priežastį. Linija tik sujungia išsaugotus taškus; tarpinės būsenos nekuriamos.`,
    loading: "Įkeliama Twin dinamika…",
    error: "Nepavyko įkelti Twin dinamikos. Tai nereiškia, kad duomenų nėra.",
    method: "Kaip skaityti šią istoriją",
    exact: "Tikslios reikšmės",
    date: "Išsaugota",
    value: "Reikšmė",
    zone: "Laiko juosta",
    scale: "Skalė pritaikyta stebėtoms reikšmėms.",
    missing: "Įrašai be šio rodiklio reikšmės:",
    noValues: "Šiam rodikliui dar nėra tinkamų reikšmių.",
    emptyHelp: "Istorija atsiras, kai bus išsaugotos palyginamos Twin būsenos.",
    points: "p.",
    percentagePoints: "proc. p.",
    empty: "Dar nėra palyginamos istorijos.",
    global: "Bendras rodiklis",
    regional: "Raumenų grupė",
    recovery: "Atsistatymo įvertis",
    volume: "Registruotas krūvis",
    observations: "Stebėjimai",
    span: "Laikotarpis",
    days: "d.",
    earliest: "Ankstyviausia",
    latest: "Naujausia",
    net: "Skirtumas",
    range: "Intervalas",
    insufficientPoints: `Dar reikia bent ${TWIN_TREND_MIN_POINTS} tinkamų stebėjimų.`,
    insufficientSpan: `Stebėjimų pakanka, bet reikia bent ${TWIN_TREND_MIN_SPAN_HOURS / 24} parų intervalo.`,
    higher: "Naujausia reikšmė aukštesnė už ankstyviausią",
    lower: "Naujausia reikšmė žemesnė už ankstyviausią",
    unchanged: "Naujausia reikšmė sutampa su ankstyviausia",
    incomplete: "Nepavyko patikrinti įrašų:",
    incompatible: "Neįtraukti kitaip apskaičiuoti įrašai:",
    older: "Yra senesnių įrašų. Ši peržiūra apima iki 60 naujausių saugomų būsenų.",
    metrics: {
      sessionsLast7Days: "Treniruotės · 7 d.",
      totalVolumeLast28Days: "Krūvis · 28 d.",
      readiness: "Pasiruošimas",
      sleepHours: "Miegas · 7 d. vid.",
      weightKg: "Svoris",
      calories: "Kalorijos · registruotos d.",
      proteinG: "Baltymai · registruotos d.",
    },
  },
  en: {
    eyebrow: "Twin dynamics",
    title: "Your rhythm, over time.",
    description: "Explore the bigger picture or one muscle group’s history.",
    note: `Direction is shown only with at least ${TWIN_TREND_MIN_POINTS} valid values spanning at least ${TWIN_TREND_MIN_SPAN_HOURS / 24} days. It only describes latest versus earliest stored value — not statistical significance, progress or causation. The line only connects stored points; no intermediate states are created.`,
    loading: "Loading Twin dynamics…",
    error: "Twin dynamics could not be loaded. This does not mean no data exists.",
    method: "How to read this history",
    exact: "Exact values",
    date: "Saved",
    value: "Value",
    zone: "Time zone",
    scale: "Scale follows the observed values.",
    missing: "Records without a value for this metric:",
    noValues: "There are no valid values for this metric yet.",
    emptyHelp: "History will appear when comparable Twin states have been saved.",
    points: "pt",
    percentagePoints: "pp",
    empty: "No comparable history yet.",
    global: "Overall metric",
    regional: "Muscle group",
    recovery: "Recovery estimate",
    volume: "Logged volume",
    observations: "Observations",
    span: "Span",
    days: "d",
    earliest: "Earliest",
    latest: "Latest",
    net: "Difference",
    range: "Range",
    insufficientPoints: `At least ${TWIN_TREND_MIN_POINTS} valid observations are required.`,
    insufficientSpan: `There are enough observations, but at least ${TWIN_TREND_MIN_SPAN_HOURS / 24} days of span are required.`,
    higher: "Latest value is higher than the earliest",
    lower: "Latest value is lower than the earliest",
    unchanged: "Latest value matches the earliest",
    incomplete: "Records that could not be checked:",
    incompatible: "Excluded records calculated differently:",
    older: "Older records exist. This view covers up to 60 of the latest stored states.",
    metrics: {
      sessionsLast7Days: "Sessions · 7d",
      totalVolumeLast28Days: "Volume · 28d",
      readiness: "Readiness",
      sleepHours: "Sleep · 7d avg",
      weightKg: "Weight",
      calories: "Calories · logged days",
      proteinG: "Protein · logged days",
    },
  },
};

type Copy = (typeof COPY)[keyof typeof COPY];

const UNITS: Partial<Record<TwinTrendMetricKey, string>> = {
  totalVolumeLast28Days: "kg",
  readiness: "/100",
  sleepHours: "h",
  weightKg: "kg",
  calories: "kcal",
  proteinG: "g",
};

function regionLabelFor(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

function formatValue(
  value: number | null,
  locale: string,
  unit?: string,
  maximumFractionDigits = 1,
): string {
  if (value === null) return "—";
  const rendered = new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

function signed(value: number | null, locale: string, unit?: string): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${formatValue(value, locale, unit)}`;
}

function dateLabel(value: string, locale: string, timeZone: string, withTime = false) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? ({ hour: "2-digit", minute: "2-digit", second: "2-digit" } as const) : {}),
    timeZone,
  }).format(new Date(value));
}

function Sparkline({
  series,
  label,
  unit,
  copy,
  locale,
  timeZone,
}: {
  series: TwinTrendSeries;
  label: string;
  unit: string | undefined;
  copy: Copy;
  locale: string;
  timeZone: string;
}) {
  const first = series.samples[0],
    last = series.samples.at(-1);
  const min = series.minValue,
    max = series.maxValue;
  // The chart and its direction share the engine's four-observation/72-hour gate.
  if (series.availability !== "available" || !first || !last || min === null || max === null)
    return null;
  const start = Date.parse(first.computedAt),
    duration = Date.parse(last.computedAt) - start;
  if (duration <= 0) return null;
  const points = series.samples.map((sample) => ({
    x: 8 + ((Date.parse(sample.computedAt) - start) / duration) * 504,
    y: max === min ? 72 : 8 + ((max - sample.value) / (max - min)) * 128,
    sample,
  }));
  return (
    <figure className="fl-trend-chart">
      <div className="fl-trend-scale" aria-hidden="true">
        <span>{formatValue(max, locale, unit)}</span>
        {max !== min ? <span>{formatValue(min, locale, unit)}</span> : null}
      </div>
      <svg
        viewBox="0 0 520 144"
        role="img"
        aria-label={`${label}. ${copy.range}: ${formatValue(min, locale, unit)} – ${formatValue(max, locale, unit)}. ${copy.scale}`}
        preserveAspectRatio="none"
      >
        {[8, 72, 136].map((y) => (
          <path key={y} d={`M8 ${y}H512`} className="fl-trend-gridline" />
        ))}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        />
        {points.map((p) => (
          <circle key={p.sample.snapshotId} cx={p.x} cy={p.y} r="3" fill="currentColor">
            <title>
              {dateLabel(p.sample.computedAt, locale, timeZone, true)} ·{" "}
              {formatValue(p.sample.value, locale, unit)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="fl-trend-dates">
        <time dateTime={first.computedAt}>{dateLabel(first.computedAt, locale, timeZone)}</time>
        <time dateTime={last.computedAt}>{dateLabel(last.computedAt, locale, timeZone)}</time>
      </div>
      <figcaption>{copy.scale}</figcaption>
    </figure>
  );
}

function SeriesCard({
  series,
  label,
  unit,
  deltaUnit = unit,
  totalCount,
  copy,
  locale,
  timeZone,
}: {
  series: TwinTrendSeries;
  label: string;
  unit: string | undefined;
  deltaUnit?: string | undefined;
  totalCount: number;
  copy: Copy;
  locale: string;
  timeZone: string;
}) {
  const direction = series.direction ? copy[series.direction] : null;
  const DirectionIcon =
    series.direction === "higher"
      ? ArrowUpRight
      : series.direction === "lower"
        ? ArrowDownRight
        : Minus;
  const latest = series.samples.at(-1);
  const missing = totalCount - series.pointCount;
  return (
    <div className="fl-trend-series" data-availability={series.availability}>
      <header>
        <h3>{label}</h3>
        <p className="fl-trend-latest">
          {formatValue(series.latestValue, locale)}
          {series.latestValue !== null && unit ? <small>{unit}</small> : null}
        </p>
        <p className="fl-trend-stamp">
          {copy.latest}
          {latest ? (
            <>
              {" "}
              ·{" "}
              <time dateTime={latest.computedAt}>
                {dateLabel(latest.computedAt, locale, timeZone, true)}
              </time>
            </>
          ) : null}
        </p>
      </header>
      <div className="fl-trend-meta">
        <span>
          {copy.observations} <strong>{formatValue(series.pointCount, locale)}</strong>
        </span>
        <span>
          {copy.span}{" "}
          <strong>
            {formatValue(series.spanHours / 24, locale)} {copy.days}
          </strong>
        </span>
      </div>
      <Sparkline
        series={series}
        label={label}
        unit={unit}
        copy={copy}
        locale={locale}
        timeZone={timeZone}
      />
      <p className="fl-trend-direction" data-available={series.availability === "available"}>
        {direction ? (
          <>
            <DirectionIcon aria-hidden="true" />
            {direction}
          </>
        ) : series.pointCount === 0 ? (
          copy.noValues
        ) : series.availability === "insufficient_points" ? (
          copy.insufficientPoints
        ) : (
          copy.insufficientSpan
        )}
      </p>
      <dl className="fl-trend-summary">
        <div>
          <dt>{copy.earliest}</dt>
          <dd>{formatValue(series.earliestValue, locale, unit)}</dd>
        </div>
        <div>
          <dt>{copy.net}</dt>
          <dd>{signed(series.netChange, locale, deltaUnit)}</dd>
        </div>
        <div>
          <dt>{copy.range}</dt>
          <dd>
            {series.minValue === null
              ? "—"
              : `${formatValue(series.minValue, locale)}–${formatValue(series.maxValue, locale, unit)}`}
          </dd>
        </div>
      </dl>
      {missing > 0 ? (
        <p className="fl-trend-missing">
          {copy.missing} {formatValue(missing, locale)}
        </p>
      ) : null}
      {series.samples.length > 0 ? (
        <details className="fl-trend-values">
          <summary>
            {copy.exact}
            <ChevronDown aria-hidden="true" />
          </summary>
          <p>
            {copy.zone}: {timeZone}
          </p>
          <table>
            <caption className="sr-only">
              {label} · {copy.exact}
            </caption>
            <thead>
              <tr>
                <th scope="col">{copy.date}</th>
                <th scope="col">{copy.value}</th>
              </tr>
            </thead>
            <tbody>
              {series.samples.map((sample) => (
                <tr key={sample.snapshotId}>
                  <td>
                    <time dateTime={sample.computedAt}>
                      {dateLabel(sample.computedAt, locale, timeZone, true)}
                    </time>
                  </td>
                  <td>{formatValue(sample.value, locale, unit, 20)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}

export function TwinTrendLens({
  initialRegion = null,
  initiallyExpanded = false,
}: {
  initialRegion?: string | null;
  initiallyExpanded?: boolean;
} = {}) {
  const { user, loading: authLoading } = useAuth();
  const { lang, t } = useI18n();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [metric, setMetric] = useState<TwinTrendMetricKey>("readiness");
  const [regionMetric, setRegionMetric] = useState<"recoveryPct" | "volumeKg">("recoveryPct");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const id = useId();
  const copy = COPY[baseLang(lang)],
    locale = formatLocale(lang),
    timeZone = browserTimeZone();
  const query = useQuery({
    queryKey: ["twin-trend", user?.id],
    enabled: expanded && Boolean(user) && !authLoading,
    queryFn: () => getTwinTrendHistory(),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
  });
  // Failed refreshes withdraw cached readings and their coverage together.
  const data = query.isSuccess ? query.data : undefined;
  const regions = useMemo(
    () =>
      data
        ? [
            ...new Set(
              data.points.flatMap((point) => point.regions.map((region) => region.region)),
            ),
          ].sort()
        : [],
    [data],
  );
  // A requested muscle must never silently borrow another muscle's history.
  const activeRegion = initialRegion ?? selectedRegion ?? regions[0] ?? null;
  if (!user || authLoading) return null;
  const metricSeries = data ? buildTwinMetricTrend(data, metric) : null;
  const regionSeries =
    data && activeRegion ? buildTwinRegionTrend(data, activeRegion, regionMetric) : null;
  return (
    <section className="fl-trend-lens" aria-labelledby={`${id}-title`}>
      <header className="fl-trend-heading">
        <span className="fl-ledger-eyebrow">
          <Activity aria-hidden="true" />
          {copy.eyebrow}
        </span>
        <h2>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`${id}-content`}
            onClick={() => setExpanded((value) => !value)}
          >
            <span id={`${id}-title`}>{copy.title}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </h2>
        <p>{copy.description}</p>
      </header>
      <div id={`${id}-content`} hidden={!expanded} className="fl-trend-content">
        {query.isPending ? (
          <TwinLedgerState state="loading" title={copy.loading} />
        ) : query.isError ? (
          <TwinLedgerState
            state="error"
            title={copy.error}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : data ? (
          <>
            {data.points.length === 0 ? (
              <TwinLedgerState state="empty" title={copy.empty} description={copy.emptyHelp} />
            ) : (
              <div className="fl-trend-panels">
                {!initialRegion && metricSeries ? (
                  <article className="fl-trend-panel" data-scope="overall">
                    <div className="fl-trend-controls">
                      <label htmlFor={`${id}-metric`}>{copy.global}</label>
                      <select
                        id={`${id}-metric`}
                        value={metric}
                        onChange={(event) => {
                          const key = TWIN_TREND_METRIC_KEYS.find(
                            (key) => key === event.target.value,
                          );
                          if (key) setMetric(key);
                        }}
                      >
                        {TWIN_TREND_METRIC_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {copy.metrics[key]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <SeriesCard
                      series={metricSeries}
                      label={copy.metrics[metric]}
                      unit={UNITS[metric]}
                      deltaUnit={metric === "readiness" ? copy.points : UNITS[metric]}
                      totalCount={data.points.length}
                      copy={copy}
                      locale={locale}
                      timeZone={timeZone}
                    />
                  </article>
                ) : null}
                {activeRegion && regionSeries ? (
                  <article className="fl-trend-panel" data-scope="region">
                    <div className="fl-trend-controls">
                      {initialRegion ? (
                        <p className="fl-trend-region-label">
                          {copy.regional} · {regionLabelFor(activeRegion, t)}
                        </p>
                      ) : (
                        <>
                          <label htmlFor={`${id}-region`}>{copy.regional}</label>
                          <select
                            id={`${id}-region`}
                            value={activeRegion}
                            onChange={(event) => setSelectedRegion(event.target.value)}
                          >
                            {regions.map((region) => (
                              <option key={region} value={region}>
                                {regionLabelFor(region, t)}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                      <div
                        className="fl-trend-toggle"
                        role="group"
                        aria-label={regionLabelFor(activeRegion, t)}
                      >
                        <button
                          type="button"
                          aria-pressed={regionMetric === "recoveryPct"}
                          onClick={() => setRegionMetric("recoveryPct")}
                        >
                          {copy.recovery}
                        </button>
                        <button
                          type="button"
                          aria-pressed={regionMetric === "volumeKg"}
                          onClick={() => setRegionMetric("volumeKg")}
                        >
                          {copy.volume}
                        </button>
                      </div>
                    </div>
                    <SeriesCard
                      series={regionSeries}
                      label={`${regionLabelFor(activeRegion, t)} · ${regionMetric === "recoveryPct" ? copy.recovery : copy.volume}`}
                      unit={regionMetric === "recoveryPct" ? "%" : "kg"}
                      deltaUnit={regionMetric === "recoveryPct" ? copy.percentagePoints : "kg"}
                      totalCount={data.points.length}
                      copy={copy}
                      locale={locale}
                      timeZone={timeZone}
                    />
                  </article>
                ) : null}
              </div>
            )}
            {data.omittedCount > 0 || data.incompatibleCount > 0 || data.hasMore ? (
              <aside className="fl-trend-coverage">
                {data.omittedCount > 0 ? (
                  <p>
                    {copy.incomplete} {formatValue(data.omittedCount, locale)}
                  </p>
                ) : null}
                {data.incompatibleCount > 0 ? (
                  <p>
                    {copy.incompatible} {formatValue(data.incompatibleCount, locale)}
                  </p>
                ) : null}
                {data.hasMore ? <p>{copy.older}</p> : null}
              </aside>
            ) : null}
          </>
        ) : null}
        <details className="fl-trend-method">
          <summary>
            {copy.method}
            <ChevronDown aria-hidden="true" />
          </summary>
          <p>{copy.note}</p>
        </details>
      </div>
    </section>
  );
}
