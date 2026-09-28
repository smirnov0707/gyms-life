import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, History, Layers3, RotateCcw } from "lucide-react";
import { TwinSnapshotView, twinCopyFor } from "@/components/TwinView";
import { TwinChangeMap } from "./TwinChangeMap";
import { TwinEvidenceBridge } from "./TwinEvidenceBridge";
import { TwinLedgerState } from "./TwinLedgerState";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { getTwinRewindHistory } from "@/lib/twin-rewind.functions";
import {
  compareTwinRewindPoints,
  type TwinRewindMetrics,
  type TwinRewindPoint,
} from "@/lib/twin-rewind";
import "./TwinRewind.css";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);
const METRICS = [
  "readiness",
  "sleepHours",
  "sessionsLast7Days",
  "totalVolumeLast28Days",
  "weightKg",
  "calories",
  "proteinG",
  "evidenceCount",
] as const satisfies readonly (keyof TwinRewindMetrics)[];
const COPY = {
  lt: {
    eyebrow: "Twin istorija",
    title: "Sugrįžk į savo istoriją.",
    description:
      "Pasirink išsaugotą būseną. Pamatyk to meto rodiklius ir tai, kas pasikeitė nuo ankstesnio įrašo.",
    note: "Rodomos tik išsaugotos būsenos, be spėjamų tarpinių vaizdų. Skirtumai apibūdina skirtingus slenkančius laikotarpius; jie neįrodo progreso ar jo priežasties.",
    loading: "Įkeliamos išsaugotos būsenos…",
    error: "Nepavyko įkelti Twin istorijos.",
    errorHelp: "Šiuo metu negalime patikrinti būsenų. Pabandyk dar kartą.",
    empty: "Dar nėra peržiūrai tinkamų būsenų.",
    emptyHelp: "Istorija atsiras išsaugojus su dabartiniu Twin suderinamą būseną.",
    choose: "Pasirink datą",
    chooseHelp: "Atverk įrašą kairėje arba aukščiau ir apžiūrėk išsaugotus rodiklius.",
    history: "Išsaugotos būsenos",
    available: "Galima peržiūrėti",
    latest: "Naujausia",
    selected: "Pasirinkta būsena",
    incompatible: "Ankstesnė versija · peržiūra negalima",
    omitted: "Nepavyko patikrinti įrašų:",
    incompatibleCount: "Su dabartiniu Twin nesuderinami įrašai:",
    older: "Yra ir senesnių įrašų už šio įkelto sąrašo.",
    evidence: "Įrašų",
    previous: "Ankstesnė",
    difference: "Skirtumas",
    points: "p.",
    comparison: "Palyginimas su ankstesne suderinama būsena",
    comparisonUnavailable: "Šiame sąraše nėra ankstesnės suderinamos būsenos palyginimui.",
    unknown: "— reiškia, kad rodiklis nežinomas arba jo negalima palyginti.",
    body: "Atverti šios būsenos Twin",
    regions: "Palyginti raumenų grupes",
    method: "Kaip skaityti istoriją",
    source: "Įrašo kilmė ir tikslūs rodikliai",
    zone: "Laiko juosta",
    window: "Šaltinių laikotarpis",
    version: "Skaičiavimo versija",
    schema: "Duomenų versija",
    unavailable: "Nenurodyta",
    metrics: {
      sessionsLast7Days: "Treniruotės · 7 d.",
      totalVolumeLast28Days: "Krūvis · 28 d.",
      readiness: "Pasirengimas",
      sleepHours: "Miegas · 7 d. vid.",
      weightKg: "Svoris",
      calories: "Kalorijos · registruotos d.",
      proteinG: "Baltymai · registruotos d.",
      evidenceCount: "Įrodymų įrašai",
    },
    qualityLevels: {
      cold_start: "Pradiniai duomenys",
      building: "Duomenys kaupiami",
      informed: "Duomenimis pagrįsta",
    },
  },
  en: {
    eyebrow: "Twin history",
    title: "Return to your story.",
    description:
      "Choose a saved state. See your readings at that moment and what changed from the previous record.",
    note: "Only saved states are shown, without guessed frames in between. Differences describe rolling windows; they do not prove progress or explain its cause.",
    loading: "Loading saved states…",
    error: "Twin history could not be loaded.",
    errorHelp: "We cannot verify these states right now. Please try again.",
    empty: "No states are available to review yet.",
    emptyHelp: "History will appear when a state compatible with the current Twin has been saved.",
    choose: "Choose a date",
    chooseHelp: "Open a record on the left or above to explore its saved readings.",
    history: "Saved states",
    available: "Available to review",
    latest: "Latest",
    selected: "Selected state",
    incompatible: "Earlier version · preview unavailable",
    omitted: "Records that could not be verified:",
    incompatibleCount: "Records incompatible with the current Twin:",
    older: "Older records exist beyond this loaded list.",
    evidence: "Records",
    previous: "Previous",
    difference: "Difference",
    points: "pt",
    comparison: "Compared with the previous compatible state",
    comparisonUnavailable: "This list contains no earlier compatible state to compare.",
    unknown: "— means a reading is unknown or cannot be compared.",
    body: "Open this state's Twin",
    regions: "Compare muscle groups",
    method: "How to read this history",
    source: "Record source and exact readings",
    zone: "Time zone",
    window: "Source window",
    version: "Calculation version",
    schema: "Data version",
    unavailable: "Not recorded",
    metrics: {
      sessionsLast7Days: "Sessions · 7d",
      totalVolumeLast28Days: "Volume · 28d",
      readiness: "Readiness",
      sleepHours: "Sleep · 7d avg",
      weightKg: "Weight",
      calories: "Calories · logged days",
      proteinG: "Protein · logged days",
      evidenceCount: "Evidence records",
    },
    qualityLevels: {
      cold_start: "Initial data",
      building: "Building evidence",
      informed: "Evidence informed",
    },
  },
};
type Copy = (typeof COPY)[keyof typeof COPY];
type MetricKey = keyof TwinRewindMetrics;
const UNITS: Partial<Record<MetricKey, string>> = {
  totalVolumeLast28Days: "kg",
  readiness: "/100",
  sleepHours: "h",
  weightKg: "kg",
  calories: "kcal",
  proteinG: "g",
};
function regionLabelFor(region: string, t: (key: TKey) => string) {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}
function formatTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}
function metricValue(
  value: number | null,
  key: MetricKey,
  locale: string,
  copy: Copy,
  difference = false,
  exact = false,
) {
  if (value === null) return "—";
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: exact ? 20 : 1,
    ...(difference ? { signDisplay: "exceptZero" as const } : {}),
  }).format(value);
  const unit = difference && key === "readiness" ? copy.points : UNITS[key];
  return unit ? `${number} ${unit}` : number;
}

function SavedState({
  selected,
  older,
  copy,
  locale,
  timeZone,
}: {
  selected: TwinRewindPoint;
  older: TwinRewindPoint | undefined;
  copy: Copy;
  locale: string;
  timeZone: string;
}) {
  const { lang, t } = useI18n();
  const [bodyOpen, setBodyOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const comparison = compareTwinRewindPoints(older, selected);
  const label = (region: string) => regionLabelFor(region, t);
  const metrics = selected.metrics;
  if (!metrics || !selected.twin) return null;
  return (
    <article className="fl-rewind-selected">
      <header className="fl-rewind-selected-heading">
        <p>
          <History aria-hidden="true" />
          {copy.selected}
        </p>
        <h3>
          <time dateTime={selected.computedAt}>
            {formatTime(selected.computedAt, locale, timeZone)}
          </time>
        </h3>
        {selected.dataQualityLevel ? (
          <span>{copy.qualityLevels[selected.dataQualityLevel]}</span>
        ) : null}
      </header>
      <div className="fl-rewind-comparison">
        <p>{comparison && older ? copy.comparison : copy.comparisonUnavailable}</p>
        {comparison && older ? (
          <time dateTime={older.computedAt}>{formatTime(older.computedAt, locale, timeZone)}</time>
        ) : null}
      </div>
      <dl className="fl-rewind-metrics">
        {METRICS.map((key) => (
          <div key={key} data-metric={key}>
            <dt>{copy.metrics[key]}</dt>
            <dd className="fl-rewind-value">{metricValue(metrics[key], key, locale, copy)}</dd>
            {comparison && older?.metrics ? (
              <dd className="fl-rewind-delta">
                <span>
                  {copy.previous}: {metricValue(older.metrics[key], key, locale, copy)}
                </span>
                <span>
                  {copy.difference}:{" "}
                  <strong>{metricValue(comparison[key], key, locale, copy, true)}</strong>
                </span>
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
      <p className="fl-rewind-unknown">{copy.unknown}</p>
      <details
        className="fl-rewind-disclosure"
        onToggle={(event) => setBodyOpen(event.currentTarget.open)}
      >
        <summary>
          <span>
            <Layers3 aria-hidden="true" />
            {copy.body}
          </span>
          <ChevronDown aria-hidden="true" />
        </summary>
        {bodyOpen ? (
          <div className="fl-rewind-body">
            <TwinSnapshotView
              data={selected.twin}
              copy={twinCopyFor(lang)}
              lang={lang}
              label={label}
            />
          </div>
        ) : null}
      </details>
      {comparison && older ? (
        <>
          <details
            className="fl-rewind-disclosure"
            onToggle={(event) => setRegionsOpen(event.currentTarget.open)}
          >
            <summary>
              {copy.regions}
              <ChevronDown aria-hidden="true" />
            </summary>
            {regionsOpen ? (
              <TwinChangeMap older={older} newer={selected} lang={lang} regionLabel={label} />
            ) : null}
          </details>
          <TwinEvidenceBridge older={older} newer={selected} lang={lang} />
        </>
      ) : null}
      <details className="fl-rewind-disclosure fl-rewind-source">
        <summary>
          {copy.source}
          <ChevronDown aria-hidden="true" />
        </summary>
        <dl>
          <div>
            <dt>{copy.zone}</dt>
            <dd>{timeZone}</dd>
          </div>
          <div>
            <dt>{copy.window}</dt>
            <dd>
              {selected.sourceWindowStart
                ? formatTime(selected.sourceWindowStart, locale, timeZone)
                : copy.unavailable}{" "}
              —{" "}
              {selected.sourceWindowEnd
                ? formatTime(selected.sourceWindowEnd, locale, timeZone)
                : copy.unavailable}
            </dd>
          </div>
          <div>
            <dt>{copy.version}</dt>
            <dd>{selected.calculationVersion}</dd>
          </div>
          <div>
            <dt>{copy.schema}</dt>
            <dd>{selected.schemaVersion}</dd>
          </div>
          {METRICS.map((key) => (
            <div key={key}>
              <dt>{copy.metrics[key]}</dt>
              <dd>{metricValue(metrics[key], key, locale, copy, false, true)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </article>
  );
}

export function TwinRewind() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const id = useId();
  const copy = COPY[baseLang(lang)],
    locale = formatLocale(lang),
    timeZone = browserTimeZone();
  const query = useQuery({
    queryKey: ["twin-rewind", user?.id],
    enabled: expanded && Boolean(user) && !authLoading,
    queryFn: () => getTwinRewindHistory(),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
  });
  if (!user || authLoading) return null;
  // A failed refresh must also withdraw the chosen state's metrics and renderers.
  const data = query.isSuccess ? query.data : undefined;
  const selected = data?.points.find((point) => point.compatible && point.id === selectedId);
  const selectedIndex = selected && data ? data.points.indexOf(selected) : -1;
  const older =
    selectedIndex >= 0
      ? data?.points.slice(selectedIndex + 1).find((point) => point.compatible)
      : undefined;
  const compatibleCount = data?.points.filter((point) => point.compatible).length ?? 0;
  return (
    <section className="fl-rewind" aria-labelledby={`${id}-title`}>
      <header className="fl-rewind-heading">
        <p className="fl-ledger-eyebrow">
          <RotateCcw aria-hidden="true" />
          {copy.eyebrow}
        </p>
        <h2 id={`${id}-title`}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`${id}-content`}
            onClick={() => setExpanded((value) => !value)}
          >
            {copy.title}
            <ChevronDown aria-hidden="true" />
          </button>
        </h2>
        <p>{copy.description}</p>
      </header>
      <div id={`${id}-content`} className="fl-rewind-content" hidden={!expanded}>
        {query.isPending ? (
          <TwinLedgerState state="loading" title={copy.loading} />
        ) : query.isError ? (
          <TwinLedgerState
            state="error"
            title={copy.error}
            description={copy.errorHelp}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : data ? (
          <>
            {compatibleCount === 0 ? (
              <TwinLedgerState state="empty" title={copy.empty} description={copy.emptyHelp} />
            ) : null}
            {data.points.length > 0 ? (
              <div className="fl-rewind-workspace">
                <nav className="fl-rewind-history" aria-label={copy.history}>
                  <div className="fl-rewind-history-heading">
                    <h3>{copy.history}</h3>
                    <p>
                      {copy.available}: <strong>{compatibleCount}</strong>
                    </p>
                  </div>
                  <ol>
                    {data.points.map((point, index) => (
                      <li key={point.id}>
                        <button
                          type="button"
                          disabled={!point.compatible}
                          aria-pressed={selected?.id === point.id}
                          onClick={() => setSelectedId(point.id)}
                        >
                          <span className="fl-rewind-point-index" aria-hidden="true">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="fl-rewind-point-copy">
                            <time dateTime={point.computedAt}>
                              {formatTime(point.computedAt, locale, timeZone)}
                            </time>
                            {point.compatible && point.metrics ? (
                              <small>
                                {copy.evidence}:{" "}
                                {new Intl.NumberFormat(locale).format(point.metrics.evidenceCount)}
                                {index === 0 ? ` · ${copy.latest}` : ""}
                              </small>
                            ) : (
                              <small>{copy.incompatible}</small>
                            )}
                          </span>
                          <ArrowUpRight aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ol>
                  <p className="fl-rewind-zone">
                    {copy.zone}: {timeZone}
                  </p>
                </nav>
                {selected ? (
                  <SavedState
                    key={`${user.id}:${selected.id}`}
                    selected={selected}
                    older={older}
                    copy={copy}
                    locale={locale}
                    timeZone={timeZone}
                  />
                ) : compatibleCount > 0 ? (
                  <div className="fl-rewind-prompt">
                    <History aria-hidden="true" />
                    <h3>{copy.choose}</h3>
                    <p>{copy.chooseHelp}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {data.omittedCount > 0 || data.incompatibleCount > 0 || data.hasMore ? (
              <aside className="fl-rewind-coverage">
                {data.omittedCount > 0 ? (
                  <p>
                    {copy.omitted} {data.omittedCount}
                  </p>
                ) : null}
                {data.incompatibleCount > 0 ? (
                  <p>
                    {copy.incompatibleCount} {data.incompatibleCount}
                  </p>
                ) : null}
                {data.hasMore ? <p>{copy.older}</p> : null}
              </aside>
            ) : null}
          </>
        ) : null}
        <details className="fl-rewind-disclosure fl-rewind-method">
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
