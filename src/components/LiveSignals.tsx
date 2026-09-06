import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Flame, Footprints, HeartPulse, Moon, Percent, Scale } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLiveSignals } from "@/lib/live-signals.functions";
import { LIVE_SIGNAL_IDS, type LiveSignal, type LiveSignalId } from "@/lib/live-signals.engine";

/**
 * The athlete's own measured signals, and — just as prominently — what has
 * never been measured.
 *
 * Every row here is a real reading from a real source. Nothing is estimated,
 * modelled or filled in: a signal no device has ever sent says so, and one
 * whose source could not be read says that instead, because sending someone to
 * connect a watch they are already wearing is worse than saying nothing.
 */

type Shape = {
  icon: typeof Moon;
  label: TKey;
  unit: string;
  /** How many decimals the reading is worth. Steps are not measured to 0.1. */
  decimals: number;
  /** Which direction is worth noticing; only used to colour a change. */
  betterWhen: "higher" | "lower" | "neither";
};

const SHAPES: Record<LiveSignalId, Shape> = {
  sleep: { icon: Moon, label: "sig.sleep", unit: "h", decimals: 1, betterWhen: "higher" },
  hrv: { icon: Activity, label: "sig.hrv", unit: "ms", decimals: 0, betterWhen: "higher" },
  restingHr: {
    icon: HeartPulse,
    label: "sig.restingHr",
    unit: "bpm",
    decimals: 0,
    betterWhen: "lower",
  },
  steps: { icon: Footprints, label: "sig.steps", unit: "", decimals: 0, betterWhen: "neither" },
  activeKcal: {
    icon: Flame,
    label: "sig.activeKcal",
    unit: "kcal",
    decimals: 0,
    betterWhen: "neither",
  },
  weight: { icon: Scale, label: "sig.weight", unit: "kg", decimals: 1, betterWhen: "neither" },
  bodyFat: { icon: Percent, label: "sig.bodyFat", unit: "%", decimals: 1, betterWhen: "neither" },
};

function formatValue(value: number, decimals: number, lang: string): string {
  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function deltaTone(signal: LiveSignal): string {
  const shape = SHAPES[signal.id];
  if (signal.delta === null || signal.delta === 0 || shape.betterWhen === "neither") {
    return "text-muted-foreground";
  }
  const good = shape.betterWhen === "higher" ? signal.delta > 0 : signal.delta < 0;
  return good ? "text-primary" : "text-destructive";
}

function SignalRow({ signal }: { signal: LiveSignal }) {
  const { t, lang } = useI18n();
  const shape = SHAPES[signal.id];
  const Icon = shape.icon;
  const known = signal.value !== null;

  return (
    <li className="flex items-center gap-3 border-t border-border/50 px-3 py-2.5 first:border-t-0">
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-xl border border-border/60 ${
          known ? "bg-surface-2 text-primary" : "bg-surface text-muted-foreground/60"
        }`}
      >
        <Icon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground">
          {t(shape.label)}
        </span>
        <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {signal.state === "unreadable"
            ? t("sig.unreadable")
            : signal.state === "absent"
              ? t("sig.absent")
              : signal.source === "manual"
                ? t("sig.sourceManual")
                : t("sig.sourceDevice")}
        </span>
      </span>

      {known ? (
        <span className="shrink-0 text-right">
          <span className="block font-display text-lg leading-none tabular-nums text-foreground">
            {formatValue(signal.value!, shape.decimals, lang)}
            {shape.unit ? (
              <span className="ml-1 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {shape.unit}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[10px] tabular-nums">
            {signal.state === "stale" && signal.ageDays !== null ? (
              // An age, not a change: tinted apart from the deltas above it so
              // "17 d" cannot be read as seventeen of anything.
              <span
                className="text-accent"
                title={`${t("sig.lastReading")}: ${signal.recordedOn}`}
                aria-label={`${t("sig.lastReading")}: ${signal.recordedOn}`}
              >
                {signal.ageDays} d
              </span>
            ) : signal.delta !== null ? (
              <span className={deltaTone(signal)}>
                {signal.delta > 0 ? "+" : ""}
                {formatValue(signal.delta, shape.decimals, lang)}
              </span>
            ) : (
              <span className="text-transparent">·</span>
            )}
          </span>
        </span>
      ) : (
        <span aria-hidden="true" className="shrink-0 font-display text-lg text-muted-foreground/40">
          —
        </span>
      )}
    </li>
  );
}

/** Placeholder rows while the read is in flight, so the rail does not jump. */
function SkeletonRows() {
  return (
    <ul className="animate-pulse">
      {LIVE_SIGNAL_IDS.map((id) => (
        <li key={id} className="flex items-center gap-3 border-t border-border/50 px-3 py-2.5">
          <span className="size-8 shrink-0 rounded-xl bg-surface-2" />
          <span className="h-3 flex-1 rounded bg-surface-2" />
          <span className="h-4 w-10 rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}

export function LiveSignals() {
  const { t } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["live-signals", user?.id, timeZone],
    queryFn: () => getLiveSignals({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });

  // A failed call is not an empty rail. Every signal reads "could not be read"
  // so the screen never claims the athlete has no data because of our outage.
  const signals: LiveSignal[] | null = isError
    ? LIVE_SIGNAL_IDS.map((id) => ({
        id,
        state: "unreadable" as const,
        value: null,
        recordedOn: null,
        ageDays: null,
        delta: null,
        source: null,
      }))
    : (data ?? null);

  const silent = signals?.every((signal) => signal.state === "absent") ?? false;

  return (
    <section
      aria-label={t("sig.title")}
      className="overflow-hidden rounded-3xl border border-border bg-surface"
    >
      <header className="px-3 pb-2.5 pt-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">
          {t("sig.title")}
        </h2>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {t("sig.subtitle")}
        </p>
      </header>

      {isLoading && !signals ? (
        <SkeletonRows />
      ) : (
        <ul>
          {(signals ?? []).map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))}
        </ul>
      )}

      {silent ? (
        <div className="border-t border-border/50 px-3 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{t("sig.silent")}</p>
          <Link
            to="/progress"
            className="mt-2 inline-flex min-h-11 items-center rounded-full border border-border px-4 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {t("sig.logBody")}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
