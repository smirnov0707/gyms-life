import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";
import { getPersonalTimeline } from "@/lib/personal-timeline.functions";
import type { PersonalTimelineEntry } from "@/lib/personal-timeline.read";

const COPY = {
  lt: {
    title: "Dvynio įvykių istorija",
    description: "Treniruočių, savijautos įrašų ir sprendimų laiko juosta.",
    note:
      "Tai įvykių indeksas, ne ankstesnės kūno būsenos atkūrimas. Įvykio laikas nebūtinai sutampa su pratimo atlikimo ar matavimo laiku.",
    loading: "Įkeliama istorija…",
    error: "Nepavyko įkelti istorijos. Tai nereiškia, kad įrašų nėra.",
    empty:
      "Laiko juostoje dar nėra indeksuotų įvykių. Ankstesnės veiklos gali nebūti šiame indekse.",
    retry: "Bandyti dar kartą",
    refresh: "Atnaujinti istoriją",
    incomplete: "Dalies įrašų nepavyko patikrinti; jie nerodomi:",
    window: "Rodoma iki",
    windowEnd: "naujausių indeksuotų įvykių. Tai nėra visa veiklos istorija.",
    older: "Indekse yra ir senesnių įvykių, nepatenkančių į šią peržiūrą.",
    occurred: "Įvykio laikas pagal indeksą",
    recorded: "Įrašyta į laiko juostą",
    details: "Laikas ir duomenų kilmė",
    source: "Šaltinis",
    reference: "Šaltinio įrašo nuoroda",
    zone: "Šaltinio laiko juosta",
    utc: "Laikas rodomas UTC, nes šaltinio laiko juosta nežinoma arba nepalaikoma.",
    provenance: "Kilmė pagal šaltinį",
    quality: "Indekso duomenų kokybė",
    version: "Įrašo schemos versija",
    unknown: "Nežinoma",
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
    qualities: { unknown: "Nežinoma", low: "Žema", moderate: "Vidutinė", high: "Aukšta" },
  },
  en: {
    title: "Twin event history",
    description: "A timeline of training, check-in and decision records.",
    note:
      "This is an event index, not a reconstruction of a past body state. Event time is not necessarily when an exercise was performed or a measurement taken.",
    loading: "Loading history…",
    error: "History could not be loaded. This does not mean there are no records.",
    empty: "There are no indexed events yet. Earlier activity may not be present in this index.",
    retry: "Try again",
    refresh: "Refresh history",
    incomplete: "Some records could not be validated and are not shown:",
    window: "Showing up to",
    windowEnd: "latest indexed events. This is not the complete activity history.",
    older: "The index also contains older events outside this view.",
    occurred: "Indexed event time",
    recorded: "Written to the timeline",
    details: "Time and data provenance",
    source: "Source",
    reference: "Source record reference",
    zone: "Source time zone",
    utc: "Times shown in UTC because the source time zone is unknown or unsupported.",
    provenance: "Source provenance label",
    quality: "Index data quality",
    version: "Record schema version",
    unknown: "Unknown",
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
    qualities: { unknown: "Unknown", low: "Low", moderate: "Moderate", high: "High" },
  },
};

type TimelineCopy = (typeof COPY)[keyof typeof COPY];

function TimelineEntry({
  event,
  copy,
  locale,
}: {
  event: PersonalTimelineEntry;
  copy: TimelineCopy;
  locale: string;
}) {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };
  let usesUtc = event.timeZone === null;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: event.timeZone ?? "UTC" });
  } catch {
    // Browser and server time-zone databases can differ. Never crash the Twin.
    usesUtc = true;
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  }
  return (
    <li className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <h3 className="break-words text-sm font-semibold text-foreground">
        {event.eventType === null ? copy.unknown : copy.events[event.eventType]}
      </h3>
      <p className="mt-2 text-xs text-muted-foreground">
        {copy.occurred}: {" "}
        <time dateTime={event.occurredAt}>{formatter.format(new Date(event.occurredAt))}</time>
      </p>
      <details className="mt-2 text-xs">
        <summary className="min-h-11 cursor-pointer content-center rounded-lg text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          {copy.details}
        </summary>
        <dl className="grid min-w-0 gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{copy.recorded}</dt>
            <dd className="mt-1 text-foreground">
              <time dateTime={event.recordedAt}>{formatter.format(new Date(event.recordedAt))}</time>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{copy.zone}</dt>
            <dd className="mt-1 break-words text-foreground">{event.timeZone ?? copy.unknown}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{copy.provenance}</dt>
            <dd className="mt-1 text-foreground">
              {event.provenance === null ? copy.unknown : copy.origins[event.provenance]}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{copy.quality}</dt>
            <dd className="mt-1 text-foreground">
              {event.quality === null ? copy.unknown : copy.qualities[event.quality]}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{copy.source}</dt>
            <dd className="mt-1 break-all font-mono text-foreground">
              {event.sourceSystem} / {event.sourceTable ?? copy.unknown}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{copy.reference}</dt>
            <dd className="mt-1 break-all font-mono text-foreground">
              {event.sourceReference ?? copy.unknown}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{copy.version}</dt>
            <dd className="mt-1 break-all font-mono text-foreground">{event.schemaVersion}</dd>
          </div>
        </dl>
        {usesUtc && <p className="mt-3 text-muted-foreground">{copy.utc}</p>}
      </details>
    </li>
  );
}

/** Independent of the 3D canvas: expanding history never remounts the scene. */
export function TwinTimeline() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const headingId = useId();
  const copy = COPY[baseLang(lang)];
  const query = useQuery({
    queryKey: ["personal-timeline", user?.id],
    enabled: expanded && Boolean(user) && !authLoading,
    queryFn: () => getPersonalTimeline(),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
  });

  if (!user || authLoading) return null;

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
          <History aria-hidden="true" className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 break-words font-semibold">{copy.title}</span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      <div id={contentId} hidden={!expanded} className="mt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
        {expanded && query.isPending && (
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
              <p role="status" className="mb-4 text-sm text-foreground">
                {copy.incomplete} {query.data.omittedCount}
              </p>
            )}
            {query.data.events.length === 0 && query.data.omittedCount === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.empty}</p>
            ) : (
              <ol aria-label={copy.title} className="space-y-3">
                {query.data.events.map((event) => (
                  <TimelineEntry
                    key={event.id}
                    event={event}
                    copy={copy}
                    locale={formatLocale(lang)}
                  />
                ))}
              </ol>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {copy.window} {query.data.limit} {copy.windowEnd}
              {query.data.hasMore ? ` ${copy.older}` : ""}
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="mt-3 min-h-11 rounded-xl border border-border px-4 text-sm text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {query.isFetching ? copy.loading : copy.refresh}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
