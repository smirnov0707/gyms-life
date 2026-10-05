import { JournalIntelligence } from "@/components/future-lab/JournalIntelligence";
import { TwinTimeline } from "@/components/twin/TwinTimeline";
import { WorkoutHistoryPage } from "@/components/twin/TwinWorkoutHistory";
import { TwinMilestones } from "@/components/twin/TwinMilestones";
import { TwinTrendLens } from "@/components/twin/TwinTrendLens";
import { TwinRewind } from "@/components/twin/TwinRewind";
import { TwinMemory } from "@/components/twin/TwinMemory";
import { baseLang, useI18n } from "@/lib/i18n";

/** The Twin's auditable memory: one timeline first, learning and raw history on demand. */
export function TwinJournal() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";

  return (
    <div className="twin-journal-view grid gap-3">
      <header className="fl-premium-card rounded-3xl border border-border bg-surface p-4 md:p-5">
        <p className="fl-eyebrow">{english ? "TWIN · TIMELINE" : "TWIN · LAIKO JUOSTA"}</p>
        <h2 className="mt-2 text-lg font-semibold text-foreground">
          {english
            ? "Your history, with memory attached."
            : "Tavo istorija su išsaugota atmintimi."}
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {english
            ? "Events stay chronological. Learning, patterns and milestones explain what changed without becoming separate dashboards."
            : "Įvykiai lieka chronologiniai. Mokymasis, dėsningumai ir etapai paaiškina pokyčius netapdami atskirais dashboardais."}
        </p>
      </header>

      <TwinTimeline />

      <details className="fl-secondary-details">
        <summary>{english ? "Memory & patterns" : "Atmintis ir dėsningumai"}</summary>
        <div className="fl-disclosed-content grid gap-4">
          <TwinMemory />
          <TwinTrendLens />
          <TwinMilestones />
          <details className="fl-secondary-details">
            <summary>
              {english ? "Learning ledger & rewind" : "Mokymosi žurnalas ir rewind"}
            </summary>
            <div className="fl-disclosed-content grid gap-4">
              <JournalIntelligence />
              <TwinRewind />
            </div>
          </details>
        </div>
      </details>

      <details className="fl-secondary-details">
        <summary>{english ? "Training history" : "Treniruočių istorija"}</summary>
        <div className="fl-disclosed-content">
          <WorkoutHistoryPage />
        </div>
      </details>
    </div>
  );
}
