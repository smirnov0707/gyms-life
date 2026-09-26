import { JournalIntelligence } from "@/components/future-lab/JournalIntelligence";
import { TwinTimeline } from "@/components/twin/TwinTimeline";
import { WorkoutHistoryPage } from "@/components/twin/TwinWorkoutHistory";
import { TwinMilestones } from "@/components/twin/TwinMilestones";
import { baseLang, useI18n } from "@/lib/i18n";

/** The Twin's auditable memory: what changed, why, and what the system learned. */
export function TwinJournal() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";

  return (
    <div className="twin-journal-view grid gap-3">
      <JournalIntelligence />
      <details className="fl-secondary-details">
        <summary>{english ? "Twin state history" : "Twin būsenų istorija"}</summary>
        <div className="fl-disclosed-content">
          <TwinTimeline />
        </div>
      </details>
      <details className="fl-secondary-details">
        <summary>{english ? "Milestones & consistency" : "Etapai ir nuoseklumas"}</summary>
        <div className="fl-disclosed-content">
          <TwinMilestones />
        </div>
      </details>
      <details className="fl-secondary-details">
        <summary>{english ? "Recorded workouts" : "Užregistruotos treniruotės"}</summary>
        <div className="fl-disclosed-content">
          <WorkoutHistoryPage />
        </div>
      </details>
    </div>
  );
}
