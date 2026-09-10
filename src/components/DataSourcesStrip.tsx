import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PencilLine, Watch, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { signalRefreshOutcome, type SignalRefreshOutcome } from "@/lib/live-signal-refresh";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLiveSignals } from "@/lib/live-signals.functions";
import {
  DEVICE_SIGNALS,
  MANUAL_SIGNALS,
  anythingReadable,
  newestReading,
  sourceState,
  type SourceState,
} from "@/lib/data-sources.engine";

/**
 * Where the athlete's numbers come from, stated as plainly as the rail states
 * the numbers themselves.
 *
 * Two kinds of source and four states each: it is sending, it has gone quiet,
 * it has never sent anything, or we could not check. There is deliberately no
 * "all systems operational" here — that is a claim about machinery nobody
 * looked at, and the only honest version of it is the list of what has
 * actually arrived.
 *
 * It reads the signals the rail already loaded, so this costs no extra query
 * and — importantly — never touches the ingest key. Which state a source is in
 * is decided in `data-sources.engine`, where it can be tested.
 */

const DOT: Record<SourceState, string> = {
  delivering: "bg-primary",
  quiet: "bg-amber-400/70",
  silent: "bg-muted-foreground/40",
  unknown: "bg-accent",
};

const WORD: Record<SourceState, TKey> = {
  delivering: "ds.delivering",
  quiet: "ds.quiet",
  silent: "ds.silent",
  unknown: "ds.unknown",
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
  const word = WORD[state];
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
  const { t, lang } = useI18n();
  const english = baseLang(lang) === "en";
  const lock = useRef(false);
  const [refresh, setRefresh] = useState<{
    userId: string;
    outcome: SignalRefreshOutcome | "refreshing";
  } | null>(null);
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  const query = useQuery({
    queryKey: ["live-signals", user?.id, timeZone],
    queryFn: () => getLiveSignals({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const signals = query.isError ? [] : (query.data ?? []);
  const checking = query.isPending || query.isError;
  const newest = newestReading(signals);
  const readable = anythingReadable(signals);
  const outcome = refresh?.userId === user?.id ? refresh?.outcome : null;
  const messages = english
    ? {
        refreshing: "Refreshing received records…",
        refreshed: "Received records refreshed.",
        stale: "Records checked. Available readings are still old.",
        empty: "Records checked. No readings have arrived yet.",
        partial: "Only some sources could be read. Refresh is incomplete.",
        unreadable: "Records could not be refreshed. No successful sync is claimed.",
      }
    : {
        refreshing: "Atnaujinami gauti įrašai…",
        refreshed: "Gauti įrašai atnaujinti.",
        stale: "Įrašai patikrinti. Turimi matavimai vis dar seni.",
        empty: "Įrašai patikrinti. Matavimų dar negauta.",
        partial: "Perskaityta tik dalis šaltinių. Atnaujinimas nepilnas.",
        unreadable: "Įrašų atnaujinti nepavyko. Sinchronizavimas nepatvirtintas.",
      };
  const refreshRecords = async () => {
    if (!user || lock.current) return;
    const userId = user.id;
    lock.current = true;
    setRefresh({ userId, outcome: "refreshing" });
    try {
      const result = await query.refetch({ throwOnError: true });
      setRefresh({ userId, outcome: signalRefreshOutcome(result.data ?? []) });
    } catch {
      setRefresh({ userId, outcome: "unreadable" });
    } finally {
      lock.current = false;
    }
  };

  return (
    <section
      aria-label={t("ds.title")}
      className="fl-data-sources flex flex-wrap items-center gap-x-3 gap-y-2 rounded-3xl border border-border bg-surface px-3 py-2.5"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {t("ds.title")}
      </span>
      <Source
        icon={Watch}
        label={t("ds.device")}
        state={checking ? "unknown" : sourceState(signals, DEVICE_SIGNALS)}
      />
      <Source
        icon={PencilLine}
        label={t("ds.manual")}
        state={checking ? "unknown" : sourceState(signals, MANUAL_SIGNALS)}
      />
      <span className="ml-auto text-[11px] text-muted-foreground">
        {newest
          ? `${t("ds.lastReading")}: ${newest}`
          : readable
            ? t("ds.noReadings")
            : t("ds.unknownReadings")}
      </span>
      <button
        type="button"
        data-testid="refresh-received-data"
        onClick={() => void refreshRecords()}
        disabled={!user || query.isFetching || outcome === "refreshing"}
        title={
          english
            ? "Refresh records already received by GYMS.LIFE; this does not request a sync from your watch."
            : "Atnaujina GYMS.LIFE jau gautus įrašus; neužsako laikrodžio sinchronizavimo."
        }
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-[11px] font-semibold text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <RefreshCw
          aria-hidden="true"
          className={`size-3.5 ${outcome === "refreshing" ? "animate-spin motion-reduce:animate-none" : ""}`}
        />
        {english ? "Refresh data" : "Atnaujinti duomenis"}
      </button>
      <Link
        to="/me"
        className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {t("hs.connect")}
      </Link>
      {outcome ? (
        <p
          role="status"
          data-testid="received-data-refresh-status"
          className="w-full text-[11px] text-muted-foreground"
        >
          {messages[outcome]}
        </p>
      ) : null}
    </section>
  );
}
