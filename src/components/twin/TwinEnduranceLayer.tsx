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
