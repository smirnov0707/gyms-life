import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { InjuryRiskRadar } from "@/components/InjuryRiskRadar";
import { PerformanceProgressPanel } from "@/components/PerformanceProgressPanel";
import { WeeklyIntelligenceReview } from "@/components/WeeklyIntelligenceReview";
import { FutureMeSimulationDeck } from "@/components/future-lab/FutureMeSimulationDeck";
import { FutureMeSummary } from "@/components/future-lab/FutureMeSummary";
import { baseLang, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Future Me — GYMS.LIFE FUTURE LAB" },
      {
        name: "description",
        content: "Deterministic simulation, observed trajectory and bounded future scenarios.",
      },
    ],
  }),
  component: ProgressPage,
});
function ProgressPage() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";

  return (
    <main className="mx-auto w-full max-w-[1480px] space-y-4 px-3 pb-8 sm:px-4 lg:px-6">
      <header className="pt-2 sm:pt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-violet-300 light:text-violet-700">
          FUTURE ME · GYMS.LIFE INTELLIGENCE
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {english ? "Explore trajectories, not promises" : "Tyrinėk trajektorijas, ne pažadus"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {english
            ? "Simulate bounded scenarios from observed evidence. Future Me never overrides Today."
            : "Modeliuok ribotus scenarijus iš stebėtų duomenų. Future Me niekada nepakeičia Today sprendimų."}
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
    </main>
  );
}
