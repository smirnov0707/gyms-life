import { Activity } from "lucide-react";
import { FutureMeSimulationDeck } from "@/components/future-lab/FutureMeSimulationDeck";
import { FutureMeSummary } from "@/components/future-lab/FutureMeSummary";
import { PerformanceProgressPanel } from "@/components/PerformanceProgressPanel";
import { WeeklyIntelligenceReview } from "@/components/WeeklyIntelligenceReview";
import { InjuryRiskRadar } from "@/components/InjuryRiskRadar";
import { baseLang, useI18n } from "@/lib/i18n";

/** One trajectory first; observed facts and constraints explain it without becoming rival futures. */
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
              ? "The projection stays separate from the evidence that supports or limits it. Nothing below is another forecast."
              : "Projekcija lieka atskirta nuo ją pagrindžiančių ar ribojančių duomenų. Žemiau nėra papildomų prognozių."}
          </p>

          <section className="grid gap-3">
            <header>
              <p className="fl-eyebrow">{english ? "Observed change" : "Stebėtas pokytis"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {english
                  ? "What your stored measurements and completed training actually show."
                  : "Ką iš tikrųjų rodo išsaugoti matavimai ir užbaigtos treniruotės."}
              </p>
            </header>
            <FutureMeSummary />
            <PerformanceProgressPanel />
          </section>

          <details className="fl-secondary-details">
            <summary>{english ? "Training evidence" : "Treniruočių įrodymai"}</summary>
            <div className="fl-disclosed-content">
              <WeeklyIntelligenceReview />
            </div>
          </details>

          <details className="fl-secondary-details">
            <summary>
              {english ? "Constraints & uncertainty" : "Ribos ir neapibrėžtumas"}
            </summary>
            <div className="fl-disclosed-content">
              <InjuryRiskRadar />
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}
