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
    <div className="twin-future-view grid gap-3">
      <FutureMeSimulationDeck />
      <details className="fl-secondary-details">
        <summary className="flex items-center gap-2">
          <Activity aria-hidden="true" className="size-3.5 text-primary" />
          {english ? "Evidence behind this trajectory" : "Šios trajektorijos pagrindas"}
        </summary>
        <div className="fl-disclosed-content grid gap-4">
          <p className="text-xs text-muted-foreground">
            {english
              ? "Recorded change, training load and weekly patterns are supporting evidence — not extra forecasts."
              : "Užfiksuoti pokyčiai, treniruočių krūvis ir savaitės dėsningumai yra pagrindžiantys duomenys, o ne papildomos prognozės."}
          </p>
          <FutureMeSummary />
          <PerformanceProgressPanel />
          <WeeklyIntelligenceReview />
          <InjuryRiskRadar />
        </div>
      </details>
    </div>
  );
}
