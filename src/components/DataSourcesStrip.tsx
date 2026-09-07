import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PencilLine, Watch } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLiveSignals } from "@/lib/live-signals.functions";
import type { LiveSignal, LiveSignalId } from "@/lib/live-signals.engine";

/**
 * Where the athlete's numbers come from, stated as plainly as the rail states
 * the numbers themselves.
 *
 * Two kinds of source and three states each: it has delivered, it has never
 * delivered, or we could not check. There is deliberately no "all systems
 * operational" here — that is a claim about machinery nobody looked at, and
 * the only honest version of it is the list of what has actually arrived.
 *
 * It reads the signals the rail already loaded, so this costs no extra query
 * and — importantly — never touches the ingest key.
 */

const DEVICE_SIGNALS: LiveSignalId[] = ["sleep", "hrv", "restingHr", "steps", "activeKcal"];
const MANUAL_SIGNALS: LiveSignalId[] = ["weight", "bodyFat"];

type SourceState = "delivering" | "silent" | "unknown";

function stateOf(signals: LiveSignal[], ids: LiveSignalId[]): SourceState {
  const mine = signals.filter((signal) => ids.includes(signal.id));
  if (mine.some((signal) => signal.state === "measured" || signal.state === "stale")) {
    return "delivering";
  }
  // Unknown wins over silent: one source we could not read is not a source
  // with nothing in it, and only one of those is worth acting on.
  if (mine.some((signal) => signal.state === "unreadable")) return "unknown";
  return mine.length ? "silent" : "unknown";
}

/** The most recent day any source produced, or null when none ever has. */
function newestReading(signals: LiveSignal[]): string | null {
  return signals.reduce<string | null>(
    (newest, signal) =>
      signal.recordedOn && (!newest || signal.recordedOn > newest) ? signal.recordedOn : newest,
    null,
  );
}

const DOT: Record<SourceState, string> = {
  delivering: "bg-primary",
  silent: "bg-muted-foreground/40",
  unknown: "bg-accent",
};

function Source({
  icon: Icon,
  label,
  state,
}: {
  icon: typeof Watch;
  label: string;
  state: SourceState;
}) {
  const { t } = useI18n();
  const word =
    state === "delivering" ? "ds.delivering" : state === "silent" ? "ds.silent" : "ds.unknown";
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-2 px-2.5 py-1.5">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-[11px] text-foreground">{label}</span>
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${DOT[state]}`} />
      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {t(word)}
      </span>
    </span>
  );
}

export function DataSourcesStrip() {
  const { t } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  const { data } = useQuery({
    queryKey: ["live-signals", user?.id, timeZone],
    queryFn: () => getLiveSignals({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const signals = data ?? [];
  const newest = newestReading(signals);

  return (
    <section
      aria-label={t("ds.title")}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-3xl border border-border bg-surface px-3 py-2.5"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {t("ds.title")}
      </span>
      <Source icon={Watch} label={t("ds.device")} state={stateOf(signals, DEVICE_SIGNALS)} />
      <Source icon={PencilLine} label={t("ds.manual")} state={stateOf(signals, MANUAL_SIGNALS)} />
      <span className="ml-auto text-[11px] text-muted-foreground">
        {newest ? `${t("ds.lastReading")}: ${newest}` : t("ds.noReadings")}
      </span>
      <Link
        to="/me"
        className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {t("hs.connect")}
      </Link>
    </section>
  );
}
