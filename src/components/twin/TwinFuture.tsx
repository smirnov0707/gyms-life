import { Activity } from "lucide-react";
import { FutureMeSimulationDeck } from "@/components/future-lab/FutureMeSimulationDeck";
import { FutureMeSummary } from "@/components/future-lab/FutureMeSummary";
import { PerformanceProgressPanel } from "@/components/PerformanceProgressPanel";
import { WeeklyIntelligenceReview } from "@/components/WeeklyIntelligenceReview";
import { InjuryRiskRadar } from "@/components/InjuryRiskRadar";
import { baseLang, useI18n } from "@/lib/i18n";

/** Past, present and future belong to one athlete model rather than separate apps. */
export function TwinFuture() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";

  return (
    <div className="grid gap-4">
      <header className="rounded-3xl border border-border bg-surface p-4 md:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300 light:text-violet-700">
          {english ? "TWIN · FUTURE" : "DVYNYS · ATEITIS"}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">
          {english ? "Explore trajectories, not promises" : "Tyrinėk trajektorijas, ne pažadus"}
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {english
            ? "Bounded simulations use observed evidence and never override Today."
            : "Ribotos simuliacijos remiasi stebėtais duomenimis ir niekada nepakeičia Today sprendimo."}
        </p>
      </header>

      <FutureMeSimulationDeck />
      <details className="fl-secondary-details">
        <summary>{english ? "Observed evolution" : "Stebima evoliucija"}</summary>
        <div className="fl-disclosed-content">
          <FutureMeSummary />
        </div>
      </details>
      <details className="fl-secondary-details">
        <summary className="flex items-center gap-2">
          <Activity className="size-3.5 text-cyan-300" />
          {english ? "Trajectory evidence" : "Trajektorijos įrodymai"}
        </summary>
        <div className="fl-disclosed-content space-y-4">
          <p className="text-xs text-muted-foreground">
            {english
              ? "Measured performance and risk signals that inform the scenario layer."
              : "Pamatuotas rezultatyvumas ir rizikos signalai, kuriais remiasi scenarijų sluoksnis."}
          </p>
          <PerformanceProgressPanel />
          <WeeklyIntelligenceReview />
          <InjuryRiskRadar />
        </div>
      </details>
    </div>
  );
}
