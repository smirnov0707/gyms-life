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
    <div className="grid gap-4">
      <header className="rounded-3xl border border-border bg-surface p-4 md:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300 light:text-cyan-700">
          {english ? "TWIN · TIMELINE" : "DVYNYS · LAIKO JUOSTA"}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">
          {english ? "A memory you can audit" : "Atmintis, kurią gali patikrinti"}
        </h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {english
            ? "See how hypotheses, evidence and decisions changed the Twin over time."
            : "Matyk, kaip hipotezės, įrodymai ir sprendimai laikui bėgant keitė tavo Twin."}
        </p>
      </header>
      <TwinTimeline />
      <JournalIntelligence />
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
