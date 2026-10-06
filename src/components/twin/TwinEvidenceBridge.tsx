import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  Link2,
  Activity,
  Dumbbell,
  ClipboardCheck,
  CircleHelp,
  Route,
} from "lucide-react";
import { TwinLedgerState } from "./TwinLedgerState";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, type Lang } from "@/lib/i18n";
import type { PersonalTimelineEntry } from "@/lib/personal-timeline.read";
import { getTwinEvidenceWindow } from "@/lib/twin-evidence-window.functions";
import { TwinEvidenceWindowInputSchema } from "@/lib/twin-evidence-window";
import type { TwinRewindPoint } from "@/lib/twin-rewind";
import "./TwinComparison.css";

const COPY = {
  lt: {
    title: "Įvykiai tarp būsenų",
    description: "Užregistruotos treniruotės, savijauta ir sprendimai pasirinktame intervale.",
    note: "Įvykiai patenka tarp dviejų būsenų pagal istorijoje nurodytą laiką: po ankstesnės būsenos ir iki pasirinktos būsenos imtinai. Šis laikas gali skirtis nuo tikrojo veiksmo ar matavimo momento. Sutapimas laike neįrodo, kad įvykis sukėlė rodiklių pokytį.",
    method: "Kaip susiję įvykiai ir būsenos?",
    loading: "Įkeliami intervalo įvykiai…",
    error: "Nepavyko įkelti intervalo įvykių.",
    errorHelp: "Tai nereiškia, kad įvykių nebuvo. Pabandyk dar kartą.",
    empty: "Šiame intervale įrašų nerasta.",
    emptyHelp: "Istorijoje gali trūkti dar neįtrauktų įvykių. Tai nereiškia, kad nieko neįvyko.",
    excluded: "Nė vieno įrašo nepavyko patvirtinti.",
    excludedHelp: "Gauti įrašai netinkami šiam intervalui arba jų nepavyko patikrinti.",
    invalid: "Šiam palyginimui laiko intervalo nėra.",
    invalidHelp: "Ankstesnė būsena turi būti išsaugota anksčiau nei pasirinkta būsena.",
    more: "Rodoma tik dalis intervalo įrašų.",
    omitted: "Nepatikrinti arba intervalui nepriskirti įrašai:",
    indexedAt: "Įvykio laikas įraše",
    recordedAt: "Įtraukta į istoriją",
    source: "Įrašo kilmė",
    sourceSystem: "Šaltinis",
    provenance: "Duomenų kilmė",
    zone: "Laiko juosta",
    unknown: "Nežinoma",
    unknownEvent: "Kitas istorijos įvykis",
    utc: "Laikas rodomas UTC; šaltinio laiko juosta nežinoma.",
    counts: {
      workout_completed: "Treniruotės",
      checkin_recorded: "Savijauta",
      decision_recorded: "Sprendimai",
      endurance_adaptation: "Bėgimo adaptacijos",
      endurance_adaptation_observed: "Po adaptacijos",
      unknown: "Kiti įvykiai",
    },
    events: {
      workout_completed: "Treniruotė užbaigta",
      checkin_recorded: "Savijauta užregistruota",
      decision_recorded: "Dienos sprendimas išsaugotas",
      endurance_adaptation: "Bėgimo planas adaptuotas",
      endurance_adaptation_observed: "Stebėti signalai po adaptacijos",
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
    title: "Events between states",
    description: "Recorded workouts, check-ins and decisions within the selected interval.",
    note: "Events belong to the interval by their history timestamp: after the previous state and up to and including the selected state. This may differ from when an action or measurement actually happened. Overlap in time does not prove that an event caused a change in your readings.",
    method: "How do events relate to these states?",
    loading: "Loading interval events…",
    error: "Interval events could not be loaded.",
    errorHelp: "This does not mean no events occurred. Please try again.",
    empty: "No records were found in this interval.",
    emptyHelp:
      "Some events may not have been added to history yet. This does not mean nothing happened.",
    excluded: "None of the records could be confirmed.",
    excludedHelp: "The returned records fall outside this interval or could not be verified.",
    invalid: "This comparison has no time interval.",
    invalidHelp: "The previous state must have been saved before the selected state.",
    more: "Only part of the interval's records is shown.",
    omitted: "Unverified or out-of-interval records:",
    indexedAt: "Event time in history",
    recordedAt: "Added to history",
    source: "Record source",
    sourceSystem: "Source",
    provenance: "Data origin",
    zone: "Time zone",
    unknown: "Unknown",
    unknownEvent: "Other history event",
    utc: "Time is shown in UTC; the source time zone is unknown.",
    counts: {
      workout_completed: "Workouts",
      checkin_recorded: "Check-ins",
      decision_recorded: "Decisions",
      endurance_adaptation: "Run adaptations",
      endurance_adaptation_observed: "Post-adaptation",
      unknown: "Other events",
    },
    events: {
      workout_completed: "Workout completed",
      checkin_recorded: "Check-in recorded",
      decision_recorded: "Daily decision saved",
      endurance_adaptation: "Race plan adapted",
      endurance_adaptation_observed: "Post-adaptation signals observed",
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
const COUNT_KEYS = [
  "workout_completed",
  "checkin_recorded",
  "decision_recorded",
  "endurance_adaptation",
  "endurance_adaptation_observed",
  "unknown",
] as const satisfies readonly CountKey[];
const ICONS = {
  workout_completed: Dumbbell,
  checkin_recorded: Activity,
  decision_recorded: ClipboardCheck,
  endurance_adaptation: Route,
  endurance_adaptation_observed: Activity,
  unknown: CircleHelp,
};
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
  const Icon = ICONS[event.eventType ?? "unknown"];
  return (
    <li className="fl-evidence-event" data-event={event.eventType ?? "unknown"}>
      <Icon aria-hidden="true" />
      <div>
        <h4>{event.eventType === null ? copy.unknownEvent : copy.events[event.eventType]}</h4>
        <p className="fl-evidence-time">
          <span>{copy.indexedAt}</span>
          <time dateTime={event.occurredAt}>
            {formatEventTime(event, locale, event.occurredAt)}
          </time>
        </p>
        <p className="fl-evidence-origin">
          {event.provenance === null ? copy.unknown : copy.origins[event.provenance]}
        </p>
        {event.timeZone === null ? <p className="fl-comparison-note">{copy.utc}</p> : null}
        <details className="fl-evidence-source">
          <summary>
            {copy.source}
            <ChevronDown aria-hidden="true" />
          </summary>
          <dl>
            <div>
              <dt>{copy.provenance}</dt>
              <dd>{event.provenance === null ? copy.unknown : copy.origins[event.provenance]}</dd>
            </div>
            <div>
              <dt>{copy.zone}</dt>
              <dd>{event.timeZone ?? copy.unknown}</dd>
            </div>
            <div>
              <dt>{copy.recordedAt}</dt>
              <dd>
                <time dateTime={event.recordedAt}>
                  {formatEventTime(event, locale, event.recordedAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt>{copy.sourceSystem}</dt>
              <dd>
                {event.sourceSystem} / {event.sourceTable ?? copy.unknown}
              </dd>
            </div>
          </dl>
        </details>
      </div>
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
  const { user, loading: authLoading } = useAuth();
  const fetchEvidence = useServerFn(getTwinEvidenceWindow);
  const [expanded, setExpanded] = useState(false);
  const id = useId(),
    copy = COPY[baseLang(lang)],
    locale = formatLocale(lang);
  const interval = TwinEvidenceWindowInputSchema.safeParse({
    olderAt: older.computedAt,
    newerAt: newer.computedAt,
  });
  const query = useQuery({
    queryKey: [
      "twin-evidence-window",
      user?.id,
      older.id,
      newer.id,
      older.computedAt,
      newer.computedAt,
    ],
    enabled: expanded && Boolean(user) && !authLoading && interval.success,
    queryFn: () =>
      fetchEvidence({ data: { olderAt: older.computedAt, newerAt: newer.computedAt } }),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
  });
  if (!user || authLoading) return null;
  const data = query.isSuccess && interval.success ? query.data : undefined;
  const counts = data?.events.reduce<Record<CountKey, number>>(
    (result, event) => {
      result[event.eventType ?? "unknown"] += 1;
      return result;
    },
    {
      workout_completed: 0,
      checkin_recorded: 0,
      decision_recorded: 0,
      endurance_adaptation: 0,
      endurance_adaptation_observed: 0,
      unknown: 0,
    },
  );
  return (
    <section className="fl-evidence-bridge" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>
        <button
          className="fl-evidence-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-content`}
          onClick={() => setExpanded((value) => !value)}
        >
          <Link2 aria-hidden="true" />
          <span>
            {copy.title}
            <small>{copy.description}</small>
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
      </h3>
      <div id={`${id}-content`} hidden={!expanded} className="fl-evidence-content">
        {!interval.success ? (
          <TwinLedgerState state="empty" title={copy.invalid} description={copy.invalidHelp} />
        ) : query.isPending ? (
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
            {data.events.length === 0 ? (
              <TwinLedgerState
                state="empty"
                title={data.omittedCount > 0 ? copy.excluded : copy.empty}
                description={data.omittedCount > 0 ? copy.excludedHelp : copy.emptyHelp}
              />
            ) : (
              <>
                <dl className="fl-evidence-counts">
                  {COUNT_KEYS.filter((key) => counts && counts[key] > 0).map((key) => (
                    <div key={key}>
                      <dt>{copy.counts[key]}</dt>
                      <dd>{new Intl.NumberFormat(locale).format(counts?.[key] ?? 0)}</dd>
                    </div>
                  ))}
                </dl>
                <ol className="fl-evidence-events" aria-label={copy.title}>
                  {data.events.map((event) => (
                    <EventCard key={event.id} event={event} copy={copy} locale={locale} />
                  ))}
                </ol>
              </>
            )}
            {data.omittedCount > 0 || data.hasMore ? (
              <aside className="fl-evidence-coverage">
                {data.omittedCount > 0 ? (
                  <p>
                    {copy.omitted} {data.omittedCount}
                  </p>
                ) : null}
                {data.hasMore ? <p>{copy.more}</p> : null}
              </aside>
            ) : null}
          </>
        ) : null}
        <details className="fl-comparison-method">
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
