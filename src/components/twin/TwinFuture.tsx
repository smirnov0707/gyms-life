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
    <div className="twin-future-view grid">
      <FutureMeSimulationDeck />
      <details className="fl-secondary-details">
        <summary>{english ? "Observed evolution" : "Stebimi pokyčiai"}</summary>
        <div className="fl-disclosed-content">
          <FutureMeSummary />
        </div>
      </details>
      <details className="fl-secondary-details">
        <summary className="flex items-center gap-2">
          <Activity aria-hidden="true" className="size-3.5 text-primary" />
          {english ? "Trajectory evidence" : "Pokyčių duomenys"}
        </summary>
        <div className="fl-disclosed-content fl-trajectory-evidence">
          <p className="text-xs text-muted-foreground">
            {english
              ? "Recorded training, weekly patterns and load signals in one place."
              : "Užregistruotos treniruotės, savaitės dėsningumai ir krūvio signalai vienoje vietoje."}
          </p>
          <PerformanceProgressPanel />
          <WeeklyIntelligenceReview />
          <InjuryRiskRadar />
        </div>
      </details>
    </div>
  );
}
