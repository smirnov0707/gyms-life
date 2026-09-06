import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronDown, Loader2 } from "lucide-react";
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
    title: "Twin Trend Lens",
    description: "Stebimų Twin reikšmių seka per realiai išsaugotas būsenas.",
    note: `Kryptis rodoma tik turint bent ${TWIN_TREND_MIN_POINTS} tinkamas reikšmes per bent ${TWIN_TREND_MIN_SPAN_HOURS / 24} paras. Ji reiškia tik naujausios ir ankstyviausios saugomos reikšmės santykį — ne statistinį reikšmingumą, progresą ar priežastį. Linija tik sujungia išsaugotus taškus; tarpinės būsenos nekuriamos.`,
    loading: "Įkeliama Twin dinamika…",
    error: "Nepavyko įkelti Twin dinamikos. Tai nereiškia, kad duomenų nėra.",
    retry: "Bandyti dar kartą",
    empty: "Dar nėra suderinamų Twin snapshot'ų dinamikai.",
    global: "Bendra metrika",
    regional: "Kūno regionas",
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
    incomplete: "Dalies snapshot'ų nepavyko patikrinti:",
    incompatible: "Nesuderinamų senesnės modelio/schemos versijos snapshot'ų:",
    older: "Yra ir senesnių snapshot'ų už šio riboto 60 įrašų lango.",
    metrics: {
      sessionsLast7Days: "Treniruotės · 7 d.",
      totalVolumeLast28Days: "Krūvis · 28 d.",
      readiness: "Readiness",
      sleepHours: "Miegas · 7 d. vid.",
      weightKg: "Svoris",
      calories: "Kalorijos · registruotos d.",
      proteinG: "Baltymai · registruotos d.",
    },
  },
  en: {
    title: "Twin Trend Lens",
    description: "A sequence of observed Twin values across real stored states.",
    note: `Direction is shown only with at least ${TWIN_TREND_MIN_POINTS} valid values spanning at least ${TWIN_TREND_MIN_SPAN_HOURS / 24} days. It only describes latest versus earliest stored value — not statistical significance, progress or causation. The line only connects stored points; no intermediate states are created.`,
    loading: "Loading Twin dynamics…",
    error: "Twin dynamics could not be loaded. This does not mean no data exists.",
    retry: "Try again",
    empty: "There are no compatible Twin snapshots for dynamics yet.",
    global: "Global metric",
    regional: "Body region",
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
    incomplete: "Snapshots that could not be validated:",
    incompatible: "Older model/schema snapshots not reinterpreted:",
    older: "Older snapshots exist outside this bounded 60-record window.",
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

function formatValue(value: number | null, locale: string, unit?: string): string {
  if (value === null) return "—";
  const rendered = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

function signed(value: number | null, locale: string, unit?: string): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${formatValue(value, locale, unit)}`;
}

function Sparkline({ series, label }: { series: TwinTrendSeries; label: string }) {
  const width = 520;
  const height = 112;
  const pad = 10;
  const values = series.samples.map((sample) => sample.value);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const start = series.samples[0] ? Date.parse(series.samples[0].computedAt) : 0;
  const end = series.samples.at(-1) ? Date.parse(series.samples.at(-1)!.computedAt) : start;
  const timeSpan = Math.max(1, end - start);
  const valueSpan = Math.max(1e-9, max - min);
  const points = series.samples.map((sample) => {
    const x = pad + ((Date.parse(sample.computedAt) - start) / timeSpan) * (width - pad * 2);
    const y =
      max === min ? height / 2 : pad + ((max - sample.value) / valueSpan) * (height - pad * 2);
    return { x, y, sample };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="mt-3 h-28 w-full text-primary"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      />
      {points.map((point) => (
        <circle
          key={point.sample.snapshotId}
          cx={point.x}
          cy={point.y}
          r="3"
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function SeriesCard({
  series,
  label,
  unit,
  copy,
  locale,
}: {
  series: TwinTrendSeries;
  label: string;
  unit: string | undefined;
  copy: Copy;
  locale: string;
}) {
  const direction =
    series.direction === "higher"
      ? copy.higher
      : series.direction === "lower"
        ? copy.lower
        : series.direction === "unchanged"
          ? copy.unchanged
          : null;
  const spanDays = series.spanHours / 24;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          {copy.observations}: {series.pointCount} · {copy.span}: {formatValue(spanDays, locale)}{" "}
          {copy.days}
        </span>
      </div>
      {series.samples.length > 0 ? <Sparkline series={series} label={label} /> : null}
      {series.availability === "insufficient_points" ? (
        <p className="mt-3 text-xs text-muted-foreground">{copy.insufficientPoints}</p>
      ) : series.availability === "insufficient_span" ? (
        <p className="mt-3 text-xs text-muted-foreground">{copy.insufficientSpan}</p>
      ) : (
        <p className="mt-3 text-xs font-medium text-foreground">{direction}</p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{copy.earliest}</dt>
          <dd className="mt-1 font-mono text-foreground">
            {formatValue(series.earliestValue, locale, unit)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.latest}</dt>
          <dd className="mt-1 font-mono text-foreground">
            {formatValue(series.latestValue, locale, unit)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.net}</dt>
          <dd className="mt-1 font-mono text-foreground">
            {signed(series.netChange, locale, unit)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.range}</dt>
          <dd className="mt-1 font-mono text-foreground">
            {formatValue(series.minValue, locale, unit)}–
            {formatValue(series.maxValue, locale, unit)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function TwinTrendLens() {
  const { user, loading: authLoading } = useAuth();
  const { lang, t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [metric, setMetric] = useState<TwinTrendMetricKey>("readiness");
  const [regionMetric, setRegionMetric] = useState<"recoveryPct" | "volumeKg">("recoveryPct");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const contentId = useId();
  const headingId = useId();
  const copy = COPY[baseLang(lang)];
  const locale = formatLocale(lang);
  const query = useQuery({
    queryKey: ["twin-trend", user?.id],
    enabled: expanded && Boolean(user) && !authLoading,
    queryFn: () => getTwinTrendHistory(),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
  });
  const regions = useMemo(
    () =>
      query.data
        ? [
            ...new Set(
              query.data.points.flatMap((point) => point.regions.map((region) => region.region)),
            ),
          ].sort()
        : [],
    [query.data],
  );
  const activeRegion =
    selectedRegion && regions.includes(selectedRegion) ? selectedRegion : (regions[0] ?? null);

  if (!user || authLoading) return null;

  const metricSeries = query.data ? buildTwinMetricTrend(query.data, metric) : null;
  const regionSeries =
    query.data && activeRegion
      ? buildTwinRegionTrend(query.data, activeRegion, regionMetric)
      : null;
  const regionUnit = regionMetric === "recoveryPct" ? "%" : "kg";

  return (
    <section
      aria-labelledby={headingId}
      className="mt-6 rounded-3xl border border-border bg-surface-2 p-4 sm:p-6"
    >
      <h2 id={headingId}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Activity aria-hidden="true" className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{copy.title}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {copy.description}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </h2>

      <div id={contentId} hidden={!expanded} className="mt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
        {query.isPending ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {copy.loading}
          </p>
        ) : query.isError ? (
          <div role="alert" className="mt-4">
            <p className="text-sm text-foreground">{copy.error}</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="mt-2 min-h-11 rounded-xl border border-border px-4 text-sm text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {copy.retry}
            </button>
          </div>
        ) : query.data ? (
          <div className="mt-4 space-y-5">
            {query.data.points.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.empty}</p>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{copy.global}</p>
                  <div className="flex flex-wrap gap-2">
                    {TWIN_TREND_METRIC_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={metric === key}
                        onClick={() => setMetric(key)}
                        className="min-h-11 rounded-xl border border-border px-3 text-xs text-foreground aria-pressed:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {copy.metrics[key]}
                      </button>
                    ))}
                  </div>
                </div>
                {metricSeries ? (
                  <SeriesCard
                    series={metricSeries}
                    label={copy.metrics[metric]}
                    unit={UNITS[metric]}
                    copy={copy}
                    locale={locale}
                  />
                ) : null}

                {activeRegion ? (
                  <div className="border-t border-border pt-5">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {copy.regional}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {regions.map((region) => (
                        <button
                          key={region}
                          type="button"
                          aria-pressed={activeRegion === region}
                          onClick={() => setSelectedRegion(region)}
                          className="min-h-11 rounded-xl border border-border px-3 text-xs text-foreground aria-pressed:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          {regionLabelFor(region, t)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        aria-pressed={regionMetric === "recoveryPct"}
                        onClick={() => setRegionMetric("recoveryPct")}
                        className="min-h-11 rounded-xl border border-border px-3 text-xs text-foreground aria-pressed:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {copy.recovery}
                      </button>
                      <button
                        type="button"
                        aria-pressed={regionMetric === "volumeKg"}
                        onClick={() => setRegionMetric("volumeKg")}
                        className="min-h-11 rounded-xl border border-border px-3 text-xs text-foreground aria-pressed:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {copy.volume}
                      </button>
                    </div>
                    {regionSeries ? (
                      <div className="mt-3">
                        <SeriesCard
                          series={regionSeries}
                          label={`${regionLabelFor(activeRegion, t)} · ${regionMetric === "recoveryPct" ? copy.recovery : copy.volume}`}
                          unit={regionUnit}
                          copy={copy}
                          locale={locale}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}

            {query.data.omittedCount > 0 ? (
              <p role="status" className="text-xs text-muted-foreground">
                {copy.incomplete} {query.data.omittedCount}
              </p>
            ) : null}
            {query.data.incompatibleCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {copy.incompatible} {query.data.incompatibleCount}
              </p>
            ) : null}
            {query.data.hasMore ? (
              <p className="text-xs text-muted-foreground">{copy.older}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
