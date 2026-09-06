import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Link2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, type Lang } from "@/lib/i18n";
import type { PersonalTimelineEntry } from "@/lib/personal-timeline.read";
import { getTwinEvidenceWindow } from "@/lib/twin-evidence-window.functions";
import type { TwinRewindPoint } from "@/lib/twin-rewind";

const COPY = {
  lt: {
    title: "Įrodymai tarp būsenų",
    description:
      "Timeline įrašai, kurių indeksuotas įvykio laikas patenka tarp šių Twin snapshot'ų.",
    note:
      "Tai laiko sutapimas, o ne priežastinis paaiškinimas. Timeline occurred_at nebūtinai yra tikslus pratimo atlikimo, matavimo ar fiziologinio pokyčio momentas.",
    loading: "Įkeliami intervalo įrodymai…",
    error: "Nepavyko įkelti intervalo įrodymų. Tai nereiškia, kad įvykių nebuvo.",
    retry: "Bandyti dar kartą",
    empty:
      "Šiame intervale nėra indeksuotų Timeline įvykių. Tai nereiškia, kad nieko neįvyko arba kad nėra neindeksuotų duomenų.",
    more: "Yra daugiau indeksuotų įvykių, nei rodoma šiame ribotame lange.",
    omitted: "Dalies įrašų nepavyko patikrinti ir jie nerodomi:",
    indexedAt: "Indeksuotas įvykio laikas",
    recordedAt: "Įrašyta į Timeline",
    source: "Šaltinis",
    provenance: "Kilmė",
    zone: "Šaltinio laiko juosta",
    unknown: "Nežinoma",
    counts: {
      workout_completed: "Treniruotės",
      checkin_recorded: "Check-in'ai",
      decision_recorded: "Sprendimai",
      unknown: "Kiti / nežinomi",
    },
    events: {
      workout_completed: "Užregistruotas treniruotės užbaigimas",
      checkin_recorded: "Užregistruota savijauta",
      decision_recorded: "Užregistruotas dienos sprendimas",
    },
    origins: {
      measured: "Išmatuota",
      device_reported: "Pateikta įrenginio",
      user_reported: "Pateikta vartotojo",
      calculated: "Apskaičiuota",
      inferred: "Numanoma",
      predicted: "Prognozuojama",
      simulated: "Sumodeliuota",
    },
  },
  en: {
    title: "Evidence between states",
    description:
      "Timeline records whose indexed event time falls between these two Twin snapshots.",
    note:
      "This is temporal overlap, not a causal explanation. Timeline occurred_at is not necessarily the exact time an exercise, measurement or physiological change happened.",
    loading: "Loading interval evidence…",
    error: "Interval evidence could not be loaded. This does not mean no events occurred.",
    retry: "Try again",
    empty:
      "There are no indexed Timeline events in this interval. This does not mean nothing happened or that no unindexed source data exists.",
    more: "More indexed events exist than are shown in this bounded window.",
    omitted: "Some records could not be validated and are not shown:",
    indexedAt: "Indexed event time",
    recordedAt: "Written to Timeline",
    source: "Source",
    provenance: "Provenance",
    zone: "Source time zone",
    unknown: "Unknown",
    counts: {
      workout_completed: "Workouts",
      checkin_recorded: "Check-ins",
      decision_recorded: "Decisions",
      unknown: "Other / unknown",
    },
    events: {
      workout_completed: "Workout completion recorded",
      checkin_recorded: "Check-in recorded",
      decision_recorded: "Daily decision recorded",
    },
    origins: {
      measured: "Measured",
      device_reported: "Device-reported",
      user_reported: "User-reported",
      calculated: "Calculated",
      inferred: "Inferred",
      predicted: "Predicted",
      simulated: "Simulated",
    },
  },
};

type Copy = (typeof COPY)[keyof typeof COPY];
type CountKey = keyof Copy["counts"];

function formatEventTime(event: PersonalTimelineEntry, locale: string, value: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: event.timeZone ?? "UTC",
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(value));
  }
}

function EventCard({
  event,
  copy,
  locale,
}: {
  event: PersonalTimelineEntry;
  copy: Copy;
  locale: string;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-sm font-medium text-foreground">
        {event.eventType === null ? copy.unknown : copy.events[event.eventType]}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {copy.indexedAt}:{" "}
        <time dateTime={event.occurredAt}>{formatEventTime(event, locale, event.occurredAt)}</time>
      </p>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="min-h-11 cursor-pointer content-center rounded-lg text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          {copy.source}
        </summary>
        <dl className="grid gap-2 border-t border-border pt-2 sm:grid-cols-2">
          <div>
            <dt>{copy.provenance}</dt>
            <dd className="mt-0.5 text-foreground">
              {event.provenance === null ? copy.unknown : copy.origins[event.provenance]}
            </dd>
          </div>
          <div>
            <dt>{copy.zone}</dt>
            <dd className="mt-0.5 break-words text-foreground">{event.timeZone ?? copy.unknown}</dd>
          </div>
          <div>
            <dt>{copy.recordedAt}</dt>
            <dd className="mt-0.5 text-foreground">
              <time dateTime={event.recordedAt}>
                {formatEventTime(event, locale, event.recordedAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt>{copy.source}</dt>
            <dd className="mt-0.5 break-all font-mono text-foreground">
              {event.sourceSystem} / {event.sourceTable ?? copy.unknown}
            </dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

export function TwinEvidenceBridge({
  older,
  newer,
  lang,
}: {
  older: TwinRewindPoint;
  newer: TwinRewindPoint;
  lang: Lang;
}) {
  const { user } = useAuth();
  const fetchEvidence = useServerFn(getTwinEvidenceWindow);
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const copy = COPY[baseLang(lang)];
  const locale = formatLocale(lang);
  const query = useQuery({
    queryKey: ["twin-evidence-window", user?.id, older.id, newer.id],
    enabled: expanded && Boolean(user),
    queryFn: () =>
      fetchEvidence({
        data: { olderAt: older.computedAt, newerAt: newer.computedAt },
      }),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
  });

  if (!user) return null;

  const counts = query.data?.events.reduce<Record<CountKey, number>>(
    (result, event) => {
      const key: CountKey = event.eventType ?? "unknown";
      result[key] += 1;
      return result;
    },
    { workout_completed: 0, checkin_recorded: 0, decision_recorded: 0, unknown: 0 },
  );

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Link2 aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{copy.title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {copy.description}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted-foreground ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <div id={contentId} hidden={!expanded} className="mt-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
        {query.isPending ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {copy.loading}
          </p>
        ) : null}
        {query.isError ? (
          <div role="alert" className="mt-3">
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
          <div className="mt-3">
            {counts ? (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(counts) as CountKey[])
                  .filter((key) => counts[key] > 0)
                  .map((key) => (
                    <span
                      key={key}
                      className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-foreground"
                    >
                      {copy.counts[key]}: {counts[key]}
                    </span>
                  ))}
              </div>
            ) : null}
            {query.data.omittedCount > 0 ? (
              <p role="status" className="mt-3 text-xs text-foreground">
                {copy.omitted} {query.data.omittedCount}
              </p>
            ) : null}
            {query.data.events.length === 0 && query.data.omittedCount === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{copy.empty}</p>
            ) : (
              <ol className="mt-3 space-y-2" aria-label={copy.title}>
                {query.data.events.map((event) => (
                  <EventCard key={event.id} event={event} copy={copy} locale={locale} />
                ))}
              </ol>
            )}
            {query.data.hasMore ? (
              <p className="mt-3 text-xs text-muted-foreground">{copy.more}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
