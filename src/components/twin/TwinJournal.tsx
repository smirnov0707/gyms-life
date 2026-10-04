import { JournalIntelligence } from "@/components/future-lab/JournalIntelligence";
import { TwinTimeline } from "@/components/twin/TwinTimeline";
import { WorkoutHistoryPage } from "@/components/twin/TwinWorkoutHistory";
import { TwinMilestones } from "@/components/twin/TwinMilestones";
import { TwinTrendLens } from "@/components/twin/TwinTrendLens";
import { TwinRewind } from "@/components/twin/TwinRewind";
import { TwinMemory } from "@/components/twin/TwinMemory";
import { baseLang, useI18n } from "@/lib/i18n";

/** The Twin's auditable memory: what changed, why, and what the system learned. */
export function TwinJournal() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";

  return (
    <div className="twin-journal-view grid gap-3">
      <JournalIntelligence />
      <TwinTimeline />
      <details className="fl-secondary-details">
        <summary>{english ? "Changes, memory & milestones" : "Pokyčiai, atmintis ir etapai"}</summary>
        <div className="fl-disclosed-content grid gap-4">
          <TwinTrendLens />
          <TwinRewind />
          <TwinMemory />
          <TwinMilestones />
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
