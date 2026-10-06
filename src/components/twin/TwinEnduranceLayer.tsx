import { useQuery } from "@tanstack/react-query";
import { Activity, Footprints } from "lucide-react";
import { getEnduranceTwinProfile } from "@/lib/endurance-twin.functions";
import { baseLang, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
export function TwinEnduranceLayer() {
  const { lang } = useI18n(),
    en = baseLang(lang) === "en";
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["endurance-twin", user?.id],
    queryFn: () => getEnduranceTwinProfile(),
    enabled: Boolean(user),
    staleTime: 60000,
  });
  if (!data) return null;
  const drift = data.latestSignals.find((x) => x.key === "aerobic_drift"),
    cad = data.latestSignals.find((x) => x.key === "cadence_stability");
  return (
    <section className="fl-surface grid gap-3">
      <div className="flex items-center gap-2">
        <Footprints className="size-4 text-primary" />
        <div>
          <p className="fl-eyebrow">ENDURANCE</p>
          <h3 className="text-lg font-semibold">
            {en ? "Aerobic adaptation" : "Aerobinė adaptacija"}
          </h3>
        </div>
      </div>
      {data.raceIntelligence ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {en ? "Race trajectory" : "Varžybų trajektorija"}
            </p>
            <span className="text-xs font-semibold text-primary">
              {data.raceIntelligence.daysToRace} {en ? "days" : "d."}
            </span>
          </div>
          <strong className="mt-1 block">
            {data.raceIntelligence.decision.action === "recover"
              ? en
                ? "Recovery protected"
                : "Saugomas atsistatymas"
              : data.raceIntelligence.decision.action === "reduce"
                ? en
                  ? "Load reduced"
                  : "Krūvis mažinamas"
                : data.raceIntelligence.decision.action === "proceed"
                  ? en
                    ? "Trajectory on plan"
                    : "Trajektorija pagal planą"
                  : en
                    ? "Building evidence"
                    : "Kaupiami duomenys"}
          </strong>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.raceIntelligence.raceDistance.toUpperCase()} ·{" "}
            {data.raceIntelligence.readiness.status.replaceAll("_", " ")} ·{" "}
            {data.raceIntelligence.decision.confidence}
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">
            {en ? "Efficiency trend" : "Efektyvumo trendas"}
          </p>
          <strong className="mt-1 block capitalize">
            {data.aerobicEfficiencyTrend.status.replaceAll("_", " ")}
          </strong>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">
            {en ? "Cadence stability" : "Žingsnių dažnio stabilumas"}
          </p>
          <strong className="mt-1 block">
            {cad?.status === "measured" && cad.value !== null
              ? Math.round(cad.value * 100) + "%"
              : "—"}
          </strong>
        </div>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Activity className="mt-0.5 size-3 shrink-0" />
        {drift?.status === "measured" && drift.value !== null
          ? (en
              ? "Latest split-based aerobic drift: "
              : "Naujausias pagal splitus išvestas aerobinis driftas: ") +
            (drift.value * 100).toFixed(1) +
            "%."
          : en
            ? "Split telemetry is still building. No endurance physiology is inferred without evidence."
            : "Splitų telemetrija dar kaupiama. Be duomenų ištvermės fiziologija nėra spėjama."}
      </p>
    </section>
  );
}
