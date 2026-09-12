import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLiveSignals } from "@/lib/live-signals.functions";
import { buildSinceYesterday, buildTwinPulse } from "@/lib/twin-pulse";

const LABELS = {
  sleep: ["Miegas", "Sleep"],
  hrv: ["ŠRV", "HRV"],
  restingHr: ["Ramybės pulsas", "Resting HR"],
  steps: ["Žingsniai", "Steps"],
  activeKcal: ["Aktyvumas", "Activity"],
  weight: ["Svoris", "Weight"],
  bodyFat: ["Kūno riebalai", "Body fat"],
} as const;

export function TwinPulse() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const timeZone = browserTimeZone();
  const query = useQuery({
    queryKey: ["live-signals", user?.id, timeZone],
    queryFn: () => getLiveSignals({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });
  const signals = query.data ?? [];
  const pulse = buildTwinPulse(signals);
  const changes = buildSinceYesterday(signals).slice(0, 4);
  const state =
    pulse.state === "build"
      ? english
        ? "BUILD"
        : "AUGIMAS"
      : pulse.state === "protect"
        ? english
          ? "PROTECT"
          : "SAUGOTI"
        : pulse.state === "steady"
          ? english
            ? "STEADY"
            : "STABILI"
          : english
            ? "FORMING"
            : "FORMUOJAMA";
  return (
    <section
      className="rounded-2xl border border-border bg-surface/85 p-4 sm:p-5"
      aria-label="Twin Pulse"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-violet-300">
            TWIN PULSE
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">{state}</h2>
        </div>
        <Activity aria-hidden="true" className="size-5 text-violet-300" />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {query.isError
          ? english
            ? "Current signals could not be read. No state is inferred."
            : "Dabartinių signalų nepavyko perskaityti. Būsena nespėjama."
          : pulse.measuredFactorCount < 2
            ? english
              ? "More measured recovery history is needed before a direction is shown."
              : "Krypčiai parodyti dar reikia daugiau pamatuotos atsistatymo istorijos."
            : english
              ? `Direction is based on ${pulse.measuredFactorCount} measured recovery signals. It does not make today's decision.`
              : `Kryptis paremta ${pulse.measuredFactorCount} pamatuotais atsistatymo signalais. Ji nepriima šiandienos sprendimo.`}
      </p>
      <div className="mt-4 border-t border-border/70 pt-3">
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {english ? "SINCE YESTERDAY" : "NUO VAKAR"}
        </p>
        {changes.length ? (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {changes.map((change) => {
              const Icon =
                change.direction === "rising"
                  ? ArrowUpRight
                  : change.direction === "falling"
                    ? ArrowDownRight
                    : ArrowRight;
              return (
                <li key={change.id} className="flex items-center gap-2 text-xs text-foreground">
                  <Icon aria-hidden="true" className="size-3.5 text-violet-300" />
                  <span>{LABELS[change.id][english ? 1 : 0]}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {change.delta > 0 ? "+" : ""}
                    {change.delta}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {english
              ? "No comparable measured change is available yet."
              : "Dar nėra palyginamo pamatuoto pokyčio."}
          </p>
        )}
      </div>
    </section>
  );
}
