import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, History, PersonStanding } from "lucide-react";
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
      <details className="fl-secondary-details" open>
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
      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/twin"
          className="group rounded-2xl border border-border bg-surface/75 p-4 transition-colors hover:border-violet-400/40"
        >
          <PersonStanding className="size-4 text-violet-300" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            {english ? "Body & identity" : "Kūnas ir identitetas"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {english
              ? "Measurements, body changes and your Living Twin."
              : "Matavimai, kūno pokyčiai ir tavo Living Twin."}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-300">
            {english ? "Open My Twin" : "Atidaryti My Twin"} <ArrowRight className="size-3" />
          </span>
        </Link>
        <Link
          to="/history"
          className="group rounded-2xl border border-border bg-surface/75 p-4 transition-colors hover:border-cyan-400/40"
        >
          <History className="size-4 text-cyan-300" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            {english ? "Measured history" : "Pamatuota istorija"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {english
              ? "Completed sessions, records and the longitudinal journal live here."
              : "Užbaigtos treniruotės, rekordai ir ilgalaikis žurnalas gyvena čia."}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-300">
            {english ? "Open Journal" : "Atidaryti Journal"} <ArrowRight className="size-3" />
          </span>
        </Link>
      </section>
    </main>
  );
}
