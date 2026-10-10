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
      <header className="fl-world-header">
        <h1 className="fl-world-title text-foreground">
          {english ? "Your history" : "Tavo istorija"}
        </h1>
      </header>

      <TwinTimeline />

      <details className="fl-secondary-details">
        <summary>{english ? "Training history" : "Treniruočių istorija"}</summary>
        <div className="fl-disclosed-content">
          <WorkoutHistoryPage />
        </div>
      </details>

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
    </div>
  );
}
