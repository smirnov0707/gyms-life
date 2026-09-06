import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, History, Loader2, RotateCcw } from "lucide-react";
import { TwinSnapshotView, twinCopyFor } from "@/components/TwinView";
import { TwinChangeMap } from "@/components/twin/TwinChangeMap";
import { TwinEvidenceBridge } from "@/components/twin/TwinEvidenceBridge";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n, type TKey } from "@/lib/i18n";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { getTwinRewindHistory } from "@/lib/twin-rewind.functions";
import {
  compareTwinRewindPoints,
  type TwinRewindDelta,
  type TwinRewindMetrics,
  type TwinRewindPoint,
} from "@/lib/twin-rewind";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

const COPY = {
  lt: {
    title: "Twin Rewind",
    description: "Peržiūrėk tikras anksčiau išsaugotas skaitmeninio dvynio būsenas.",
    note: "Rewind nekuria tarpinių būsenų ir nenaudoja AI joms atspėti. Rodomi tik immutable Digital Athlete snapshot'ai. Palyginimai yra aritmetiniai slenkančių langų skirtumai, ne progreso ar priežasties įrodymai.",
    loading: "Įkeliamos išsaugotos būsenos…",
    error: "Nepavyko įkelti Twin istorijos. Tai nereiškia, kad istorijos nėra.",
    retry: "Bandyti dar kartą",
    empty: "Dar nėra suderinamų išsaugotų Twin būsenų.",
    open: "Atverti būseną",
    selected: "Peržiūrima istorinė būsena",
    incompatible:
      "Ši būsena sukurta kita modelio arba schemos versija, todėl ji neperinterpretuojama dabartiniu Twin.",
    omitted: "Dalies snapshot'ų nepavyko patikrinti ir jie nerodomi:",
    older: "Yra ir senesnių snapshot'ų už šio riboto sąrašo.",
    quality: "Duomenų būsena",
    evidence: "Įrodymų skaičius",
    comparison: "Skirtumas nuo ankstesnės suderinamos būsenos",
    comparisonUnavailable: "Nėra ankstesnės suderinamos būsenos saugiam palyginimui.",
    metrics: {
      sessionsLast7Days: "Treniruotės · 7 d.",
      totalVolumeLast28Days: "Krūvis · 28 d.",
      readiness: "Readiness",
      sleepHours: "Miegas · 7 d. vid.",
      weightKg: "Svoris",
      calories: "Kalorijos · registruotos d.",
      proteinG: "Baltymai · registruotos d.",
      evidenceCount: "Įrodymai",
    },
    qualityLevels: { cold_start: "Pradžia", building: "Kaupiami duomenys", informed: "Informuota" },
  },
  en: {
    title: "Twin Rewind",
    description: "Inspect real previously stored Digital Twin states.",
    note: "Rewind does not interpolate states or ask AI to guess them. Only immutable Digital Athlete snapshots are shown. Comparisons are arithmetic differences in rolling windows, not proof of progress or causation.",
    loading: "Loading stored states…",
    error: "Twin history could not be loaded. This does not mean no history exists.",
    retry: "Try again",
    empty: "There are no compatible stored Twin states yet.",
    open: "Open state",
    selected: "Viewing historical state",
    incompatible:
      "This state was created by another model or schema version, so the current Twin does not reinterpret it.",
    omitted: "Some snapshots could not be validated and are not shown:",
    older: "Older snapshots also exist outside this bounded list.",
    quality: "Data state",
    evidence: "Evidence count",
    comparison: "Difference from previous compatible state",
    comparisonUnavailable: "There is no previous compatible state for a safe comparison.",
    metrics: {
      sessionsLast7Days: "Sessions · 7d",
      totalVolumeLast28Days: "Volume · 28d",
      readiness: "Readiness",
      sleepHours: "Sleep · 7d avg",
      weightKg: "Weight",
      calories: "Calories · logged days",
      proteinG: "Protein · logged days",
      evidenceCount: "Evidence",
    },
    qualityLevels: { cold_start: "Cold start", building: "Building", informed: "Informed" },
  },
};

type MetricKey = keyof TwinRewindMetrics;
type Copy = (typeof COPY)[keyof typeof COPY];

const UNITS: Partial<Record<MetricKey, string>> = {
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

function formatTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function metricValue(value: number | null, unit?: string): string {
  if (value === null) return "—";
  const rendered = new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

function deltaValue(value: number | null, unit?: string): string {
  if (value === null) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${metricValue(value, unit)}`;
}

function Metrics({ metrics, copy }: { metrics: TwinRewindMetrics; copy: Copy }) {
  const entries = (Object.keys(copy.metrics) as MetricKey[]).filter(
    (key) => key !== "evidenceCount",
  );
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map((key) => (
        <div key={key} className="rounded-xl border border-border bg-surface px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {copy.metrics[key]}
          </dt>
          <dd className="mt-1 font-mono text-sm text-foreground">
            {metricValue(metrics[key], UNITS[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DeltaGrid({ delta, copy }: { delta: TwinRewindDelta; copy: Copy }) {
  const entries = (Object.keys(copy.metrics) as MetricKey[]).filter(
    (key) => key !== "evidenceCount",
  );
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {entries.map((key) => (
        <div key={key}>
          <dt className="text-[10px] text-muted-foreground">{copy.metrics[key]}</dt>
          <dd className="font-mono text-xs text-foreground">
            {deltaValue(delta[key], UNITS[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RewindPointButton({
  point,
  selected,
  copy,
  locale,
  onSelect,
}: {
  point: TwinRewindPoint;
  selected: boolean;
  copy: Copy;
  locale: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!point.compatible}
      aria-pressed={selected}
      onClick={onSelect}
      className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {formatTime(point.computedAt, locale)}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {point.calculationVersion}
        </span>
      </span>
      {point.compatible && point.metrics && point.dataQualityLevel ? (
        <span className="mt-1 block text-xs text-muted-foreground">
          {copy.quality}: {copy.qualityLevels[point.dataQualityLevel]} · {copy.evidence}:{" "}
          {point.metrics.evidenceCount}
        </span>
      ) : (
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {copy.incompatible}
        </span>
      )}
      {point.compatible && <span className="sr-only">{copy.open}</span>}
    </button>
  );
}

export function TwinRewind() {
  const { user, loading: authLoading } = useAuth();
  const { lang, t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const contentId = useId();
  const headingId = useId();
  const language = baseLang(lang);
  const copy = COPY[language];
  const locale = formatLocale(lang);
  const query = useQuery({
    queryKey: ["twin-rewind", user?.id],
    enabled: expanded && Boolean(user) && !authLoading,
    queryFn: () => getTwinRewindHistory(),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
  });

  if (!user || authLoading) return null;

  const selected = query.data?.points.find((point) => point.id === selectedId) ?? null;
  const selectedIndex = selected
    ? (query.data?.points.findIndex((point) => point.id === selected.id) ?? -1)
    : -1;
  const older =
    selectedIndex >= 0
      ? query.data?.points.slice(selectedIndex + 1).find((point) => point.compatible)
      : null;
  const comparison = compareTwinRewindPoints(older, selected);
  const compatibleCount = query.data?.points.filter((point) => point.compatible).length ?? 0;
  const label = (region: string) => regionLabelFor(region, t);

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
          <RotateCcw aria-hidden="true" className="size-5 shrink-0" />
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
        {query.isPending && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {copy.loading}
          </p>
        )}
        {query.isError ? (
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
          <div className="mt-4">
            {query.data.omittedCount > 0 && (
              <p role="status" className="mb-3 text-sm text-foreground">
                {copy.omitted} {query.data.omittedCount}
              </p>
            )}
            {compatibleCount === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.empty}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.points.map((point) => (
                <RewindPointButton
                  key={point.id}
                  point={point}
                  selected={selectedId === point.id}
                  copy={copy}
                  locale={locale}
                  onSelect={() => setSelectedId(point.id)}
                />
              ))}
            </div>
            {query.data.hasMore && (
              <p className="mt-3 text-xs text-muted-foreground">{copy.older}</p>
            )}
          </div>
        ) : null}

        {selected?.compatible && selected.twin && selected.metrics ? (
          <div className="mt-6 border-t border-border pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <History aria-hidden="true" className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">{copy.selected}</p>
              <time
                className="font-mono text-xs text-muted-foreground"
                dateTime={selected.computedAt}
              >
                {formatTime(selected.computedAt, locale)}
              </time>
            </div>
            <Metrics metrics={selected.metrics} copy={copy} />
            <div className="mt-4 rounded-xl border border-border bg-surface p-3">
              <p className="text-xs font-medium text-foreground">{copy.comparison}</p>
              {comparison ? (
                <DeltaGrid delta={comparison} copy={copy} />
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{copy.comparisonUnavailable}</p>
              )}
            </div>
            {older ? (
              <TwinChangeMap older={older} newer={selected} lang={lang} regionLabel={label} />
            ) : null}
            {older ? <TwinEvidenceBridge older={older} newer={selected} lang={lang} /> : null}
            <div className="mt-6">
              <TwinSnapshotView
                key={selected.id}
                data={selected.twin}
                copy={twinCopyFor(lang)}
                lang={lang}
                label={label}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
